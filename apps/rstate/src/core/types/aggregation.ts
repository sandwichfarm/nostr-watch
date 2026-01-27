/**
 * Aggregation and Conflict Resolution Types
 */

/**
 * Aggregation Policy Configuration
 */
export interface AggregationPolicy {
  // Window strategy
  windowStrategy: 'global' | 'per-author'
  lookbackSeconds: number  // default: 21600 (6 hours)

  // Quorum thresholds
  quorum: number           // min support ratio for booleans (0-1)
  labelQuorum: number      // min support ratio for labels/sets (0-1)

  // Outlier rejection for numeric values
  madScale: number         // MAD multiplier for outlier rejection (default: 3.0)

  // Weighting factors
  weights: {
    recency: number        // weight for newer observations
    reliability: number    // weight for monitor reliability score
  }

  // NIP support resolution strategy
  nipSourceOrder: ('tags-first' | 'nip11-first' | 'vote')[]

  // Geo preferences
  geoPrefs: {
    preferHigherPrecision: boolean
  }
}

/**
 * Default policy
 */
export const DEFAULT_POLICY: AggregationPolicy = {
  windowStrategy: 'global',
  lookbackSeconds: 21600,
  quorum: 0.5,
  labelQuorum: 0.3,
  madScale: 3.0,
  weights: {
    recency: 1.0,
    reliability: 1.0,
  },
  nipSourceOrder: ['vote'],
  geoPrefs: {
    preferHigherPrecision: true,
  },
}

/**
 * Aggregated value with metadata
 */
export interface AggregatedValue<T> {
  value: T
  support: number  // ratio of monitors that agree (0-1)
  sampleSize: number  // number of observations
  contributingAuthors: string[]  // pubkeys
  lastUpdated: number  // timestamp
  conflicts?: ConflictInfo[]  // minority views
}

/**
 * Conflict information for minority views
 */
export interface ConflictInfo {
  value: any
  support: number
  authors: string[]
}

/**
 * Aggregated relay state
 */
export interface RelayState {
  relayUrl: string

  // Network
  network?: AggregatedValue<'clearnet' | 'tor' | 'i2p' | 'hybrid'>

  // Software
  software?: {
    family?: AggregatedValue<string>
    version?: AggregatedValue<string>
  }

  // RTT (median with MAD)
  rtt?: {
    open?: AggregatedValue<number> & { mad?: number }
    read?: AggregatedValue<number> & { mad?: number }
    write?: AggregatedValue<number> & { mad?: number }
    info?: AggregatedValue<number> & { mad?: number }
  }

  // NIPs (set aggregation with per-item support)
  nips?: {
    list: number[]
    support: Record<number, number>  // nip -> support ratio
  }

  // Requirements (boolean aggregation)
  requirements?: Record<string, AggregatedValue<boolean>>

  // Labels (grouped by namespace → values)
  labels?: Record<string, string[]>

  // Geo
  geo?: {
    lat: number
    lon: number
    precision: number  // geohash character count
    geohash: string
    support: number
    authors: string[]
  }

  // IP addresses (if available from labels)
  ipAddrs?: string[]

  // Country (if available from labels)
  country?: AggregatedValue<string>

  // Meta
  updated_at: number
  contributingAuthors: string[]
  observationCount: number

  // Availability timestamps (seconds since epoch)
  // lastSeenAt: last observation timestamp for this relay
  // lastOpenAt: last observation timestamp where an 'open' RTT was recorded
  lastSeenAt?: number
  lastOpenAt?: number
}

/**
 * Label aggregation (per namespace-value pair)
 */
export interface LabelAggregation {
  value: string
  support: number
  relays: string[]  // which relays have this label
  authors: string[]
  avgQuality?: number
}

/**
 * Numeric aggregation result
 */
export interface NumericAggregation {
  median: number
  mad: number  // Median Absolute Deviation
  values: number[]
  outliers: number[]  // rejected values
  sampleSize: number
  authors: string[]
}

/**
 * Boolean aggregation result
 */
export interface BooleanAggregation {
  value: boolean
  trueCount: number
  falseCount: number
  support: number  // ratio of true votes
  sampleSize: number
  authors: string[]
}

/**
 * Set aggregation result (for NIPs, labels, etc.)
 */
export interface SetAggregation<T = string | number> {
  items: T[]
  support: Record<string, number>  // item -> support ratio
  sampleSize: number
  allAuthors: string[]
  itemAuthors: Record<string, string[]>  // item -> authors
}

/**
 * Enum aggregation result (for network, software, etc.)
 */
export interface EnumAggregation<T = string> {
  value: T
  support: number
  distribution: Record<string, number>  // value -> count
  sampleSize: number
  authors: string[]
  conflicts?: Array<{
    value: T
    count: number
    authors: string[]
  }>
}
