/**
 * Core Configuration
 *
 * Configuration types and interfaces for the transport-agnostic state core.
 * The core only needs aggregation policy and basic operational settings.
 */

import type { AggregationPolicy } from './types/aggregation.js'

export interface CoreConfig {
  /**
   * Aggregation policy for conflict resolution
   */
  aggregation: AggregationPolicy

  /**
   * Optional logger configuration
   * Core services use this to log events
   */
  logger?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    enabled?: boolean
  }
}

/**
 * Core initialization options
 * Passed when creating a StateCore instance
 */
export interface CoreInitOptions {
  config: CoreConfig
}
