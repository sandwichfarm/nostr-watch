/**
 * Compact Response Utilities
 *
 * Removes contributor/author data from relay states for compact responses
 */

import type { RelayState } from '../types/aggregation.js'

/**
 * Recursively remove contributingAuthors keys from any object (defense-in-depth)
 */
function sanitizeContributors(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeContributors(item))
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip contributingAuthors and authors fields
    if (key === 'contributingAuthors' || key === 'authors') {
      continue
    }
    sanitized[key] = sanitizeContributors(value)
  }
  return sanitized
}

/**
 * Remove contributor data from a RelayState object
 */
export function compactRelayState(state: RelayState): RelayState {
  const compact: any = {
    relayUrl: state.relayUrl,
    updated_at: state.updated_at,
    observationCount: state.observationCount,
    lastSeenAt: state.lastSeenAt,
    lastOpenAt: state.lastOpenAt,
  }

  // Network
  if (state.network) {
    compact.network = {
      value: state.network.value,
      support: state.network.support,
      sampleSize: state.network.sampleSize,
      lastUpdated: state.network.lastUpdated,
    }
  }

  // Software
  if (state.software) {
    compact.software = {}
    if (state.software.family) {
      compact.software.family = {
        value: state.software.family.value,
        support: state.software.family.support,
        sampleSize: state.software.family.sampleSize,
        lastUpdated: state.software.family.lastUpdated,
      }
    }
    if (state.software.version) {
      compact.software.version = {
        value: state.software.version.value,
        support: state.software.version.support,
        sampleSize: state.software.version.sampleSize,
        lastUpdated: state.software.version.lastUpdated,
      }
    }
  }

  // RTT
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
      }
    }
  }

  // NIPs (already compact)
  if (state.nips) {
    compact.nips = state.nips
  }

  // Requirements
  if (state.requirements) {
    compact.requirements = {}
    for (const [key, val] of Object.entries(state.requirements)) {
      compact.requirements[key] = {
        value: val.value,
        support: val.support,
        sampleSize: val.sampleSize,
        lastUpdated: val.lastUpdated,
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

  // Country
  if (state.country) {
    compact.country = {
      value: state.country.value,
      support: state.country.support,
      sampleSize: state.country.sampleSize,
      lastUpdated: state.country.lastUpdated,
    }
  }

  // Defense-in-depth: recursively remove any remaining contributingAuthors/authors
  return sanitizeContributors(compact) as RelayState
}

/**
 * Compact an array of relay states
 */
export function compactRelayStates(states: RelayState[]): RelayState[] {
  return states.map(compactRelayState)
}
