/**
 * Subscription Types
 *
 * Types for state change subscriptions and notifications
 */

import type { RelayState } from './aggregation.js'

/**
 * Subscription filter criteria
 */
export interface SubscriptionFilter {
  // Filter by relay URLs
  relayUrls?: string[]

  // Filter by network
  network?: 'clearnet' | 'tor' | 'i2p' | 'hybrid'

  // Filter by NIPs
  nips?: number[]

  // Filter by software
  software?: {
    family?: string
    version?: string
  }

  // Filter by labels
  labels?: {
    namespace: string
    value: string
  }[]

  // Geographic filters
  geo?: {
    center?: { lat: number; lon: number }
    radius?: number  // km
  }

  // Change thresholds
  thresholds?: {
    rttDeltaMs?: number  // notify if RTT changes by more than this
    supportDelta?: number  // notify if support ratio changes by more than this
  }
}

/**
 * Subscription channel
 */
export type SubscriptionChannel = 'MCP' | 'REST'

/**
 * Subscription instance
 */
export interface Subscription {
  id: string
  clientPubkey: string
  channel: SubscriptionChannel
  filter: SubscriptionFilter
  createdAt: number
  lastNotified: number
  // Track last snapshot per relay for change detection
  lastSnapshots: Map<string, RelayStateSnapshot>
}

/**
 * Simplified snapshot for change detection
 */
export interface RelayStateSnapshot {
  relayUrl: string
  network?: string
  software?: {
    family?: string
    version?: string
  }
  rtt?: {
    open?: number
    read?: number
    write?: number
  }
  nips?: number[]
  requirements?: Record<string, boolean>
  labels?: Record<string, string[]>
  geo?: {
    lat: number
    lon: number
  }
  timestamp: number
}

/**
 * Change types
 */
export enum ChangeType {
  NETWORK_CHANGE = 'network_change',
  SOFTWARE_CHANGE = 'software_change',
  RTT_CHANGE = 'rtt_change',
  NIP_ADDED = 'nip_added',
  NIP_REMOVED = 'nip_removed',
  REQUIREMENT_CHANGE = 'requirement_change',
  LABEL_CHANGE = 'label_change',
  GEO_CHANGE = 'geo_change',
  STATUS_FLIP = 'status_flip',
}

/**
 * State change notification
 */
export interface StateChangeNotification {
  type: 'state_change'
  relayUrl: string
  changes: Array<{
    type: ChangeType
    field: string
    oldValue?: any
    newValue?: any
    delta?: number
  }>
  newState: RelayState
  timestamp: number
}

/**
 * Notification queue entry
 */
export interface QueuedNotification {
  subscriptionId: string
  clientPubkey: string
  channel: SubscriptionChannel
  notification: StateChangeNotification
  queuedAt: number
  attempts: number
}
