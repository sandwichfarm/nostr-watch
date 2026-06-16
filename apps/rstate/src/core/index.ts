/**
 * State Core Module
 *
 * Transport-agnostic relay state machine
 */

export { initStateCore } from './api.js'
export type {
  StateCore,
  RelayQuery,
  MonitorQuery,
  PolicyInterface,
  IngestionInterface,
  StatsInterface,
  TrustQuery,
} from './api.js'
export type { CoreConfig } from './config.js'
export type {
  RelayObservation,
  MonitorAnnouncement,
} from './types/events.js'
export type {
  RelayState,
  AggregationPolicy,
} from './types/aggregation.js'
export type {
  TrustedRelayAssertion,
  TrustAssertionStatus,
  TrustConfidenceLevel,
  TrustListFilters,
  TrustScoringOptions,
} from './trust/trusted-relay-assertions.js'
