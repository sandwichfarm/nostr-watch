/**
 * State Core API
 *
 * Transport-agnostic facade for the relay state machine.
 * This is the public interface consumed by CVM, REST, and other surfaces.
 */

import type { CoreConfig } from './config.js'
import type { RelayObservation, MonitorAnnouncement } from './types/events.js'
import type { RelayState, AggregationPolicy } from './types/aggregation.js'
import { ObservationStore } from './store/observation-store.js'
import { LabelIndexService } from './index/label-index.js'
import { GeoService } from './geo/geo.js'
import { RelayStateManager } from './state/relay-state-manager.js'
import { MonitorScoringService } from './score/monitor-scoring.js'
import { QueryCache } from './cache/cache.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'state-core' })

/**
 * Query interface for relays
 */
export interface RelayQuery {
  /**
   * Get state for a single relay
   */
  getState(relayUrl: string): RelayState | null

  /**
   * Get all relay states
   */
  getAll(): RelayState[]

  /**
   * Search relays with filters
   */
  search(filters: {
    network?: string
    nips?: number[]
    software?: { family?: string; version?: string }
    labels?: { namespace: string; value: string }[]
    maxLatency?: { open?: number; read?: number; write?: number }
    minSupport?: number
  }): RelayState[]

  /**
   * Get online relays
   */
  online(opts?: {
    onlineWindowSeconds?: number
    filters?: { network?: string; labels?: { namespace: string; value: string }[] }
  }): string[]

  /**
   * Get offline relays
   */
  offline(opts?: {
    offlineThresholdSeconds?: number
    deadThresholdSeconds?: number
    filters?: { network?: string; labels?: { namespace: string; value: string }[] }
  }): string[]

  /**
   * Get probably dead relays
   */
  dead(opts?: {
    deadThresholdSeconds?: number
    filters?: { network?: string; labels?: { namespace: string; value: string }[] }
  }): string[]

  /**
   * Get labels for a specific relay
   */
  getLabels(relayUrl: string): Record<string, string[]>

  /**
   * List all available labels
   */
  listLabels(namespace?: string): Array<{ namespace: string; value: string; count: number }>

  /**
   * Find relays by label
   */
  byLabel(namespace: string, value: string): string[]

  /**
   * Group relays by software family
   */
  bySoftware(): Record<string, string[]>

  /**
   * Group relays by network
   */
  byNetwork(): Record<string, string[]>

  /**
   * Group relays by NIP with support ratios
   */
  byNip(): Record<number, { relays: string[]; supportRatio: number }>

  /**
   * Group relays by country
   */
  byCountry(): Record<string, string[]>

  /**
   * Find relays near a point
   */
  nearby(lat: number, lon: number, radiusKm: number): RelayState[]

  /**
   * Find relays in a bounding box
   */
  bbox(sw: { lat: number; lon: number }, ne: { lat: number; lon: number }): RelayState[]

  /**
   * Compare multiple relays side-by-side
   */
  compare(relayUrls: string[]): Array<RelayState | null>
}

/**
 * Query interface for monitors
 */
export interface MonitorQuery {
  /**
   * Get a single monitor by pubkey
   */
  get(pubkey: string): MonitorAnnouncement | undefined

  /**
   * Get all monitors
   */
  getAll(): MonitorAnnouncement[]

  /**
   * Get monitor scores (if scoring enabled)
   */
  getScores(): Record<string, { reliability: number; coverage: number; quality: number }>

  /**
   * Get detailed analytics for a single monitor
   */
  getAnalytics(pubkey: string): import('../types/monitor-scoring.js').MonitorAnalytics | undefined

  /**
   * Get detailed analytics for all monitors
   */
  getAllAnalytics(): import('../types/monitor-scoring.js').MonitorAnalytics[]
}

/**
 * Policy interface
 */
export interface PolicyInterface {
  /**
   * Get current aggregation policy
   */
  get(): AggregationPolicy

  /**
   * Update aggregation policy (will trigger recomputation)
   */
  set(policy: Partial<AggregationPolicy>): void
}

/**
 * Ingestion interface
 */
export interface IngestionInterface {
  /**
   * Ingest a monitor announcement
   */
  monitor(announcement: MonitorAnnouncement): void

  /**
   * Ingest relay observations (batch)
   */
  observations(observations: RelayObservation[]): void
}

/**
 * Statistics interface
 */
export interface StatsInterface {
  /**
   * Get comprehensive stats
   */
  get(): {
    relays: {
      cached: number
      total: number
    }
    observations: {
      count: number
      seenEvents: number
    }
    monitors: {
      count: number
    }
    labels: {
      namespaces: number
      totalLabels: number
    }
    lastComputeTime: number
  }
}

/**
 * State Core handle
 */
export interface StateCore {
  /**
   * Ingest events into the state machine
   */
  ingest: IngestionInterface

  /**
   * Compute aggregated state for all relays
   * Call this periodically or after ingesting new observations
   */
  computeAll(): void

  /**
   * Query interface for relays
   */
  query: {
    relays: RelayQuery
    monitors: MonitorQuery
    policy: PolicyInterface
  }

  /**
   * Statistics
   */
  stats: StatsInterface

  /**
   * Evict old observations outside the lookback window
   */
  evictOld(): number

  /**
   * Get relay URLs that changed in the most recent computeAll() cycle
   */
  getChangedRelays(): string[]

  /**
   * Invalidate cache and force recomputation
   */
  invalidateCache(): void
}

/**
 * Initialize the state core
 */
export function initStateCore(config: CoreConfig): StateCore {
  logger.info({ policy: config.aggregation }, 'Initializing state core')

  // Initialize services
  const observationStore = new ObservationStore(config.aggregation)
  const labelIndex = new LabelIndexService()
  const geoService = new GeoService()
  const queryCache = new QueryCache()

  const stateManager = new RelayStateManager(
    observationStore,
    labelIndex,
    geoService,
    config.aggregation,
    queryCache
  )

  const scoringService = new MonitorScoringService(observationStore, stateManager)
  stateManager.setScoringService(scoringService)

  // Track policy for updates
  let currentPolicy = { ...config.aggregation }

  // Ingestion interface
  const ingest: IngestionInterface = {
    monitor(announcement: MonitorAnnouncement): void {
      observationStore.addMonitor(announcement)
      // Scoring service will pick up monitors via computeAllScores()
    },

    observations(observations: RelayObservation[]): void {
      for (const obs of observations) {
        observationStore.addObservation(obs)
      }
    },
  }

  // Relay query interface
  const relayQuery: RelayQuery = {
    getState(relayUrl: string): RelayState | null {
      return stateManager.getRelayState(relayUrl)
    },

    getAll(): RelayState[] {
      return stateManager.getAllRelayStates()
    },

    search(filters): RelayState[] {
      return stateManager.searchRelays(filters)
    },

    online(opts): string[] {
      return stateManager.getOnlineRelays(opts)
    },

    offline(opts): string[] {
      return stateManager.getOfflineRelays(opts)
    },

    dead(opts): string[] {
      return stateManager.getDeadRelays(opts)
    },

    getLabels(relayUrl: string): Record<string, string[]> {
      return labelIndex.getLabelsForRelay(relayUrl)
    },

    listLabels(namespace?: string): Array<{ namespace: string; value: string; count: number }> {
      const result: Array<{ namespace: string; value: string; count: number }> = []
      const namespaces = namespace ? [namespace] : labelIndex.getNamespaces()

      for (const ns of namespaces) {
        const values = labelIndex.getValues(ns)
        for (const value of values) {
          const relays = labelIndex.getRelaysByLabel(ns, value)
          result.push({ namespace: ns, value, count: relays.length })
        }
      }

      return result
    },

    byLabel(namespace: string, value: string): string[] {
      return labelIndex.getRelaysByLabel(namespace, value)
    },

    bySoftware(): Record<string, string[]> {
      const result: Record<string, string[]> = {}
      for (const state of stateManager.getAllRelayStates()) {
        const family = state.software?.family?.value
        if (family) {
          if (!result[family]) result[family] = []
          result[family].push(state.relayUrl)
        }
      }
      return result
    },

    byNetwork(): Record<string, string[]> {
      const result: Record<string, string[]> = {}
      for (const state of stateManager.getAllRelayStates()) {
        const network = state.network?.value
        if (network) {
          if (!result[network]) result[network] = []
          result[network].push(state.relayUrl)
        }
      }
      return result
    },

    byNip(): Record<number, { relays: string[]; supportRatio: number }> {
      const nipMap: Record<number, string[]> = {}
      const totalRelays = stateManager.getAllRelayStates().length

      for (const state of stateManager.getAllRelayStates()) {
        if (state.nips?.list) {
          for (const nip of state.nips.list) {
            if (!nipMap[nip]) nipMap[nip] = []
            nipMap[nip].push(state.relayUrl)
          }
        }
      }

      const result: Record<number, { relays: string[]; supportRatio: number }> = {}
      for (const [nip, relays] of Object.entries(nipMap)) {
        result[Number(nip)] = {
          relays,
          supportRatio: totalRelays > 0 ? relays.length / totalRelays : 0,
        }
      }
      return result
    },

    byCountry(): Record<string, string[]> {
      const result: Record<string, string[]> = {}

      // Helper to derive country code from state or labels
      const deriveCountryCode = (s: RelayState): string | undefined => {
        if (s.country?.value) return s.country.value
        const labels = s.labels || {}
        const nsCandidates = ['country', 'country_code', 'cc', 'countryCode']
        for (const ns of nsCandidates) {
          const val = labels[ns]?.[0]
          if (typeof val === 'string' && val.length > 0) return val
        }
        return undefined
      }

      for (const state of stateManager.getAllRelayStates()) {
        const code = deriveCountryCode(state)
        if (code) {
          if (!result[code]) result[code] = []
          result[code].push(state.relayUrl)
        }
      }
      return result
    },

    nearby(lat: number, lon: number, radiusKm: number): RelayState[] {
      const statesWithGeo = stateManager.getAllRelayStates().filter((s): s is RelayState & { geo: NonNullable<RelayState['geo']> } => s.geo !== undefined)
      return geoService.findWithinRadius(statesWithGeo, lat, lon, radiusKm)
    },

    bbox(sw: { lat: number; lon: number }, ne: { lat: number; lon: number }): RelayState[] {
      const statesWithGeo = stateManager.getAllRelayStates().filter((s): s is RelayState & { geo: NonNullable<RelayState['geo']> } => s.geo !== undefined)
      return geoService.findWithinBbox(statesWithGeo, sw.lat, sw.lon, ne.lat, ne.lon)
    },

    compare(relayUrls: string[]): Array<RelayState | null> {
      return relayUrls.map((url) => stateManager.getRelayState(url))
    },
  }

  // Monitor query interface
  const monitorQuery: MonitorQuery = {
    get(pubkey: string): MonitorAnnouncement | undefined {
      return observationStore.getMonitor(pubkey)
    },

    getAll(): MonitorAnnouncement[] {
      return observationStore.getAllMonitors()
    },

    getScores(): Record<string, { reliability: number; coverage: number; quality: number }> {
      const result: Record<string, { reliability: number; coverage: number; quality: number }> = {}
      const scores = scoringService.getAllScores()
      const coverages = scoringService.getAllCoverages()

      for (const score of scores) {
        const coverage = coverages.find((c) => c.pubkey === score.pubkey)
        const quality = score.reliabilityScore * (coverage?.relayCount || 1)

        result[score.pubkey] = {
          reliability: score.reliabilityScore,
          coverage: coverage?.relayCount || 0,
          quality,
        }
      }

      return result
    },

    getAnalytics(pubkey: string) {
      return scoringService.getAnalytics(pubkey)
    },

    getAllAnalytics() {
      return scoringService.getAllAnalytics()
    },
  }

  // Policy interface
  const policyInterface: PolicyInterface = {
    get(): AggregationPolicy {
      return { ...currentPolicy }
    },

    set(updates: Partial<AggregationPolicy>): void {
      currentPolicy = { ...currentPolicy, ...updates }
      // Update store policy using proper setter
      observationStore.updatePolicy(currentPolicy)
      // Recompute with new policy
      stateManager.computeAllStates()
      logger.info({ policy: currentPolicy }, 'Policy updated, recomputed all states')
    },
  }

  // Stats interface
  const stats: StatsInterface = {
    get() {
      const storeStats = observationStore.getStats()
      const labelStats = labelIndex.getStats()
      const managerStats = stateManager.getStats()

      return {
        relays: {
          cached: managerStats.cachedRelays,
          total: storeStats.relayCount,
        },
        observations: {
          count: storeStats.observationCount,
          seenEvents: storeStats.seenEventCount,
        },
        monitors: {
          count: storeStats.monitorCount,
        },
        labels: {
          namespaces: labelStats.namespaceCount,
          totalLabels: labelStats.totalValues,
        },
        lastComputeTime: managerStats.lastComputeTime,
      }
    },
  }

  // Return the core handle
  const core: StateCore = {
    ingest,

    computeAll(): void {
      stateManager.computeAllStates()
      scoringService.computeAllScores()
    },

    query: {
      relays: relayQuery,
      monitors: monitorQuery,
      policy: policyInterface,
    },

    stats,

    getChangedRelays(): string[] {
      return stateManager.getLastChangedRelays()
    },

    evictOld(): number {
      return observationStore.evictOldObservations()
    },

    invalidateCache(): void {
      stateManager.invalidateCache()
    },
  }

  logger.info('State core initialized successfully')
  return core
}
