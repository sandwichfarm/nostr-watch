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
  StateSnapshot,
  SnapshotInterface,
} from './api.js'
export type { CoreConfig } from './config.js'
export type {
  RelayObservation,
  MonitorAnnouncement,
  TrustedRelayAssertion,
} from './types/events.js'
export type {
  RelayState,
  AggregationPolicy,
  TrustedRelayAggregate,
} from './types/aggregation.js'
