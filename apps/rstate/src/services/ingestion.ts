/**
 * Ingestion Service
 *
 * Subscribes to NIP-66 events and feeds them into the observation store
 */

import type { NostrEvent } from '../types/events.js'
import type { RelayPool } from '../sdk-stubs.js'
import type { StateCore } from '../core/index.js'
import { parseMonitorAnnouncement, parseRelayObservation } from './normalization.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'ingestion' })

export class IngestionService {
  private subscriptions: Array<{ unsubscribe: () => void }> = []
  private isRunning: boolean = false
  private eventCount: number = 0
  private lastEventTime: number = 0
  private historicalCatchupComplete: boolean = false

  constructor(
    private relayPool: RelayPool,
    private core: StateCore,
    private historicalWindowSeconds: number = 24 * 3600,  // 24 hours default
    private metrics?: { recordEvent: (kind: number) => void }
  ) {
    logger.info({ historicalWindowSeconds }, 'Ingestion service initialized')
  }

  /**
   * Start ingestion
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Ingestion already running')
      return
    }

    logger.info('Starting NIP-66 ingestion')
    this.isRunning = true

    try {
      // Perform historical catchup first
      await this.performHistoricalCatchup()

      // Subscribe to monitor announcements (kind 10166)
      const monitorSub = this.relayPool.subscribe(
        [{ kinds: [10166], limit: 100 }],
        (event) => this.handleMonitorAnnouncement(event)
      )
      this.subscriptions.push(monitorSub)
      logger.info('Subscribed to kind 10166 (monitor announcements)')

      // Subscribe to relay observations (kind 30166)
      const observationSub = this.relayPool.subscribe(
        [{ kinds: [30166], limit: 1000 }],
        (event) => this.handleRelayObservation(event)
      )
      this.subscriptions.push(observationSub)
      logger.info('Subscribed to kind 30166 (relay observations)')

      // Set up periodic eviction of old observations
      this.startEvictionTimer()

      logger.info('Ingestion started successfully')
    } catch (err) {
      logger.error({ err }, 'Failed to start ingestion')
      this.isRunning = false
      throw err
    }
  }

  /**
   * Perform historical catchup using paginated queries
   */
  private async performHistoricalCatchup(): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const since = now - this.historicalWindowSeconds
    const pageSize = 500

    logger.info({ since, until: now, windowHours: this.historicalWindowSeconds / 3600 },
      'Starting historical catchup')

    let totalFetched = 0

    try {
      // Catchup monitor announcements
      const monitorCount = await this.paginatedFetch(10166, since, now, pageSize,
        (event) => this.handleMonitorAnnouncement(event))
      totalFetched += monitorCount

      // Catchup relay observations
      const observationCount = await this.paginatedFetch(30166, since, now, pageSize,
        (event) => this.handleRelayObservation(event))
      totalFetched += observationCount

      this.historicalCatchupComplete = true
      logger.info({ totalFetched, monitorCount, observationCount }, 'Historical catchup complete')
    } catch (err) {
      logger.error({ err }, 'Historical catchup failed')
      // Continue anyway - will get recent events from live subscription
    }
  }

  /**
   * Paginated fetch with decreasing until timestamp using subscribe + EOSE
   */
  private async paginatedFetch(
    kind: number,
    since: number,
    until: number,
    pageSize: number,
    handler: (event: NostrEvent) => void
  ): Promise<number> {
    let currentUntil = until
    let totalFetched = 0
    let hasMore = true

    while (hasMore && currentUntil > since) {
      const events: NostrEvent[] = []

      // Use subscribe with EOSE to fetch historical page
      await new Promise<void>((resolve, reject) => {
        let sub: { unsubscribe: () => void } | null = null
        const timeout = setTimeout(() => {
          try { sub?.unsubscribe() } catch {}
          reject(new Error('Historical fetch timeout'))
        }, 30000) // 30 second timeout

        logger.debug({
          kind,
          since,
          until: currentUntil,
          limit: pageSize,
        }, 'Fetching historical page')

        try {
          // Subscribe and collect until EOSE
          sub = this.relayPool.subscribe(
            [{
              kinds: [kind],
              since,
              until: currentUntil,
              limit: pageSize,
            }],
            (event) => {
              events.push(event)
            },
            () => {
              // EOSE received
              clearTimeout(timeout)
              try { sub?.unsubscribe() } catch {}
              resolve()
            }
          )
        } catch (err) {
          clearTimeout(timeout)
          try { sub?.unsubscribe() } catch {}
          reject(err)
        }
      })

      // Process events
      for (const event of events) {
        handler(event)
        totalFetched++
      }

      // If we got a full page, there might be more
      hasMore = events.length === pageSize

      // Move until backward to the oldest event in this page
      if (events.length > 0) {
        const oldestTimestamp = Math.min(...events.map(e => e.created_at))
        currentUntil = oldestTimestamp - 1
      } else {
        hasMore = false
      }

      // Respect since boundary
      if (currentUntil <= since) {
        hasMore = false
      }
    }

    logger.debug({ kind, totalFetched }, 'Paginated fetch complete')
    return totalFetched
  }

  /**
   * Stop ingestion
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    logger.info('Stopping ingestion')
    this.isRunning = false

    // Unsubscribe from all subscriptions
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []

    logger.info('Ingestion stopped')
  }

  /**
   * Handle monitor announcement event
   */
  private handleMonitorAnnouncement(event: NostrEvent): void {
    try {
      // Record event kind metric
      this.metrics?.recordEvent(10166)

      const monitor = parseMonitorAnnouncement(event)
      if (monitor) {
        this.core.ingest.monitor(monitor)
        this.eventCount++
        this.lastEventTime = Date.now()
        logger.debug({
          pubkey: monitor.pubkey.slice(0, 8),
          frequency: monitor.frequency,
        }, 'Monitor announcement processed')
      }
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Error processing monitor announcement')
    }
  }

  /**
   * Handle relay observation event
   */
  private handleRelayObservation(event: NostrEvent): void {
    try {
      // Record event kind metric
      this.metrics?.recordEvent(30166)

      const observation = parseRelayObservation(event)
      if (observation) {
        this.core.ingest.observations([observation])
        this.eventCount++
        this.lastEventTime = Date.now()
        logger.debug({
          relayUrl: observation.relayUrl,
          author: observation.author.slice(0, 8),
        }, 'Relay observation processed')
      }
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Error processing relay observation')
    }
  }

  /**
   * Start periodic eviction timer
   */
  private startEvictionTimer(): void {
    const evictionInterval = 5 * 60 * 1000 // 5 minutes

    const evict = () => {
      if (!this.isRunning) return

      try {
        const evicted = this.core.evictOld()
        logger.debug({ evicted }, 'Periodic eviction completed')
      } catch (err) {
        logger.error({ err }, 'Error during periodic eviction')
      }

      if (this.isRunning) {
        setTimeout(evict, evictionInterval)
      }
    }

    setTimeout(evict, evictionInterval)
    logger.debug({ intervalMs: evictionInterval }, 'Eviction timer started')
  }

  /**
   * Get ingestion statistics
   */
  getStats(): {
    isRunning: boolean
    eventCount: number
    lastEventTime: number
    historicalCatchupComplete: boolean
    storeStats: ReturnType<StateCore['stats']['get']>
  } {
    return {
      isRunning: this.isRunning,
      eventCount: this.eventCount,
      lastEventTime: this.lastEventTime,
      historicalCatchupComplete: this.historicalCatchupComplete,
      storeStats: this.core.stats.get() as any,
    }
  }
}
