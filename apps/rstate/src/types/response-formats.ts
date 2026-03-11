/**
 * Response Format Types
 *
 * Defines compact (default) and detailed response formats for all relay state responses.
 * Compact format omits contributingAuthors/authors fields to reduce payload size.
 * Detailed format includes full attribution data.
 */

import type { RelayState, AggregatedValue } from './aggregation.js'

/**
 * Response shape level (three-level system)
 * - full: Most detailed, includes all contributor attribution (RelayState)
 * - detailed: Medium detail, aggregated without attribution (CompactRelayState)
 * - simple: Minimal, string-only relay URLs (string[])
 */
export type ResponseShape = 'full' | 'detailed' | 'simple'

/**
 * Compact aggregated value (no contributor attribution)
 */
export type CompactAggregatedValue<T> = Omit<AggregatedValue<T>, 'contributingAuthors'>

/**
 * Compact relay state (default response format)
 * Removes all contributingAuthors and authors fields
 */
export interface CompactRelayState {
  relayUrl: string
  updated_at: number
  observationCount: number
  lastSeenAt?: number
  lastOpenAt?: number

  network?: CompactAggregatedValue<'clearnet' | 'tor' | 'i2p' | 'hybrid'>
  software?: {
    family?: CompactAggregatedValue<string>
    version?: CompactAggregatedValue<string>
  }
  rtt?: {
    open?: CompactAggregatedValue<number> & { mad?: number }
    read?: CompactAggregatedValue<number> & { mad?: number }
    write?: CompactAggregatedValue<number> & { mad?: number }
    info?: CompactAggregatedValue<number> & { mad?: number }
  }
  nips?: {
    list: number[]
    support: Record<number, number>
  }
  requirements?: Record<string, CompactAggregatedValue<boolean>>
  labels?: Record<string, string[]>
  geo?: {
    lat: number
    lon: number
    precision: number
    geohash: string
    support: number
  }
  ipAddrs?: string[]
  country?: CompactAggregatedValue<string>
  nip11?: Record<string, any>
}

/**
 * Detailed relay state (includes full attribution)
 * This is the full RelayState type with all contributor data
 */
export type DetailedRelayState = RelayState

/**
 * Transform RelayState to compact format
 */
export function toCompact(state: RelayState): CompactRelayState {
  const compact: any = {
    relayUrl: state.relayUrl,
    updated_at: state.updated_at,
    observationCount: state.observationCount,
    lastSeenAt: state.lastSeenAt,
    lastOpenAt: state.lastOpenAt,
  }

  // Network (remove contributingAuthors)
  if (state.network) {
    compact.network = {
      value: state.network.value,
      support: state.network.support,
      sampleSize: state.network.sampleSize,
      lastUpdated: state.network.lastUpdated,
    }
    if (state.network.conflicts) {
      compact.network.conflicts = state.network.conflicts
    }
  }

  // Software (remove contributingAuthors from both family and version)
  if (state.software) {
    compact.software = {}
    if (state.software.family) {
      compact.software.family = {
        value: state.software.family.value,
        support: state.software.family.support,
        sampleSize: state.software.family.sampleSize,
        lastUpdated: state.software.family.lastUpdated,
      }
      if (state.software.family.conflicts) {
        compact.software.family.conflicts = state.software.family.conflicts
      }
    }
    if (state.software.version) {
      compact.software.version = {
        value: state.software.version.value,
        support: state.software.version.support,
        sampleSize: state.software.version.sampleSize,
        lastUpdated: state.software.version.lastUpdated,
      }
      if (state.software.version.conflicts) {
        compact.software.version.conflicts = state.software.version.conflicts
      }
    }
  }

  // RTT (remove contributingAuthors from all metrics)
  if (state.rtt) {
    compact.rtt = {}
    for (const key of ['open', 'read', 'write', 'info'] as const) {
      if (state.rtt[key]) {
        compact.rtt[key] = {
          value: state.rtt[key]!.value,
          mad: state.rtt[key]!.mad,
          support: state.rtt[key]!.support,
          sampleSize: state.rtt[key]!.sampleSize,
          lastUpdated: state.rtt[key]!.lastUpdated,
        }
        if (state.rtt[key]!.conflicts) {
          compact.rtt[key].conflicts = state.rtt[key]!.conflicts
        }
      }
    }
  }

  // NIPs (already compact - no contributingAuthors)
  if (state.nips) {
    compact.nips = state.nips
  }

  // Requirements (remove contributingAuthors from each)
  if (state.requirements) {
    compact.requirements = {}
    for (const [key, val] of Object.entries(state.requirements)) {
      compact.requirements[key] = {
        value: val.value,
        support: val.support,
        sampleSize: val.sampleSize,
        lastUpdated: val.lastUpdated,
      }
      if (val.conflicts) {
        compact.requirements[key].conflicts = val.conflicts
      }
    }
  }

  // Labels (already compact)
  if (state.labels) {
    compact.labels = state.labels
  }

  // Geo (remove authors)
  if (state.geo) {
    compact.geo = {
      lat: state.geo.lat,
      lon: state.geo.lon,
      precision: state.geo.precision,
      geohash: state.geo.geohash,
      support: state.geo.support,
    }
  }

  // IP addresses (already compact)
  if (state.ipAddrs) {
    compact.ipAddrs = state.ipAddrs
  }

  // NIP-11 (already compact - no attribution)
  if (state.nip11) {
    compact.nip11 = state.nip11
  }

  // Country (remove contributingAuthors)
  if (state.country) {
    compact.country = {
      value: state.country.value,
      support: state.country.support,
      sampleSize: state.country.sampleSize,
      lastUpdated: state.country.lastUpdated,
    }
    if (state.country.conflicts) {
      compact.country.conflicts = state.country.conflicts
    }
  }

  return compact as CompactRelayState
}

/**
 * Transform array of RelayStates to compact format
 */
export function toCompactArray(states: RelayState[]): CompactRelayState[] {
  return states.map(toCompact)
}

/**
 * Identity function for detailed format (no transformation needed)
 */
export function toDetailed(state: RelayState): DetailedRelayState {
  return state
}

/**
 * Identity function for detailed array format
 */
export function toDetailedArray(states: RelayState[]): DetailedRelayState[] {
  return states
}


/**
 * Convert array of RelayStates to simple format (string URLs only)
 * Used when shape='simple' for list endpoints
 *
 * @param states - Array of relay states to convert
 * @returns Array of relay URL strings
 */
export function toSimpleList(states: RelayState[]): string[] {
  return states.map(state => state.relayUrl)
}

/**
 * Apply shape transformation to an array of relay states
 * Handles the three-level response shaping system
 *
 * @param states - Array of relay states to transform
 * @param shape - Response shape level ('full' | 'detailed' | 'simple')
 * @returns Transformed array based on shape level
 */
export function applyShapeList(
  states: RelayState[],
  shape: ResponseShape
): RelayState[] | CompactRelayState[] | string[] {
  switch (shape) {
    case 'full':
      return states
    case 'detailed':
      return toCompactArray(states)
    case 'simple':
      return toSimpleList(states)
  }
}

/**
 * Apply shape transformation to a single relay state
 * For single-relay endpoints, 'simple' is treated as 'detailed' to maintain object structure
 *
 * @param state - Single relay state to transform (or null)
 * @param shape - Response shape level ('full' | 'detailed' | 'simple')
 * @returns Transformed state based on shape level, or null if input is null
 */
export function applyShapeSingle(
  state: RelayState | null,
  shape: ResponseShape
): RelayState | CompactRelayState | null {
  if (!state) return null

  // For single endpoints, 'simple' is treated as 'detailed' (returns minimal object, not string)
  if (shape === 'full') {
    return state
  }
  // Both 'detailed' and 'simple' return compact format for single endpoints
  return toCompact(state)
}
