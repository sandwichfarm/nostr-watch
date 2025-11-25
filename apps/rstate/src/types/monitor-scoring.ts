/**
 * Monitor Scoring Types
 *
 * Types for monitor reliability and coverage analytics
 */

/**
 * Monitor reliability score
 */
export interface MonitorScore {
  pubkey: string

  // Overall reliability score (0-1)
  reliabilityScore: number

  // Component scores
  timelinessScore: number      // How often updates arrive on-time
  consistencyScore: number     // Agreement with consensus
  errorRate: number            // Proportion of observations with errors

  // Metadata
  lastUpdated: number          // Timestamp of last score update
  observationCount: number     // Total observations considered
}

/**
 * Monitor coverage analytics
 */
export interface MonitorCoverage {
  pubkey: string

  // Relay coverage
  relayCount: number           // Number of relays monitored
  relayUrls: string[]          // List of relay URLs

  // Check coverage
  checks: {
    open: boolean
    read: boolean
    write: boolean
    info: boolean
    dns: boolean
    geo: boolean
  }

  // Label coverage
  namespaces: string[]         // Label namespaces published
  labelCount: number           // Total labels published

  // Activity
  firstSeen: number            // First observation timestamp
  lastSeen: number             // Most recent observation timestamp
  frequency?: number           // Declared update frequency (seconds)
}

/**
 * Monitor analytics (combined score + coverage)
 */
export interface MonitorAnalytics {
  pubkey: string
  score: MonitorScore
  coverage: MonitorCoverage
}

/**
 * Scoring configuration
 */
export interface ScoringPolicy {
  // Timeliness
  timelinessWeight: number             // Weight of timeliness component (0-1)
  lateThresholdMultiplier: number      // Multiplier of frequency to consider "late"

  // Consistency
  consistencyWeight: number            // Weight of consistency component (0-1)
  outlierThreshold: number             // MAD threshold for outlier detection

  // Error rate
  errorWeight: number                  // Weight of error component (0-1)

  // Decay
  decayHalfLife: number                // Half-life for exponential decay (seconds)

  // Minimum data
  minObservationsForScore: number      // Minimum observations before scoring
}

/**
 * Default scoring policy
 */
export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  timelinessWeight: 0.4,
  lateThresholdMultiplier: 1.5,

  consistencyWeight: 0.5,
  outlierThreshold: 3.0,  // 3 MADs from median

  errorWeight: 0.1,

  decayHalfLife: 7 * 24 * 3600,  // 1 week

  minObservationsForScore: 10,
}
