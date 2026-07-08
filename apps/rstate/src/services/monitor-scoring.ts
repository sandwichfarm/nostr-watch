/**
 * Monitor Scoring Service
 *
 * Tracks monitor reliability and coverage for weighted aggregation
 */

import type { ObservationStore } from './observation-store.js'
import type { RelayStateManager } from './relay-state-manager.js'
import type {
  MonitorScore,
  MonitorCoverage,
  MonitorAnalytics,
  ScoringPolicy,
} from '../types/monitor-scoring.js'
import type { RelayObservation } from '../types/events.js'
import { DEFAULT_SCORING_POLICY } from '../types/monitor-scoring.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'monitor-scoring' })

export class MonitorScoringService {
  private scores: Map<string, MonitorScore> = new Map()
  private coverages: Map<string, MonitorCoverage> = new Map()

  constructor(
    private observationStore: ObservationStore,
    private stateManager: RelayStateManager,
    private policy: ScoringPolicy = DEFAULT_SCORING_POLICY
  ) {
    logger.info('Monitor scoring service initialized')
  }

  /**
   * Compute scores for all monitors
   */
  computeAllScores(now: number = Date.now()): void {
    const monitors = this.observationStore.getAllMonitors()

    for (const monitor of monitors) {
      this.computeMonitorScore(monitor.pubkey, now)
      this.computeMonitorCoverage(monitor.pubkey)
    }

    logger.debug({ monitorCount: monitors.length }, 'Monitor scores computed')
  }

  /**
   * Compute reliability score for a monitor
   */
  private computeMonitorScore(pubkey: string, now: number): void {
    const monitor = this.observationStore.getMonitor(pubkey)
    if (!monitor) return

    // Collect all observations from this monitor
    const allRelayUrls = this.observationStore.getAllRelayUrls()
    const observations: RelayObservation[] = []

    for (const relayUrl of allRelayUrls) {
      const obs = this.observationStore.getObservationsByAuthor(relayUrl, pubkey)
      observations.push(...obs)
    }

    // Need minimum observations for scoring
    if (observations.length < this.policy.minObservationsForScore) {
      return
    }

    // Sort by timestamp
    observations.sort((a, b) => a.created_at - b.created_at)

    // Compute component scores
    const timelinessScore = this.computeTimelinessScore(observations, monitor.frequency, now)
    const consistencyScore = this.computeConsistencyScore(observations, now)
    const errorRate = this.computeErrorRate(observations)

    // Weighted reliability score
    const reliabilityScore =
      timelinessScore * this.policy.timelinessWeight +
      consistencyScore * this.policy.consistencyWeight +
      (1 - errorRate) * this.policy.errorWeight

    this.scores.set(pubkey, {
      pubkey,
      reliabilityScore,
      timelinessScore,
      consistencyScore,
      errorRate,
      lastUpdated: now,
      observationCount: observations.length,
    })
  }

  /**
   * Compute timeliness score (0-1, higher is better)
   */
  private computeTimelinessScore(
    observations: RelayObservation[],
    frequency: number | undefined,
    now: number
  ): number {
    if (!frequency || observations.length < 2) return 1.0

    const expectedInterval = frequency
    const lateThreshold = expectedInterval * this.policy.lateThresholdMultiplier

    let onTimeCount = 0
    let totalIntervals = 0

    // Check intervals between consecutive observations
    for (let i = 1; i < observations.length; i++) {
      const interval = observations[i].created_at - observations[i - 1].created_at
      const weight = this.computeDecayWeight(observations[i].created_at, now)

      if (interval <= lateThreshold) {
        onTimeCount += weight
      }
      totalIntervals += weight
    }

    return totalIntervals > 0 ? onTimeCount / totalIntervals : 1.0
  }

  /**
   * Compute consistency score (agreement with consensus)
   */
  private computeConsistencyScore(observations: RelayObservation[], now: number): number {
    if (observations.length === 0) return 1.0

    let consistentCount = 0
    let totalCount = 0

    // Group observations by relay
    const byRelay = new Map<string, RelayObservation[]>()
    for (const obs of observations) {
      if (!byRelay.has(obs.relayUrl)) {
        byRelay.set(obs.relayUrl, [])
      }
      byRelay.get(obs.relayUrl)!.push(obs)
    }

    // For each relay, check if this monitor's observations align with consensus
    for (const [relayUrl, relayObs] of byRelay.entries()) {
      const consensusState = this.stateManager.getRelayState(relayUrl)
      if (!consensusState) continue

      for (const obs of relayObs) {
        const weight = this.computeDecayWeight(obs.created_at, now)

        // Check agreement on key metrics
        let agreements = 0
        let checks = 0

        // Network agreement
        if (consensusState.network?.value && obs.network) {
          checks++
          if (consensusState.network.value === obs.network) {
            agreements++
          }
        }

        // RTT agreement (within 2x MAD)
        if (consensusState.rtt?.open?.value && obs.rtt?.open) {
          checks++
          const consensusRtt = consensusState.rtt.open.value
          const mad = consensusState.rtt.open.mad || consensusRtt * 0.5
          if (Math.abs(obs.rtt.open - consensusRtt) <= 2 * mad) {
            agreements++
          }
        }

        // NIP agreement (majority overlap)
        if (consensusState.nips?.list && obs.nips) {
          checks++
          const consensusNips = new Set(consensusState.nips.list)
          const obsNips = new Set(obs.nips)
          const intersection = new Set([...obsNips].filter(nip => consensusNips.has(nip)))
          const union = new Set([...obsNips, ...consensusNips])
          const jaccard = intersection.size / union.size
          if (jaccard >= 0.5) {
            agreements++
          }
        }

        if (checks > 0) {
          const agreementRatio = agreements / checks
          consistentCount += agreementRatio * weight
          totalCount += weight
        }
      }
    }

    return totalCount > 0 ? consistentCount / totalCount : 1.0
  }

  /**
   * Compute error rate (0-1, lower is better)
   */
  private computeErrorRate(observations: RelayObservation[]): number {
    if (observations.length === 0) return 0

    // Count observations with error indicators
    // (In NIP-66, errors might be signaled via tags or absence of expected data)
    let errorCount = 0

    for (const obs of observations) {
      // Consider missing RTT as potential error
      if (!obs.rtt?.open && !obs.rtt?.read && !obs.rtt?.write) {
        errorCount++
      }
    }

    return errorCount / observations.length
  }

  /**
   * Compute exponential decay weight
   */
  private computeDecayWeight(timestamp: number, now: number): number {
    const age = now / 1000 - timestamp
    const lambda = Math.log(2) / this.policy.decayHalfLife
    return Math.exp(-lambda * age)
  }

  /**
   * Compute coverage analytics for a monitor
   */
  private computeMonitorCoverage(pubkey: string): void {
    const monitor = this.observationStore.getMonitor(pubkey)
    if (!monitor) return

    // Collect all observations from this monitor
    const allRelayUrls = this.observationStore.getAllRelayUrls()
    const observations: RelayObservation[] = []
    const relayUrlsSet = new Set<string>()
    const namespacesSet = new Set<string>()

    for (const relayUrl of allRelayUrls) {
      const obs = this.observationStore.getObservationsByAuthor(relayUrl, pubkey)
      observations.push(...obs)

      for (const o of obs) {
        relayUrlsSet.add(o.relayUrl)

        // Track namespaces
        if (o.labels) {
          for (const label of o.labels) {
            namespacesSet.add(label.namespace)
          }
        }
      }
    }

    // Determine check coverage from monitor announcement
    const checks = {
      open: !!monitor.checks?.includes('ws'),
      read: !!monitor.checks?.includes('read'),
      write: !!monitor.checks?.includes('write'),
      info: !!monitor.checks?.includes('nip11'),
      dns: !!monitor.checks?.includes('dns'),
      geo: !!monitor.checks?.includes('geo'),
    }

    // Count total labels
    let labelCount = 0
    for (const obs of observations) {
      if (obs.labels) {
        labelCount += obs.labels.length
      }
    }

    this.coverages.set(pubkey, {
      pubkey,
      relayCount: relayUrlsSet.size,
      relayUrls: Array.from(relayUrlsSet),
      checks,
      namespaces: Array.from(namespacesSet),
      labelCount,
      firstSeen: observations.length > 0 ? Math.min(...observations.map(o => o.created_at)) : monitor.lastSeen,
      lastSeen: monitor.lastSeen,
      frequency: monitor.frequency,
    })
  }

  /**
   * Get score for a monitor
   */
  getScore(pubkey: string): MonitorScore | undefined {
    return this.scores.get(pubkey)
  }

  /**
   * Get coverage for a monitor
   */
  getCoverage(pubkey: string): MonitorCoverage | undefined {
    return this.coverages.get(pubkey)
  }

  /**
   * Get analytics for a monitor (score + coverage)
   */
  getAnalytics(pubkey: string): MonitorAnalytics | undefined {
    const score = this.scores.get(pubkey)
    const coverage = this.coverages.get(pubkey)

    if (!score || !coverage) return undefined

    return { pubkey, score, coverage }
  }

  /**
   * Get all monitor scores
   */
  getAllScores(): MonitorScore[] {
    return Array.from(this.scores.values())
  }

  /**
   * Get all monitor coverages
   */
  getAllCoverages(): MonitorCoverage[] {
    return Array.from(this.coverages.values())
  }

  /**
   * Get all monitor analytics
   */
  getAllAnalytics(): MonitorAnalytics[] {
    const analytics: MonitorAnalytics[] = []

    for (const pubkey of this.scores.keys()) {
      const result = this.getAnalytics(pubkey)
      if (result) {
        analytics.push(result)
      }
    }

    return analytics
  }

  /**
   * Get author weights for aggregation (keyed by pubkey)
   */
  getAuthorWeights(): Map<string, number> {
    const weights = new Map<string, number>()

    for (const [pubkey, score] of this.scores.entries()) {
      // Use reliability score as weight, with floor of 0.1
      const weight = Math.max(0.1, score.reliabilityScore)
      weights.set(pubkey, weight)
    }

    // Monitors without scores get default weight of 1.0
    const monitors = this.observationStore.getAllMonitors()
    for (const monitor of monitors) {
      if (!weights.has(monitor.pubkey)) {
        weights.set(monitor.pubkey, 1.0)
      }
    }

    return weights
  }

  /**
   * Get statistics
   */
  getStats(): {
    scoredMonitorCount: number
    avgReliabilityScore: number
    avgCoverageRelayCount: number
  } {
    const scores = Array.from(this.scores.values())
    const coverages = Array.from(this.coverages.values())

    return {
      scoredMonitorCount: scores.length,
      avgReliabilityScore: scores.length > 0
        ? scores.reduce((sum, s) => sum + s.reliabilityScore, 0) / scores.length
        : 0,
      avgCoverageRelayCount: coverages.length > 0
        ? coverages.reduce((sum, c) => sum + c.relayCount, 0) / coverages.length
        : 0,
    }
  }
}
