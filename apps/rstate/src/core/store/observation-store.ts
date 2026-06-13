/**
 * Observation Store
 *
 * In-memory storage for relay observations and monitor announcements
 * with de-duplication and window-based eviction
 */

import type { RelayObservation, MonitorAnnouncement, TrustedRelayAssertion } from '../types/events.js'
import type { AggregationPolicy } from '../types/aggregation.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'observation-store' })

export interface ObservationStoreSnapshot {
  monitors: MonitorAnnouncement[]
  observations: RelayObservation[]
  trustedRelayAssertions: TrustedRelayAssertion[]
}

export class ObservationStore {
  // Observations: Map<relayUrl, Map<author, Observation[]>>
  private observations: Map<string, Map<string, RelayObservation[]>> = new Map()

  // Trusted Relay Assertions: Map<relayUrl, Map<author, Assertion>>
  private trustedRelayAssertions: Map<string, Map<string, TrustedRelayAssertion>> = new Map()

  // Monitors: Map<pubkey, MonitorAnnouncement>
  private monitors: Map<string, MonitorAnnouncement> = new Map()

  // Replaceable event tracking for 30166
  // Map<author, Map<relayUrl, eventId>>
  private replaceableTracking: Map<string, Map<string, string>> = new Map()

  // Replaceable event tracking for 30385
  // Map<author, Map<relayUrl, eventId>>
  private trustedAssertionTracking: Map<string, Map<string, string>> = new Map()

  // Event ID sets for de-duplication
  private seenObservationEventIds: Set<string> = new Set()
  private seenTrustedRelayAssertionEventIds: Set<string> = new Set()

  constructor(private policy: AggregationPolicy) {
    logger.info({ windowStrategy: this.policy.windowStrategy }, 'Observation store initialized')
  }

  /**
   * Update the aggregation policy
   */
  updatePolicy(newPolicy: AggregationPolicy): void {
    this.policy = newPolicy
    logger.debug({ policy: newPolicy }, 'Policy updated')
  }

  /**
   * Add a relay observation
   */
  addObservation(obs: RelayObservation): boolean {
    // Check if already seen
    if (this.seenObservationEventIds.has(obs.id)) {
      logger.debug({ eventId: obs.id }, 'Duplicate observation ignored')
      return false
    }

    // Check if this is a replaceable event update
    const authorTracking = this.replaceableTracking.get(obs.author) || new Map()
    const existingEventId = authorTracking.get(obs.relayUrl)

    if (existingEventId) {
      // This is a replacement - remove old observation
      this.removeObservation(obs.relayUrl, obs.author, existingEventId)
    }

    // Update replaceable tracking
    authorTracking.set(obs.relayUrl, obs.id)
    this.replaceableTracking.set(obs.author, authorTracking)

    // Add to observations
    let relayMap = this.observations.get(obs.relayUrl)
    if (!relayMap) {
      relayMap = new Map()
      this.observations.set(obs.relayUrl, relayMap)
    }

    let authorObs = relayMap.get(obs.author)
    if (!authorObs) {
      authorObs = []
      relayMap.set(obs.author, authorObs)
    }

    authorObs.push(obs)
    this.seenObservationEventIds.add(obs.id)

    logger.debug({
      relayUrl: obs.relayUrl,
      author: obs.author.slice(0, 8),
      eventId: obs.id,
    }, 'Observation added')

    return true
  }

  /**
   * Remove a specific observation
   */
  private removeObservation(relayUrl: string, author: string, eventId: string): void {
    const relayMap = this.observations.get(relayUrl)
    if (!relayMap) return

    const authorObs = relayMap.get(author)
    if (!authorObs) return

    const index = authorObs.findIndex((obs) => obs.id === eventId)
    if (index >= 0) {
      authorObs.splice(index, 1)
      this.seenObservationEventIds.delete(eventId)
      logger.debug({ relayUrl, author: author.slice(0, 8), eventId }, 'Observation replaced')
    }

    // Clean up empty maps
    if (authorObs.length === 0) {
      relayMap.delete(author)
    }
    if (relayMap.size === 0) {
      this.observations.delete(relayUrl)
    }
  }

  /**
   * Add or update a monitor announcement
   */
  addMonitor(monitor: MonitorAnnouncement): void {
    const existing = this.monitors.get(monitor.pubkey)

    if (!existing || monitor.lastSeen > existing.lastSeen) {
      this.monitors.set(monitor.pubkey, monitor)
      logger.debug({
        pubkey: monitor.pubkey.slice(0, 8),
        frequency: monitor.frequency,
      }, 'Monitor updated')
    }
  }

  /**
   * Add a trusted relay assertion
   */
  addTrustedRelayAssertion(assertion: TrustedRelayAssertion): boolean {
    if (this.seenTrustedRelayAssertionEventIds.has(assertion.id)) {
      logger.debug({ eventId: assertion.id }, 'Duplicate trusted relay assertion ignored')
      return false
    }

    const authorTracking = this.trustedAssertionTracking.get(assertion.author) || new Map()
    const existingEventId = authorTracking.get(assertion.relayUrl)

    if (existingEventId) {
      this.removeTrustedRelayAssertion(assertion.relayUrl, assertion.author, existingEventId)
    }

    authorTracking.set(assertion.relayUrl, assertion.id)
    this.trustedAssertionTracking.set(assertion.author, authorTracking)

    let relayMap = this.trustedRelayAssertions.get(assertion.relayUrl)
    if (!relayMap) {
      relayMap = new Map()
      this.trustedRelayAssertions.set(assertion.relayUrl, relayMap)
    }

    relayMap.set(assertion.author, assertion)
    this.seenTrustedRelayAssertionEventIds.add(assertion.id)

    logger.debug({
      relayUrl: assertion.relayUrl,
      author: assertion.author.slice(0, 8),
      eventId: assertion.id,
    }, 'Trusted relay assertion added')

    return true
  }

  private removeTrustedRelayAssertion(relayUrl: string, author: string, eventId: string): void {
    const relayMap = this.trustedRelayAssertions.get(relayUrl)
    if (!relayMap) return

    const existing = relayMap.get(author)
    if (existing?.id !== eventId) return

    relayMap.delete(author)
    this.seenTrustedRelayAssertionEventIds.delete(eventId)

    if (relayMap.size === 0) {
      this.trustedRelayAssertions.delete(relayUrl)
    }

    logger.debug({ relayUrl, author: author.slice(0, 8), eventId }, 'Trusted relay assertion replaced')
  }

  /**
   * Get all observations for a relay (returns all retained observations)
   */
  getObservations(relayUrl: string): RelayObservation[] {
    const relayMap = this.observations.get(relayUrl)
    if (!relayMap) return []

    const observations: RelayObservation[] = []

    for (const authorObs of relayMap.values()) {
      for (const obs of authorObs) {
        observations.push(obs)
      }
    }

    return observations
  }

  /**
   * Get observations for a relay from a specific author
   */
  getObservationsByAuthor(relayUrl: string, author: string, _now?: number): RelayObservation[] {
    const relayMap = this.observations.get(relayUrl)
    if (!relayMap) return []

    const authorObs = relayMap.get(author)
    if (!authorObs) return []

    return [...authorObs]
  }

  /**
   * Get all relay URLs with observations
   */
  getAllRelayUrls(): string[] {
    return Array.from(this.observations.keys())
  }

  /**
   * Get trusted relay assertions for a relay
   */
  getTrustedRelayAssertions(relayUrl: string): TrustedRelayAssertion[] {
    const relayMap = this.trustedRelayAssertions.get(relayUrl)
    if (!relayMap) return []
    return Array.from(relayMap.values())
  }

  /**
   * Get monitor by pubkey
   */
  getMonitor(pubkey: string): MonitorAnnouncement | undefined {
    return this.monitors.get(pubkey)
  }

  /**
   * Get all monitors
   */
  getAllMonitors(): MonitorAnnouncement[] {
    return Array.from(this.monitors.values())
  }

  /**
   * Get total observation count
   */
  getObservationCount(): number {
    let count = 0
    for (const relayMap of this.observations.values()) {
      for (const authorObs of relayMap.values()) {
        count += authorObs.length
      }
    }
    return count
  }

  /**
   * Get total trusted relay assertion count
   */
  getTrustedRelayAssertionCount(): number {
    let count = 0
    for (const relayMap of this.trustedRelayAssertions.values()) {
      count += relayMap.size
    }
    return count
  }

  /**
   * Export current retained store state for persistence.
   */
  exportSnapshot(): ObservationStoreSnapshot {
    const observations: RelayObservation[] = []
    for (const relayMap of this.observations.values()) {
      for (const authorObs of relayMap.values()) {
        observations.push(...authorObs)
      }
    }

    const trustedRelayAssertions: TrustedRelayAssertion[] = []
    for (const relayMap of this.trustedRelayAssertions.values()) {
      trustedRelayAssertions.push(...relayMap.values())
    }

    return {
      monitors: this.getAllMonitors(),
      observations,
      trustedRelayAssertions,
    }
  }

  /**
   * Replace store state from a persisted snapshot.
   */
  importSnapshot(snapshot: ObservationStoreSnapshot): void {
    this.observations.clear()
    this.trustedRelayAssertions.clear()
    this.monitors.clear()
    this.replaceableTracking.clear()
    this.trustedAssertionTracking.clear()
    this.seenObservationEventIds.clear()
    this.seenTrustedRelayAssertionEventIds.clear()

    for (const monitor of snapshot.monitors) {
      this.addMonitor(monitor)
    }

    for (const observation of snapshot.observations) {
      this.addObservation(observation)
    }

    for (const assertion of snapshot.trustedRelayAssertions) {
      this.addTrustedRelayAssertion(assertion)
    }

    logger.info({
      monitors: snapshot.monitors.length,
      observations: snapshot.observations.length,
      trustedRelayAssertions: snapshot.trustedRelayAssertions.length,
    }, 'Observation store snapshot imported')
  }

  /**
   * Get dynamic retention seconds based on monitor frequencies.
   * Uses 3x the slowest monitor's frequency (floor 1h, fallback 24h when no monitors).
   */
  private getRetentionSeconds(): number {
    const monitors = this.getAllMonitors()
    if (monitors.length === 0) return 86400 // 24h fallback when no monitors yet
    const maxFreq = Math.max(...monitors.map(m => m.frequency))
    return Math.max(maxFreq * 3, 3600) // 3× slowest monitor, floor 1h
  }

  /**
   * Evict old observations outside the dynamic retention window
   */
  evictOldObservations(now: number = Date.now()): number {
    const cutoff = now / 1000 - this.getRetentionSeconds()
    let evicted = 0

    for (const [relayUrl, relayMap] of this.observations.entries()) {
      for (const [author, authorObs] of relayMap.entries()) {
        const before = authorObs.length

        // Filter out old observations
        const filtered = authorObs.filter((obs) => {
          if (obs.created_at < cutoff) {
            this.seenObservationEventIds.delete(obs.id)
            return false
          }
          return true
        })

        evicted += before - filtered.length

        if (filtered.length === 0) {
          relayMap.delete(author)
        } else if (filtered.length !== before) {
          relayMap.set(author, filtered)
        }
      }

      if (relayMap.size === 0) {
        this.observations.delete(relayUrl)
      }
    }

    if (evicted > 0) {
      logger.info({ evicted, cutoff }, 'Evicted old observations')
    }

    return evicted
  }

  /**
   * Get statistics
   */
  getStats(): {
    relayCount: number
    monitorCount: number
    observationCount: number
    seenEventCount: number
    trustedRelayAssertionCount: number
    trustedRelayAssertionSeenEventCount: number
  } {
    return {
      relayCount: this.observations.size,
      monitorCount: this.monitors.size,
      observationCount: this.getObservationCount(),
      seenEventCount: this.seenObservationEventIds.size,
      trustedRelayAssertionCount: this.getTrustedRelayAssertionCount(),
      trustedRelayAssertionSeenEventCount: this.seenTrustedRelayAssertionEventIds.size,
    }
  }
}
