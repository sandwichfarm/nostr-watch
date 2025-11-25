/**
 * NIP-66 Event Types
 *
 * kind 10166: Monitor announcement
 * kind 30166: Relay observation (replaceable by relay URL)
 */

export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

/**
 * Monitor Announcement (kind 10166)
 * Announces a monitor's operational parameters
 */
export interface MonitorAnnouncement {
  pubkey: string
  frequency: number  // seconds between checks
  timeout: {
    open?: number
    read?: number
    write?: number
    info?: number
  }
  checks: string[]  // types of checks performed
  geo?: {
    lat: number
    lon: number
    precision?: number
  }
  lastSeen: number  // timestamp
  eventId: string
}

/**
 * NIP-32 Label
 */
export interface Label {
  namespace: string  // from L tag
  value: string      // from l tag
  quality?: number   // optional quality score
}

/**
 * Relay Observation (kind 30166)
 * Single observation of a relay by a monitor
 */
export interface RelayObservation {
  id: string
  created_at: number
  author: string        // monitor pubkey
  relayUrl: string      // from d tag (normalized)

  // Network tags
  network?: 'clearnet' | 'tor' | 'i2p' | 'hybrid'

  // Software identification
  software?: {
    family?: string
    version?: string
  }

  // RTT measurements (milliseconds)
  rtt?: {
    open?: number
    read?: number
    write?: number
    info?: number
  }

  // NIPs supported
  nips?: number[]

  // Requirements (boolean capabilities)
  requirements?: {
    payment?: boolean
    auth?: boolean
    [key: string]: boolean | undefined
  }

  // Geohashes (highest precision preferred)
  geohashes?: string[]

  // NIP-32 Labels
  labels?: Label[]

  // NIP-11 document (if available)
  nip11?: Record<string, any>

  // Raw event for reference
  raw?: NostrEvent
}

/**
 * Parsed tags from relay observation event
 */
export interface ParsedTags {
  relayUrl?: string  // d tag
  network?: string   // n tag
  nips?: number[]    // N tags
  requirements?: Record<string, boolean>  // R tags
  geohashes?: string[]  // g tags
  software?: string  // s tag (format: "family/version")
  rtt?: {
    open?: number
    read?: number
    write?: number
    info?: number
  }
  labels?: Label[]  // L/l tag pairs
  nip11?: string    // nip11 tag (JSON string)
}
