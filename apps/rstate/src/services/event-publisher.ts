/**
 * Event Publisher Service
 *
 * Orchestrates publishing of Kind 1066 (delta), Kind 20066 (ephemeral),
 * and Kind 1166 (aggregate snapshot) events to the nostr network.
 */

import type { StateCore } from '../core/api.js'
import type { RelayState } from '../core/types/aggregation.js'
import type { PublishSchedule } from '../config.js'
import type { RelayDelta, OperationalStatus } from '../events/types.js'
import { ResilientRelayPool } from '../resilient-relay-pool.js'
import { createSigner, toHexKey, type EventSigner } from '../events/signing.js'
import { detectDeltas, mergeDeltas } from '../events/delta-detector.js'
import { buildKind1066Event } from '../events/builders/kind1066.js'
import { buildKind20066Event } from '../events/builders/kind20066.js'
import { buildKind1166Event } from '../events/builders/kind1166.js'
import type { Kind1166Category } from '../events/types.js'
import { AnnounceMonitor } from '@nostrwatch/announce'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'event-publisher' })

interface PublishingConfig {
  publishRelays: string[]
  signingKey: string
  kind1066: { enabled: boolean; schedule: PublishSchedule }
  kind20066: { enabled: boolean }
  kind1166: { enabled: boolean; schedule: PublishSchedule }
  announce: {
    profile?: { name?: string; about?: string; picture?: string }
    frequency: string
    userDataRelays?: string[]
  }
}

const SCHEDULE_INTERVALS: Record<PublishSchedule, number> = {
  hourly: 3600,
  every30m: 1800,
  every15m: 900,
  every5m: 300,
}

export class EventPublisherService {
  private publishPool: ResilientRelayPool
  private signer: EventSigner
  private previousStates: Map<string, RelayState> = new Map()
  private operationalStatuses: Map<string, 'online' | 'offline'> = new Map()
  private accumulatedDeltas: Map<string, RelayDelta[]> = new Map()
  private lastKind1066Publish: number = 0
  private lastKind1166Publish: number = 0

  constructor(
    private core: StateCore,
    private config: PublishingConfig,
  ) {
    this.publishPool = new ResilientRelayPool(config.publishRelays)
    this.signer = createSigner(config.signingKey)

    logger.info({
      pubkey: this.signer.pubkey,
      relays: config.publishRelays.length,
      kind1066: config.kind1066.enabled ? config.kind1066.schedule : 'disabled',
      kind20066: config.kind20066.enabled ? 'immediate' : 'disabled',
      kind1166: config.kind1166.enabled ? config.kind1166.schedule : 'disabled',
    }, 'EventPublisherService created')
  }

  async start(): Promise<void> {
    await this.publishPool.connect()
    // Align first publish to the next schedule boundary
    const now = Math.floor(Date.now() / 1000)
    this.lastKind1066Publish = this.alignToSchedule(now, this.config.kind1066.schedule)
    this.lastKind1166Publish = this.alignToSchedule(now, this.config.kind1166.schedule)

    // Publish announce events (Kind 0, 10002, 10166) on startup
    await this.publishAnnouncement()

    logger.info('EventPublisherService started')
  }

  private async publishAnnouncement(): Promise<void> {
    try {
      const hexSk = toHexKey(this.config.signingKey)

      // Collect enabled kinds for k tags
      const enabledKinds: number[] = []
      if (this.config.kind1066.enabled) enabledKinds.push(1066)
      if (this.config.kind20066.enabled) enabledKinds.push(20066)
      if (this.config.kind1166.enabled) enabledKinds.push(1166)

      const announcer = new AnnounceMonitor(this.signer.pubkey, {
        kinds: enabledKinds,
        frequency: this.config.announce.frequency,
        relays: this.config.publishRelays,
        userDataRelays: this.config.announce.userDataRelays,
        profile: this.config.announce.profile ?? {},
        checks: [],   // rstate is an aggregator, not a direct checker
        networks: [], // monitors all networks
        clientTag: '@nostrwatch/rstate',
      })

      announcer.generate()
      await announcer.sign(hexSk)
      const ids = await announcer.publish()
      logger.info({ eventIds: ids, kinds: enabledKinds }, 'Published announce events (Kind 0, 10002, 10166)')
    } catch (err) {
      logger.error({ err }, 'Failed to publish announce events')
    }
  }

  async stop(): Promise<void> {
    await this.publishPool.disconnect()
    logger.info('EventPublisherService stopped')
  }

  /**
   * Called after each 30s aggregation cycle
   */
  async onAggregationComplete(changedRelays: string[]): Promise<void> {
    const allStates = this.core.query.relays.getAll()
    const stateMap = new Map<string, RelayState>()
    for (const s of allStates) stateMap.set(s.relayUrl, s)

    // Compute online set once (avoids iterating all states per-relay)
    const onlineSet = new Set(this.core.query.relays.online())

    // Process changed relays: detect deltas and transitions
    for (const url of changedRelays) {
      const curr = stateMap.get(url)
      if (!curr) continue

      const prev = this.previousStates.get(url)
      if (prev) {
        // Detect and accumulate deltas
        const newDeltas = detectDeltas(prev, curr)
        if (newDeltas.length > 0) {
          const existing = this.accumulatedDeltas.get(url) ?? []
          this.accumulatedDeltas.set(url, mergeDeltas(existing, newDeltas))
        }
      }

      // Detect operational transitions
      const wasOnline = this.operationalStatuses.get(url)
      const isOnline = onlineSet.has(url)
      const currentStatus: 'online' | 'offline' = isOnline ? 'online' : 'offline'

      if (wasOnline !== undefined && wasOnline !== currentStatus) {
        const transition = isOnline ? 'up' : 'down' as const

        // Publish Kind 20066 immediately for transitions
        if (this.config.kind20066.enabled) {
          try {
            const event = buildKind20066Event({
              relayUrl: url,
              transition,
              rttOpen: isOnline ? curr.rtt?.open?.value : undefined,
            })
            const signed = this.signer.sign(event)
            await this.publishPool.publish(signed)
            logger.info({ relay: url, transition }, 'Published Kind 20066 ephemeral event')
          } catch (err) {
            logger.error({ err, relay: url }, 'Failed to publish Kind 20066')
          }
        }
      }

      this.operationalStatuses.set(url, currentStatus)
    }

    // Initialize states for relays we haven't seen before
    for (const [url] of stateMap) {
      if (!this.operationalStatuses.has(url)) {
        this.operationalStatuses.set(url, onlineSet.has(url) ? 'online' : 'offline')
      }
    }

    const now = Math.floor(Date.now() / 1000)

    // Check Kind 1066 schedule
    if (this.config.kind1066.enabled && this.hasScheduleBoundaryCrossed(now, this.lastKind1066Publish, this.config.kind1066.schedule)) {
      await this.publishKind1066Events(stateMap)
      this.lastKind1066Publish = now
    }

    // Check Kind 1166 schedule
    if (this.config.kind1166.enabled && this.hasScheduleBoundaryCrossed(now, this.lastKind1166Publish, this.config.kind1166.schedule)) {
      await this.publishNetworkSnapshot()
      this.lastKind1166Publish = now
    }

    // Update previous states for changed relays
    for (const url of changedRelays) {
      const state = stateMap.get(url)
      if (state) this.previousStates.set(url, state)
    }
  }

  private async publishKind1066Events(stateMap: Map<string, RelayState>): Promise<void> {
    let published = 0
    let errors = 0

    for (const [url, deltas] of this.accumulatedDeltas) {
      const curr = stateMap.get(url)
      if (!curr) continue

      const status = this.getOperationalStatus(url)
      try {
        const event = buildKind1066Event({
          relayUrl: url,
          status,
          rttOpen: curr.rtt?.open?.value,
          deltas,
        })
        const signed = this.signer.sign(event)
        await this.publishPool.publish(signed)
        published++
      } catch (err) {
        errors++
        logger.error({ err, relay: url }, 'Failed to publish Kind 1066')
      }
    }

    // Clear accumulated deltas after publish
    this.accumulatedDeltas.clear()

    // Also publish for relays with no deltas but that are online (heartbeat)
    // Only publish relays that have state
    for (const [url, state] of stateMap) {
      if (this.accumulatedDeltas.has(url)) continue // already published above (though cleared)

      const status = this.getOperationalStatus(url)
      if (status === 'init') continue // don't publish init events

      try {
        const event = buildKind1066Event({
          relayUrl: url,
          status,
          rttOpen: state.rtt?.open?.value,
          deltas: [],
        })
        const signed = this.signer.sign(event)
        await this.publishPool.publish(signed)
        published++
      } catch (err) {
        errors++
      }
    }

    logger.info({ published, errors }, 'Kind 1066 batch publish complete')
  }

  private async publishNetworkSnapshot(): Promise<void> {
    try {
      const categories: Kind1166Category[] = []

      // Status counts
      const online = this.core.query.relays.online()
      const offline = this.core.query.relays.offline()
      const dead = this.core.query.relays.dead()
      categories.push(
        { category: 'status', key: 'online', value: String(online.length) },
        { category: 'status', key: 'offline', value: String(offline.length) },
        { category: 'status', key: 'dead', value: String(dead.length) },
        { category: 'status', key: 'total', value: String(online.length + offline.length + dead.length) },
      )

      // Software distribution
      const bySoftware = this.core.query.relays.bySoftware()
      for (const [family, relays] of Object.entries(bySoftware)) {
        categories.push({ category: 'software', key: family, value: String(relays.length) })
      }

      // Country distribution
      const byCountry = this.core.query.relays.byCountry()
      for (const [code, relays] of Object.entries(byCountry)) {
        categories.push({ category: 'country', key: code, value: String(relays.length) })
      }

      // NIP support
      const byNip = this.core.query.relays.byNip()
      for (const [nip, data] of Object.entries(byNip)) {
        categories.push({ category: 'nip', key: String(nip), value: String(data.relays.length) })
      }

      // Operators: count unique nip11.pubkey values
      const allStates = this.core.query.relays.getAll()
      const operators = new Set<string>()
      for (const state of allStates) {
        const pk = state.nip11?.pubkey
        if (typeof pk === 'string' && pk.length > 0) {
          operators.add(pk)
        }
      }
      categories.push({ category: 'operator', key: 'unique', value: String(operators.size) })

      // ISP: from labels
      const ispCounts: Record<string, number> = {}
      for (const state of allStates) {
        const labels = state.labels ?? {}
        for (const ns of ['isp', 'asn']) {
          const values = labels[ns]
          if (values) {
            for (const val of values) {
              ispCounts[val] = (ispCounts[val] ?? 0) + 1
            }
          }
        }
      }
      for (const [isp, count] of Object.entries(ispCounts)) {
        categories.push({ category: 'isp', key: isp, value: String(count) })
      }

      const event = buildKind1166Event({ categories })
      const signed = this.signer.sign(event)
      await this.publishPool.publish(signed)

      logger.info({ categoryCount: categories.length }, 'Published Kind 1166 network snapshot')
    } catch (err) {
      logger.error({ err }, 'Failed to publish Kind 1166 snapshot')
    }
  }

  private getOperationalStatus(url: string): OperationalStatus {
    const status = this.operationalStatuses.get(url)
    if (status === undefined) return 'init'
    return status === 'online' ? 'up' : 'down'
  }

  /**
   * Align timestamp to the most recent schedule boundary
   */
  private alignToSchedule(nowSec: number, schedule: PublishSchedule): number {
    const interval = SCHEDULE_INTERVALS[schedule]
    return Math.floor(nowSec / interval) * interval
  }

  /**
   * Check if a schedule boundary has been crossed since the last publish
   */
  private hasScheduleBoundaryCrossed(nowSec: number, lastPublishSec: number, schedule: PublishSchedule): boolean {
    const interval = SCHEDULE_INTERVALS[schedule]
    const currentBoundary = Math.floor(nowSec / interval) * interval
    const lastBoundary = Math.floor(lastPublishSec / interval) * interval
    return currentBoundary > lastBoundary
  }
}
