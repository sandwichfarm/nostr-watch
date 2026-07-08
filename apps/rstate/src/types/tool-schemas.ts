/**
 * MCP Tool Input/Output Schemas
 *
 * These types define the interface for CVM MCP tools
 * Designed to be stable for ctxcn client generation
 */

import type { RelayState, AggregationPolicy } from './aggregation.js'
import type { TrustedRelayAssertion, TrustAssertionStatus } from '../core/trust/trusted-relay-assertions.js'
import type { MonitorAnnouncement } from './events.js'
import type { MonitorAnalytics } from './monitor-scoring.js'

/**
 * Health tool
 */
export interface HealthPingInput {
  // no params
}

export interface HealthPingOutput {
  status: 'ok' | 'degraded' | 'error'
  version: string
  uptime: number  // seconds
  relayCount: {
    transport: number
    ingestion: number
  }
  observationCount: number
  timestamp: number
  metrics?: any  // Optional metrics snapshot
  cache?: {
    size: number
    maxSize: number
    expired: number
    hits: number
    misses: number
    evictions: number
    expirations: number
    hitRate: number
    utilizationPercent: number
    hitRatePercent: number
  }
}

/**
 * Relays list tool
 */
export interface RelaysListInput {
  limit?: number
  offset?: number
  sortBy?: 'url' | 'updated' | 'observationCount'
  sortOrder?: 'asc' | 'desc'
}

export interface RelaysListOutput {
  relays: RelayState[]
  total: number
  limit: number
  offset: number
}

/**
 * Get relay state tool
 */
export interface RelaysGetStateInput {
  relayUrl: string
}

export interface RelaysGetStateOutput {
  relay: RelayState | null
}

export interface RelaysTrustInput {
  relayUrl: string
}

export interface RelaysTrustOutput {
  trust: TrustedRelayAssertion | null
}

export interface RelaysTrustListInput {
  status?: TrustAssertionStatus
  minScore?: number
  minConfidence?: number
  includeUnreachable?: boolean
  limit?: number
  offset?: number
}

export interface RelaysTrustListOutput {
  assertions: TrustedRelayAssertion[]
  total: number
  limit: number
  offset: number
}

/**
 * Search relays tool
 */
export interface RelaysSearchInput {
  network?: 'clearnet' | 'tor' | 'i2p' | 'hybrid'
  nips?: number[]  // must support ALL of these NIPs
  software?: {
    family?: string
    version?: string
  }
  labels?: {
    namespace: string
    value: string
  }[]
  maxLatency?: {
    open?: number
    read?: number
    write?: number
  }
  minSupport?: number  // min support ratio filter
  limit?: number
  offset?: number
}

export interface RelaysSearchOutput {
  relays: RelayState[]
  total: number
  limit: number
  offset: number
}

/**
 * Nearby relays tool
 */
export interface RelaysNearbyInput {
  lat: number
  lon: number
  radius?: number  // km, default: 100
  maxResults?: number
}

export interface RelaysNearbyOutput {
  relays: Array<RelayState & {
    distance: number  // km
  }>
  center: { lat: number; lon: number }
  radius: number
}

/**
 * Relays in bounding box tool
 */
export interface RelaysBboxInput {
  sw: { lat: number; lon: number }
  ne: { lat: number; lon: number }
  limit?: number
  offset?: number
}

export interface RelaysBboxOutput {
  relays: RelayState[]
  bbox: {
    sw: { lat: number; lon: number }
    ne: { lat: number; lon: number }
  }
  total: number
}

/**
 * Get labels tool
 */
export interface RelaysGetLabelsInput {
  relayUrl: string
  namespace?: string
}

export interface RelaysGetLabelsOutput {
  relayUrl: string
  labels: Record<string, string[]>  // namespace -> values
}

/**
 * List all labels tool
 */
export interface RelaysListLabelsInput {
  namespace?: string
}

export interface RelaysListLabelsOutput {
  namespaces: string[]
  labels: Record<string, string[]>  // namespace -> unique values
}

/**
 * Relays by label tool
 */
export interface RelaysByLabelInput {
  namespace: string
  value: string
  limit?: number
  offset?: number
}

export interface RelaysByLabelOutput {
  relays: RelayState[]
  label: { namespace: string; value: string }
  total: number
}

/**
 * Relays grouped by software tool
 */
export interface RelaysBySoftwareInput {
  family?: string
}

export interface RelaysBySoftwareOutput {
  groups: Array<{
    family: string
    version?: string
    count: number
    relays?: string[]  // relay URLs
  }>
}

/**
 * Relays grouped by network tool
 */
export interface RelaysByNetworkInput {
  // no params
}

export interface RelaysByNetworkOutput {
  groups: Array<{
    network: 'clearnet' | 'tor' | 'i2p' | 'hybrid'
    count: number
    relays?: string[]
  }>
}

/**
 * Relays grouped by NIP tool
 */
export interface RelaysByNipInput {
  nip?: number
  minSupport?: number
}

export interface RelaysByNipOutput {
  groups: Array<{
    nip: number
    count: number
    avgSupport: number
    relays?: string[]
  }>
}

/** Availability tools **/
export interface RelaysAvailabilityFilters {
  network?: 'clearnet' | 'tor' | 'i2p' | 'hybrid'
  labels?: { namespace: string; value: string }[]
}

export interface RelaysAvailabilityOnlineInput {
  onlineWindowSeconds?: number
  filters?: RelaysAvailabilityFilters
  limit?: number
  offset?: number
}

export interface RelaysAvailabilityOfflineInput {
  offlineThresholdSeconds?: number
  deadThresholdSeconds?: number
  filters?: RelaysAvailabilityFilters
  limit?: number
  offset?: number
}

export interface RelaysAvailabilityDeadInput {
  deadThresholdSeconds?: number
  filters?: RelaysAvailabilityFilters
  limit?: number
  offset?: number
}

export interface RelaysAvailabilityOutput {
  relays: string[]
  total: number
  limit: number
  offset: number
}

/**
 * Relays by country tool
 */
export interface RelaysByCountryInput {
  countryCode?: string  // ISO 3166-1 alpha-2
}

export interface RelaysByCountryOutput {
  groups: Array<{
    countryCode: string
    countryName?: string
    count: number
    relays?: string[]
  }>
}

/**
 * Get monitor info tool
 */
export interface MonitorsGetInput {
  pubkey: string
}

export interface MonitorsGetOutput {
  monitor: MonitorAnnouncement | null
  analytics?: MonitorAnalytics  // Optional scoring and coverage data
}

/**
 * List monitors tool
 */
export interface MonitorsListInput {
  limit?: number
  offset?: number
}

export interface MonitorsListOutput {
  monitors: MonitorAnnouncement[]
  total: number
  analytics?: MonitorAnalytics[]  // Optional scoring and coverage data for listed monitors
}

/**
 * Get policy tool
 */
export interface PolicyGetInput {
  // no params
}

export interface PolicyGetOutput {
  policy: AggregationPolicy
}

/**
 * Set policy tool (requires authorization)
 */
export interface PolicySetInput {
  policy: Partial<AggregationPolicy>
}

export interface PolicySetOutput {
  success: boolean
  policy: AggregationPolicy
  message?: string
}

/**
 * Compare relays tool
 */
export interface RelaysCompareInput {
  relayUrls: string[]  // 2-10 relays
}

export interface RelaysCompareOutput {
  relays: RelayState[]
  comparison: {
    common: {
      nips: number[]
      requirements: string[]
    }
    differences: {
      network: boolean
      software: boolean
      latency: boolean
    }
  }
}

/**
 * Subscribe to relay state changes
 */
export interface RelaysSubscribeStateInput {
  // Filter criteria (all optional)
  relayUrls?: string[]
  network?: 'clearnet' | 'tor' | 'i2p' | 'hybrid'
  nips?: number[]
  software?: {
    family?: string
    version?: string
  }
  labels?: {
    namespace: string
    value: string
  }[]
  geo?: {
    center: { lat: number; lon: number }
    radius: number  // km
  }
  thresholds?: {
    rttDeltaMs?: number
    supportDelta?: number
  }
}

export interface RelaysSubscribeStateOutput {
  subscriptionId: string
  message: string
}

/**
 * Unsubscribe from state changes
 */
export interface RelaysUnsubscribeInput {
  subscriptionId: string
}

export interface RelaysUnsubscribeOutput {
  success: boolean
  message: string
}
