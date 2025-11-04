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
