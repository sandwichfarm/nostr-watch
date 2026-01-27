/**
 * Metrics Service
 *
 * Collects and aggregates operational metrics for observability
 */

import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'metrics' })

export interface MetricsSnapshot {
  // Ingestion metrics
  ingestion: {
    eventsPerSecond: number
    eventsByKind: Record<number, number>
    lag: number  // seconds behind real-time
    historicalCatchupComplete: boolean
  }

  // Observation metrics
  observations: {
    totalCount: number
    relayCount: number
    monitorCount: number
    avgObservationsPerRelay: number
  }

  // Aggregation metrics
  aggregation: {
    lastComputeTime: number
    lastComputeDuration: number
    relaysCached: number
  }

  // Subscription metrics
  subscriptions: {
    activeSubscriptions: number
    notificationQueueDepth: number
    debounceTimers: number
  }

  // Monitor scoring metrics
  scoring: {
    scoredMonitors: number
    avgReliabilityScore: number
    avgCoverageRelayCount: number
  }

  // Cache metrics
  cache: {
    size: number
    expired: number
  }

  // Rate limiting metrics
  rateLimiting: {
    clientCount: number
  }

  // Method latencies (P50, P95, P99 in ms)
  methodLatencies?: Record<string, {
    count: number
    p50: number
    p95: number
    p99: number
  }>
}

interface LatencySample {
  method: string
  latency: number
  timestamp: number
}

export class MetricsService {
  private latencySamples: LatencySample[] = []
  private maxSamples: number = 10000

  // Event counters
  private eventCounts: Map<number, number> = new Map()
  private eventCountWindow: number = 60 * 1000  // 1 minute window

  // Timing metrics
  private lastAggregationTime: number = 0
  private lastAggregationDuration: number = 0

  constructor() {
    logger.info('Metrics service initialized')
  }

  /**
   * Record method latency
   */
  recordLatency(method: string, latencyMs: number): void {
    this.latencySamples.push({
      method,
      latency: latencyMs,
      timestamp: Date.now(),
    })

    // Keep only recent samples
    if (this.latencySamples.length > this.maxSamples) {
      const cutoff = Date.now() - 5 * 60 * 1000  // 5 minutes
      this.latencySamples = this.latencySamples.filter(s => s.timestamp > cutoff)
    }
  }

  /**
   * Record event ingestion
   */
  recordEvent(kind: number): void {
    const count = this.eventCounts.get(kind) || 0
    this.eventCounts.set(kind, count + 1)
  }

  /**
   * Record aggregation timing
   */
  recordAggregation(durationMs: number): void {
    this.lastAggregationTime = Date.now()
    this.lastAggregationDuration = durationMs
  }

  /**
   * Compute method latency percentiles
   */
  private computeLatencies(): Record<string, any> {
    const now = Date.now()
    const windowMs = 5 * 60 * 1000  // 5 minute window
    const cutoff = now - windowMs

    // Group by method
    const byMethod = new Map<string, number[]>()

    for (const sample of this.latencySamples) {
      if (sample.timestamp < cutoff) continue

      let latencies = byMethod.get(sample.method)
      if (!latencies) {
        latencies = []
        byMethod.set(sample.method, latencies)
      }
      latencies.push(sample.latency)
    }

    // Compute percentiles per method
    const result: Record<string, any> = {}

    for (const [method, latencies] of byMethod.entries()) {
      if (latencies.length === 0) continue

      latencies.sort((a, b) => a - b)

      const p50 = latencies[Math.floor(latencies.length * 0.50)]
      const p95 = latencies[Math.floor(latencies.length * 0.95)]
      const p99 = latencies[Math.floor(latencies.length * 0.99)]

      result[method] = {
        count: latencies.length,
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
      }
    }

    return result
  }

  /**
   * Compute events per second
   */
  private computeEventsPerSecond(): number {
    let total = 0
    for (const count of this.eventCounts.values()) {
      total += count
    }
    return total / (this.eventCountWindow / 1000)
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(
    ingestionStats: any,
    observationStats: any,
    stateManager: any,
    subscriptionStats: any,
    scoringStats: any,
    cacheStats: any,
    rateLimitStats: any
  ): MetricsSnapshot {
    const now = Date.now()
    const lag = ingestionStats.lastEventTime > 0
      ? Math.floor((now - ingestionStats.lastEventTime) / 1000)
      : 0

    return {
      ingestion: {
        eventsPerSecond: this.computeEventsPerSecond(),
        eventsByKind: Object.fromEntries(this.eventCounts.entries()),
        lag,
        historicalCatchupComplete: ingestionStats.historicalCatchupComplete,
      },

      observations: {
        totalCount: observationStats.observationCount,
        relayCount: observationStats.relayCount,
        monitorCount: observationStats.monitorCount,
        avgObservationsPerRelay: observationStats.relayCount > 0
          ? Math.round(observationStats.observationCount / observationStats.relayCount)
          : 0,
      },

      aggregation: {
        lastComputeTime: this.lastAggregationTime,
        lastComputeDuration: this.lastAggregationDuration,
        relaysCached: stateManager ? stateManager.getRelayCount() : 0,
      },

      subscriptions: {
        activeSubscriptions: subscriptionStats.subscriptionCount,
        notificationQueueDepth: subscriptionStats.queueSize,
        debounceTimers: subscriptionStats.debounceTimerCount,
      },

      scoring: {
        scoredMonitors: scoringStats.scoredMonitorCount,
        avgReliabilityScore: Math.round(scoringStats.avgReliabilityScore * 100) / 100,
        avgCoverageRelayCount: Math.round(scoringStats.avgCoverageRelayCount),
      },

      cache: {
        size: cacheStats.size,
        expired: cacheStats.expired,
      },

      rateLimiting: {
        clientCount: rateLimitStats.clientCount,
      },

      methodLatencies: this.computeLatencies(),
    }
  }

  /**
   * Reset event counters (call periodically)
   */
  resetEventCounters(): void {
    this.eventCounts.clear()
  }

  /**
   * Check if metrics indicate healthy operation
   */
  checkHealth(snapshot: MetricsSnapshot): {
    healthy: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // Check ingestion lag
    if (snapshot.ingestion.lag > 300) {  // 5 minutes
      issues.push(`High ingestion lag: ${snapshot.ingestion.lag}s`)
    }

    // Check notification backpressure
    if (snapshot.subscriptions.notificationQueueDepth > 5000) {
      issues.push(`High notification queue: ${snapshot.subscriptions.notificationQueueDepth}`)
    }

    // Check aggregation staleness
    const now = Date.now()
    const aggregationAge = (now - snapshot.aggregation.lastComputeTime) / 1000
    if (aggregationAge > 120) {  // 2 minutes
      issues.push(`Stale aggregation: ${Math.round(aggregationAge)}s old`)
    }

    // Check if we have any data
    if (snapshot.observations.relayCount === 0 && snapshot.ingestion.historicalCatchupComplete) {
      issues.push('No relays observed after historical catchup')
    }

    return {
      healthy: issues.length === 0,
      issues,
    }
  }
}
