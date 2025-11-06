/**
 * Observation Store
 *
 * In-memory storage for relay observations and monitor announcements
 * with de-duplication and window-based eviction
 */

import type { RelayObservation, MonitorAnnouncement } from '../types/events.js'
import type { AggregationPolicy } from '../types/aggregation.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'observation-store' })


export class ObservationStore {
  // Observations: Map<relayUrl, Map<author, Observation[]>>
  private observations: Map<string, Map<string, RelayObservation[]>> = new Map()

  // Monitors: Map<pubkey, MonitorAnnouncement>
  private monitors: Map<string, MonitorAnnouncement> = new Map()

  // Replaceable event tracking for 30166
  // Map<author, Map<relayUrl, eventId>>
  private replaceableTracking: Map<string, Map<string, string>> = new Map()

  // Event ID set for de-duplication
  private seenEventIds: Set<string> = new Set()

  constructor(private policy: AggregationPolicy) {
    logger.info('Observation store initialized')
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
    if (this.seenEventIds.has(obs.id)) {
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
    this.seenEventIds.add(obs.id)

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
      this.seenEventIds.delete(eventId)
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
   * Get all observations for a relay within the lookback window
   */
  getObservations(relayUrl: string, now: number = Date.now()): RelayObservation[] {
    const relayMap = this.observations.get(relayUrl)
    if (!relayMap) return []

    const cutoff = now / 1000 - this.policy.lookbackSeconds
    const observations: RelayObservation[] = []

    for (const authorObs of relayMap.values()) {
      for (const obs of authorObs) {
        if (obs.created_at >= cutoff) {
          observations.push(obs)
        }
      }
    }

    return observations
  }

  /**
   * Get observations for a relay from a specific author
   */
  getObservationsByAuthor(relayUrl: string, author: string, now: number = Date.now()): RelayObservation[] {
    const relayMap = this.observations.get(relayUrl)
    if (!relayMap) return []

    const authorObs = relayMap.get(author)
    if (!authorObs) return []

    const cutoff = now / 1000 - this.policy.lookbackSeconds

    return authorObs.filter((obs) => obs.created_at >= cutoff)
  }

  /**
   * Get all relay URLs with observations
   */
  getAllRelayUrls(): string[] {
    return Array.from(this.observations.keys())
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
   * Evict old observations outside the lookback window
   */
  evictOldObservations(now: number = Date.now()): number {
    const cutoff = now / 1000 - this.policy.lookbackSeconds
    let evicted = 0

    for (const [relayUrl, relayMap] of this.observations.entries()) {
      for (const [author, authorObs] of relayMap.entries()) {
        const before = authorObs.length

        // Filter out old observations
        const filtered = authorObs.filter((obs) => {
          if (obs.created_at < cutoff) {
            this.seenEventIds.delete(obs.id)
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
  } {
    return {
      relayCount: this.observations.size,
      monitorCount: this.monitors.size,
      observationCount: this.getObservationCount(),
      seenEventCount: this.seenEventIds.size,
    }
  }
}
