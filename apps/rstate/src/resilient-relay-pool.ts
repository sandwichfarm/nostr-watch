/**
 * Resilient Relay Pool
 *
 * Uses applesauce-relay's Relay/RelayGroup directly (bypassing the SDK's
 * ApplesauceRelayPool) to fix two production bugs:
 *
 * 1. Clean websocket closes kill subscriptions permanently — fixed by enabling
 *    `resubscribe` (RxJS repeat()) on all subscriptions.
 * 2. Global unsubscribe bug — RelayPoolAdapter.subscribe() returned an
 *    unsubscribe handle that killed ALL subscriptions. Fixed with per-subscription
 *    tracking and individual teardown.
 */

import { Relay, RelayGroup } from 'applesauce-relay'
import type { RelayHandler } from '@contextvm/sdk'
import type { RelayPool } from './sdk-stubs.js'
import type { NostrEvent, Filter } from 'nostr-tools'
import { getLogger } from './utils/logger.js'

const logger = getLogger().child({ module: 'resilient-relay-pool' })

interface TrackedSubscription {
  id: string
  filters: any[]
  onEvent: (event: any) => void
  onEose?: () => void
  rxSub: { unsubscribe: () => void } | null
  createdAt: number
  restartCount: number
}

export interface ResilientRelayPoolOptions {
  /** Delay before resubscribing after a clean close (ms). Default: 1000 */
  resubscribeDelayMs?: number
  /** Delay before retrying after an error (ms). Default: 2000 */
  reconnectDelayMs?: number
  /** Timeout for publish operations (ms). Default: 30000 */
  publishTimeoutMs?: number
  /** WebSocket keep-alive interval (ms). Default: 30000 */
  keepAliveMs?: number
}

let subIdCounter = 0

export class ResilientRelayPool implements RelayPool {
  private relays: Relay[]
  private group: RelayGroup
  private subscriptions = new Map<string, TrackedSubscription>()
  private isConnected = false
  private resubscribeDelayMs: number
  private reconnectDelayMs: number

  constructor(
    relayUrls: string[],
    opts: ResilientRelayPoolOptions = {},
  ) {
    this.resubscribeDelayMs = opts.resubscribeDelayMs ?? 1000
    this.reconnectDelayMs = opts.reconnectDelayMs ?? 2000

    this.relays = relayUrls.map(url => new Relay(url, {
      publishTimeout: opts.publishTimeoutMs ?? 30_000,
      keepAlive: opts.keepAliveMs ?? 30_000,
    }))

    this.group = new RelayGroup(this.relays)

    logger.info({
      relayCount: relayUrls.length,
      relayUrls,
      resubscribeDelayMs: this.resubscribeDelayMs,
      reconnectDelayMs: this.reconnectDelayMs,
    }, 'ResilientRelayPool created')
  }

  async connect(): Promise<void> {
    this.isConnected = true
    logger.info('ResilientRelayPool connected')
  }

  async disconnect(): Promise<void> {
    this.isConnected = false

    // Tear down all tracked subscriptions
    for (const [_id, tracked] of this.subscriptions) {
      try {
        tracked.rxSub?.unsubscribe()
      } catch (err) {
        logger.warn({ err, subId: tracked.id }, 'Error unsubscribing during disconnect')
      }
    }
    this.subscriptions.clear()

    // Close all relay connections
    for (const relay of this.relays) {
      try {
        relay.close()
      } catch (err) {
        logger.warn({ err, url: relay.url }, 'Error closing relay during disconnect')
      }
    }

    logger.info('ResilientRelayPool disconnected')
  }

  subscribe(
    filters: any[],
    onEvent: (event: any) => void,
    onEose?: () => void,
  ): { unsubscribe: () => void } {
    const subId = `rsub-${++subIdCounter}`

    const tracked: TrackedSubscription = {
      id: subId,
      filters,
      onEvent,
      onEose,
      rxSub: null,
      createdAt: Date.now(),
      restartCount: 0,
    }

    this.subscriptions.set(subId, tracked)
    this.startSubscription(tracked)

    logger.info({ subId, filterCount: filters.length }, 'Subscription created')

    return {
      unsubscribe: () => {
        const sub = this.subscriptions.get(subId)
        if (sub) {
          try {
            sub.rxSub?.unsubscribe()
          } catch {}
          this.subscriptions.delete(subId)
          logger.info({ subId }, 'Subscription unsubscribed')
        }
      },
    }
  }

  async publish(event: any): Promise<void> {
    await this.group.publish(event)
  }

  /**
   * Returns an object implementing the SDK's RelayHandler interface,
   * suitable for passing to NostrServerTransport.
   */
  toRelayHandler(): RelayHandler {
    return {
      connect: () => this.connect(),
      disconnect: () => this.disconnect(),
      publish: async (event: NostrEvent) => {
        await this.publish(event)
      },
      subscribe: async (
        filters: Filter[],
        onEvent: (event: NostrEvent) => void,
        onEose?: () => void,
      ): Promise<() => void> => {
        const handle = this.subscribe(filters, onEvent, onEose)
        return handle.unsubscribe
      },
      unsubscribe: () => {
        // RelayHandler.unsubscribe() kills all subscriptions (matches SDK semantics)
        for (const [_id, tracked] of this.subscriptions) {
          try {
            tracked.rxSub?.unsubscribe()
          } catch {}
        }
        this.subscriptions.clear()
        logger.info('RelayHandler: all subscriptions unsubscribed')
      },
    }
  }

  /**
   * Get pool health stats for monitoring.
   */
  getStats(): {
    connected: boolean
    subscriptionCount: number
    relayCount: number
    subscriptions: Array<{ id: string; ageMs: number; restartCount: number }>
  } {
    const now = Date.now()
    return {
      connected: this.isConnected,
      subscriptionCount: this.subscriptions.size,
      relayCount: this.relays.length,
      subscriptions: Array.from(this.subscriptions.values()).map(s => ({
        id: s.id,
        ageMs: now - s.createdAt,
        restartCount: s.restartCount,
      })),
    }
  }

  // -- internal --

  private startSubscription(tracked: TrackedSubscription): void {
    const observable = this.group.subscription(tracked.filters, {
      resubscribe: { delay: this.resubscribeDelayMs },
      reconnect: { count: undefined, delay: this.reconnectDelayMs, resetOnSuccess: true } as any,
    })

    let eoseFired = false

    tracked.rxSub = observable.subscribe({
      next: (value) => {
        if (value === 'EOSE') {
          if (!eoseFired && tracked.onEose) {
            eoseFired = true
            tracked.onEose()
          }
        } else {
          tracked.onEvent(value)
        }
      },
      error: (err) => {
        logger.error({ err, subId: tracked.id, restartCount: tracked.restartCount },
          'Subscription error — will restart')
        this.scheduleRestart(tracked)
      },
      complete: () => {
        // resubscribe should prevent this, but as defense-in-depth restart anyway
        if (this.subscriptions.has(tracked.id)) {
          logger.warn({ subId: tracked.id, restartCount: tracked.restartCount },
            'Subscription completed unexpectedly — restarting')
          this.scheduleRestart(tracked)
        }
      },
    })
  }

  private scheduleRestart(tracked: TrackedSubscription): void {
    if (!this.subscriptions.has(tracked.id)) return

    tracked.restartCount++
    const delay = Math.min(this.reconnectDelayMs * Math.pow(1.5, Math.min(tracked.restartCount - 1, 10)), 60_000)

    logger.info({ subId: tracked.id, restartCount: tracked.restartCount, delayMs: delay },
      'Scheduling subscription restart')

    setTimeout(() => {
      if (!this.subscriptions.has(tracked.id)) return
      this.startSubscription(tracked)
    }, delay)
  }
}
