/**
 * relay-chronicle
 *
 * Chronicle relay history and state from NIP-66 Kind 1066 delta events.
 * A lightweight, framework-agnostic TypeScript library that works everywhere.
 *
 * Works in browser, Node.js, and Deno.
 *
 * @example
 * ```typescript
 * import { composeState } from '@nostrwatch/relay-chronicle';
 *
 * const result = await composeState({
 *   storage: myStorageImplementation,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 86400, // Last 24 hours
 * });
 *
 * console.log(result.state.online); // true/false
 * console.log(result.state.info.name); // Relay name
 * ```
 */

// Export types
export type {
  NostrEvent,
  DeltaEvent,
  OperationalStatus,
  DeltaType,
  ParsedDelta,
  RelayState,
  QueryOptions,
  EventStorage,
  ComposeOptions,
  ComposedState,
  ComposedSnapshots,
  UptimeStats,
} from './types.ts';

// Export time series types
export type {
  TimeSeriesPoint,
  UptimeState,
  UptimePoint,
  ChangeEvent,
  AggregatedStats,
  TimeSeriesOptions,
  AggregationOptions,
} from './timeseries.ts';

// Export helper types
export type {
  InitInfo,
  LivenessInfo,
  DowntimeInfo,
  Period,
  ChangeInfo,
} from './helpers.ts';

// Export core functions
export {
  composeState,
  calculateUptime,
  getLatestState,
} from './composer.ts';

// Export time series functions
export {
  generateUptimeSeries,
  generateRttSeries,
  generateChangeTimeline,
  generateAggregatedSeries,
  generateFieldSeries,
} from './timeseries.ts';

// Export helper functions
export {
  whenInit,
  liveness,
  lastDowntime,
  uptimeHistory,
  lastChange,
  changeHistory,
} from './helpers.ts';

// Export utilities (useful for custom implementations)
export {
  parseOperationalStatus,
  parseRelayUrl,
  parsePeriods,
  parseRttOpen,
  parseRetryCount,
  isRelayOnline,
  parseDeltas,
  setNested,
  deleteNested,
  parseValue,
  separateByNamespace,
} from './utils.ts';

// Export storage adapters
export { Route66EventStorage } from './storage/index.ts';
export type { Route66CacheAdapter } from './storage/index.ts';
