/**
 * Relay State Manager
 *
 * Coordinates observation storage, aggregation, label indexing, and geo processing
 */

import type { AggregationPolicy, RelayState } from '../types/aggregation.js'
import { ObservationStore } from '../store/observation-store.js'
import { computeRelayState } from '../agg/aggregation.js'
import { LabelIndexService } from '../index/label-index.js'
import { GeoService } from '../geo/geo.js'
import type { QueryCache } from '../cache/cache.js'
import type { MonitorScoringService } from '../score/monitor-scoring.js'
import { normalizeCountryCode } from '../agg/country.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'relay-state-manager' })

export class RelayStateManager {
  private stateCache: Map<string, RelayState> = new Map()
  private lastComputeTime: number = 0
  private scoringService?: MonitorScoringService

  constructor(
    private observationStore: ObservationStore,
    private labelIndex: LabelIndexService,
    private geoService: GeoService,
    private policy: AggregationPolicy,
    private queryCache?: QueryCache
  ) {
    logger.info('Relay state manager initialized')
  }

  /**
   * Wire scoring service for weighted aggregation
   * Called after construction to break circular dependency
   */
  setScoringService(scoringService: MonitorScoringService): void {
    this.scoringService = scoringService
    logger.debug('Scoring service wired for weighted aggregation')
  }

  /**
   * Compute fresh state for a single relay
   * Uses monitor quality weights if scoring service is available
   */
  computeRelayState(relayUrl: string): RelayState | null {
    const observations = this.observationStore.getObservations(relayUrl)
    if (observations.length === 0) {
      return null
    }

    try {
      // Get monitor weights if scoring service available
      const weights = this.scoringService?.getAuthorWeights()

      // Compute state with optional weights
      const state = computeRelayState(relayUrl, observations, this.policy, weights)

      // Add availability timestamps
      const lastSeenAt = Math.max(...observations.map(o => o.created_at))
      const openObs = observations.filter(o => o.rtt?.open !== undefined)
      const lastOpenAt = openObs.length > 0 ? Math.max(...openObs.map(o => o.created_at)) : undefined
      state.lastSeenAt = lastSeenAt
      if (lastOpenAt !== undefined) state.lastOpenAt = lastOpenAt

      // Add geo information
      this.geoService.addGeoToState(state, observations)

      // Add labels to state
      state.labels = this.labelIndex.getLabelsForRelay(relayUrl)

      // Extract country from observation labels, normalize to Alpha-2, majority-wins vote
      const countryVotes: Array<{ code: string; author: string; timestamp: number }> = []
      for (const obs of observations) {
        if (!obs.labels) continue
        for (const label of obs.labels) {
          if (label.namespace === 'nip32.geo') {
            countryVotes.push({
              code: normalizeCountryCode(label.value),
              author: obs.author,
              timestamp: obs.created_at,
            })
          }
        }
      }

      if (countryVotes.length > 0) {
        // Group by normalized code, count votes
        const buckets = new Map<string, typeof countryVotes>()
        for (const vote of countryVotes) {
          if (!buckets.has(vote.code)) buckets.set(vote.code, [])
          buckets.get(vote.code)!.push(vote)
        }

        // Pick majority; tiebreak by most recent observation
        let bestCode = countryVotes[0].code
        let bestCount = 0
        let bestLatest = 0
        for (const [code, votes] of buckets.entries()) {
          const latest = Math.max(...votes.map(v => v.timestamp))
          if (votes.length > bestCount || (votes.length === bestCount && latest > bestLatest)) {
            bestCount = votes.length
            bestLatest = latest
            bestCode = code
          }
        }

        const winners = buckets.get(bestCode)!
        const contributingAuthors = Array.from(new Set(winners.map(v => v.author)))

        state.country = {
          value: bestCode,
          support: winners.length / countryVotes.length,
          sampleSize: countryVotes.length,
          contributingAuthors,
          lastUpdated: Date.now(),
        }
      }

      return state
    } catch (err) {
      logger.error({ err, relayUrl }, 'Failed to compute relay state')
      return null
    }
  }

  /**
   * Compute state for all relays and update cache
   */
  computeAllStates(): void {
    logger.info('Computing states for all relays')
    const start = Date.now()

    const relayUrls = this.observationStore.getAllRelayUrls()

    // Rebuild label index FIRST so it's available during state computation
    const allObservations = relayUrls.flatMap((url) => this.observationStore.getObservations(url))
    this.labelIndex.indexObservations(allObservations)

    const newCache = new Map<string, RelayState>()
    const changedRelays: string[] = []

    for (const relayUrl of relayUrls) {
      const state = this.computeRelayState(relayUrl)
      if (state) {
        // Check if state actually changed
        const oldState = this.stateCache.get(relayUrl)
        const stateChanged = !oldState || this.hasStateChanged(oldState, state)

        if (stateChanged) {
          changedRelays.push(relayUrl)
        }

        newCache.set(relayUrl, state)
      }
    }

    this.stateCache = newCache
    this.lastComputeTime = Date.now()

    const duration = Date.now() - start
    logger.info({
      relayCount: this.stateCache.size,
      changedCount: changedRelays.length,
      durationMs: duration,
    }, 'State computation completed')

    // Selectively invalidate caches for changed relays only
    if (this.queryCache && changedRelays.length > 0) {
      this.invalidateAffectedCaches(changedRelays)
    }
  }

  /**
   * Check if relay state has materially changed
   */
  private hasStateChanged(oldState: RelayState, newState: RelayState): boolean {
    // Check key fields that affect query results
    return (
      oldState.network?.value !== newState.network?.value ||
      oldState.software?.family?.value !== newState.software?.family?.value ||
      JSON.stringify(oldState.nips?.list) !== JSON.stringify(newState.nips?.list) ||
      JSON.stringify(oldState.labels) !== JSON.stringify(newState.labels) ||
      Math.abs((oldState.rtt?.open?.value || 0) - (newState.rtt?.open?.value || 0)) > 50 || // 50ms RTT change threshold
      oldState.lastSeenAt !== newState.lastSeenAt ||
      oldState.lastOpenAt !== newState.lastOpenAt
    )
  }

  /**
   * Invalidate only caches affected by specific relay changes
   */
  private invalidateAffectedCaches(changedRelays: string[]): void {
    if (!this.queryCache) return

    for (const relayUrl of changedRelays) {
      const state = this.stateCache.get(relayUrl)
      if (!state) continue

      // Invalidate specific relay state cache
      this.queryCache.invalidate(this.queryCache.relayStateKey(relayUrl))

      // Invalidate group caches that include this relay
      if (state.network?.value) {
        this.queryCache.invalidate(this.queryCache.relayGroupKey('network'))
      }

      if (state.software?.family?.value) {
        this.queryCache.invalidate(this.queryCache.relayGroupKey('software', state.software.family.value))
      }

      if (state.nips?.list) {
        for (const nip of state.nips.list) {
          this.queryCache.invalidate(this.queryCache.relayGroupKey('nip', nip.toString()))
        }
      }

      if (state.labels) {
        for (const [namespace, values] of Object.entries(state.labels)) {
          for (const value of values) {
            this.queryCache.invalidate(this.queryCache.relayGroupKey('label', `${namespace}:${value}`))
          }
        }
      }

      if (state.country?.value) {
        this.queryCache.invalidate(this.queryCache.relayGroupKey('country', state.country.value))
      }
    }

    // Invalidate list/search caches (these aggregate across all relays)
    // These need broader invalidation since they depend on relative rankings
    this.queryCache.invalidate('list:')
    this.queryCache.invalidate('search:')

    logger.debug({
      changedRelays: changedRelays.length,
    }, 'Selectively invalidated affected caches')
  }

  /**
   * Get cached state for a relay (compute if not cached)
   */
  getRelayState(relayUrl: string): RelayState | null {
    // Check cache first
    const cached = this.stateCache.get(relayUrl)
    if (cached) return cached

    // Compute on demand
    const computed = this.computeRelayState(relayUrl)
    if (computed) {
      this.stateCache.set(relayUrl, computed)
      return computed
    }
    return null
  }

  /**
   * Get all cached relay states
   */
  getAllRelayStates(): RelayState[] {
    return Array.from(this.stateCache.values())
  }

  /**
   * Availability queries
   */
  getOnlineRelays(opts: { onlineWindowSeconds?: number; filters?: { network?: string; labels?: { namespace: string; value: string }[] } } = {}): string[] {
    const now = Math.floor(Date.now() / 1000)
    const windowSec = opts.onlineWindowSeconds ?? this.policy.lookbackSeconds
    return this.filterRelaysBy(opts.filters).filter(r => (r.lastOpenAt ?? 0) >= (now - windowSec)).map(r => r.relayUrl)
  }

  getOfflineRelays(opts: { offlineSeenSeconds?: number; offlineThresholdSeconds?: number; filters?: { network?: string; labels?: { namespace: string; value: string }[] } } = {}): string[] {
    const now = Math.floor(Date.now() / 1000)
    const seenSec = opts.offlineSeenSeconds ?? this.policy.lookbackSeconds
    const thresholdSec = opts.offlineThresholdSeconds ?? 3600
    return this.filterRelaysBy(opts.filters)
      .filter(r => (r.lastSeenAt ?? 0) >= (now - seenSec))
      .filter(r => (r.lastOpenAt ?? 0) < (now - thresholdSec))
      .map(r => r.relayUrl)
  }

  getDeadRelays(opts: { deadThresholdSeconds?: number; filters?: { network?: string; labels?: { namespace: string; value: string }[] } } = {}): string[] {
    const now = Math.floor(Date.now() / 1000)
    const deadSec = opts.deadThresholdSeconds ?? 7 * 24 * 3600
    return this.filterRelaysBy(opts.filters)
      .filter(r => (r.lastSeenAt ?? 0) < (now - deadSec))
      .map(r => r.relayUrl)
  }

  private filterRelaysBy(filters?: { network?: string; labels?: { namespace: string; value: string }[] }): RelayState[] {
    let results = this.getAllRelayStates()
    if (!filters) return results
    if (filters.network) {
      results = results.filter(r => r.network?.value === filters.network)
    }
    if (filters.labels && filters.labels.length > 0) {
      results = results.filter(r => {
        if (!r.labels) return false
        return filters.labels!.every(l => {
          const vals = (r.labels![l.namespace] || []).map(v => v.toLowerCase().trim())
          return vals.includes(l.value.toLowerCase().trim())
        })
      })
    }
    return results
  }

  /**
   * Search relays with filters
   */
  searchRelays(filters: {
    network?: string
    nips?: number[]
    software?: { family?: string; version?: string }
    labels?: { namespace: string; value: string }[]
    maxLatency?: { open?: number; read?: number; write?: number }
    minSupport?: number
  }): RelayState[] {
    let results = this.getAllRelayStates()
    if (!filters) return results

    // Filter by network
    if (filters.network) {
      results = results.filter((r) => r.network?.value === filters.network)
    }

    // Filter by NIPs (must support ALL)
    if (filters.nips && filters.nips.length > 0) {
      results = results.filter((r) => {
        if (!r.nips) return false
        return filters.nips!.every((nip) => r.nips!.list.includes(nip))
      })
    }

    // Filter by software
    if (filters.software?.family) {
      results = results.filter((r) => r.software?.family?.value === filters.software!.family)
    }

    // Filter by labels
    if (filters.labels && filters.labels.length > 0) {
      results = results.filter((r) => {
        if (!r.labels) return false
        return filters.labels!.every((label) => {
          const values = (r.labels![label.namespace] || []).map(v => v.toLowerCase().trim())
          return values.includes(label.value.toLowerCase().trim())
        })
      })
    }

    // Filter by max latency
    if (filters.maxLatency) {
      if (filters.maxLatency.open !== undefined) {
        results = results.filter((r) =>
          r.rtt?.open && r.rtt.open.value <= filters.maxLatency!.open!
        )
      }
      if (filters.maxLatency.read !== undefined) {
        results = results.filter((r) =>
          r.rtt?.read && r.rtt.read.value <= filters.maxLatency!.read!
        )
      }
    }

    // Filter by min support
    if (filters.minSupport !== undefined) {
      results = results.filter((r) => {
        // Check if any aggregate has sufficient support
        return r.network && r.network.support >= filters.minSupport!
      })
    }

    return results
  }

  /**
   * Get statistics
   */
  getStats(): {
    cachedRelays: number
    lastComputeTime: number
    labelStats: ReturnType<LabelIndexService['getStats']>
    storeStats: ReturnType<ObservationStore['getStats']>
  } {
    return {
      cachedRelays: this.stateCache.size,
      lastComputeTime: this.lastComputeTime,
      labelStats: this.labelIndex.getStats(),
      storeStats: this.observationStore.getStats(),
    }
  }

  /**
   * Invalidate cache and force recomputation
   */
  invalidateCache(): void {
    this.stateCache.clear()
    logger.debug('Cache invalidated')
  }
}
