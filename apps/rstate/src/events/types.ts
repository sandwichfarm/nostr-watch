/**
 * Event Publishing Types
 *
 * Shared types for Kind 1066, 20066, and 1166 event publishing
 */

export type OperationalStatus = 'init' | 'up' | 'down'

export interface RelayDelta {
  tag: string   // e.g. 'network', '+nip:42', '-nip:7', 'software.family', '+label:isp:cloudflare'
  oldValue?: string
  newValue?: string
}

export interface Kind1066Data {
  relayUrl: string
  status: OperationalStatus
  rttOpen?: number
  deltas: RelayDelta[]
}

export interface Kind20066Data {
  relayUrl: string
  transition: 'up' | 'down'
  rttOpen?: number
}

export interface Kind1166Data {
  categories: Kind1166Category[]
}

export interface Kind1166Category {
  category: string
  key: string
  value: string
}
