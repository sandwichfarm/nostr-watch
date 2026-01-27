/**
 * Input Validation and Normalization
 *
 * Validates and sanitizes inputs from MCP tool calls
 */

// Validation utilities - no logging needed for pure functions

/**
 * Validate and normalize relay URL
 */
export function validateRelayUrl(url: string): string {
  // Check basic format
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    throw new Error('Relay URL must start with ws:// or wss://')
  }

  try {
    const parsed = new URL(url)

    // Normalize: lowercase scheme and host, remove trailing slash
    const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`
    return normalized.endsWith('/') && parsed.pathname !== '/'
      ? normalized.slice(0, -1)
      : normalized
  } catch (err) {
    throw new Error(`Invalid relay URL: ${url}`)
  }
}

/**
 * Validate and normalize geohash
 */
export function validateGeohash(geohash: string): string {
  const validChars = '0123456789bcdefghjkmnpqrstuvwxyz'

  if (!geohash || geohash.length === 0 || geohash.length > 12) {
    throw new Error('Geohash must be 1-12 characters')
  }

  const normalized = geohash.toLowerCase()

  for (const char of normalized) {
    if (!validChars.includes(char)) {
      throw new Error(`Invalid geohash character: ${char}`)
    }
  }

  return normalized
}

/**
 * Validate label namespace
 */
export function validateLabelNamespace(namespace: string): string {
  if (!namespace || namespace.length === 0) {
    throw new Error('Label namespace cannot be empty')
  }

  // Namespace should be alphanumeric with underscores/hyphens
  const valid = /^[a-zA-Z0-9_-]+$/.test(namespace)
  if (!valid) {
    throw new Error('Label namespace must be alphanumeric with _ or -')
  }

  return namespace
}

/**
 * Validate label value
 */
export function validateLabelValue(value: string): string {
  if (value === undefined || value === null) {
    throw new Error('Label value cannot be null or undefined')
  }

  // Allow any string but enforce max length
  const maxLength = 256
  if (value.length > maxLength) {
    throw new Error(`Label value exceeds max length (${maxLength})`)
  }

  return value
}

/**
 * Validate latitude
 */
export function validateLatitude(lat: number): number {
  if (typeof lat !== 'number' || isNaN(lat)) {
    throw new Error('Latitude must be a number')
  }

  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90')
  }

  return lat
}

/**
 * Validate longitude
 */
export function validateLongitude(lon: number): number {
  if (typeof lon !== 'number' || isNaN(lon)) {
    throw new Error('Longitude must be a number')
  }

  if (lon < -180 || lon > 180) {
    throw new Error('Longitude must be between -180 and 180')
  }

  return lon
}

/**
 * Validate geo radius (in kilometers)
 */
export function validateRadius(radius: number, maxRadius: number = 20000): number {
  if (typeof radius !== 'number' || isNaN(radius)) {
    throw new Error('Radius must be a number')
  }

  if (radius <= 0) {
    throw new Error('Radius must be positive')
  }

  if (radius > maxRadius) {
    throw new Error(`Radius exceeds maximum (${maxRadius} km)`)
  }

  return radius
}

/**
 * Validate and clamp pagination limit
 */
export function validateLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  if (limit === undefined) return defaultLimit

  if (typeof limit !== 'number' || isNaN(limit) || limit < 1) {
    throw new Error('Limit must be a positive number')
  }

  // Clamp to max
  return Math.min(limit, maxLimit)
}

/**
 * Validate pagination offset
 */
export function validateOffset(offset: number | undefined): number {
  if (offset === undefined) return 0

  if (typeof offset !== 'number' || isNaN(offset) || offset < 0) {
    throw new Error('Offset must be a non-negative number')
  }

  return offset
}

/**
 * Validate NIP number
 */
export function validateNIP(nip: number): number {
  if (typeof nip !== 'number' || isNaN(nip)) {
    throw new Error('NIP must be a number')
  }

  if (nip < 1 || nip > 999) {
    throw new Error('NIP must be between 1 and 999')
  }

  return nip
}

/**
 * Validate network type
 */
export function validateNetwork(network: string): 'clearnet' | 'tor' | 'i2p' | 'hybrid' {
  const valid = ['clearnet', 'tor', 'i2p', 'hybrid']

  if (!valid.includes(network)) {
    throw new Error(`Network must be one of: ${valid.join(', ')}`)
  }

  return network as any
}

/**
 * Validate sort order
 */
export function validateSortOrder(order: string | undefined): 'asc' | 'desc' {
  if (order === undefined) return 'asc'

  const valid = ['asc', 'desc']

  if (!valid.includes(order)) {
    throw new Error(`Sort order must be one of: ${valid.join(', ')}`)
  }

  return order as any
}

/**
 * Validate relay URL array
 */
export function validateRelayUrls(urls: string[], maxCount: number = 100): string[] {
  if (!Array.isArray(urls)) {
    throw new Error('Relay URLs must be an array')
  }

  if (urls.length === 0) {
    throw new Error('Relay URLs array cannot be empty')
  }

  if (urls.length > maxCount) {
    throw new Error(`Too many relay URLs (max ${maxCount})`)
  }

  return urls.map(url => validateRelayUrl(url))
}

/**
 * Validate NIP array
 */
export function validateNIPs(nips: number[], maxCount: number = 50): number[] {
  if (!Array.isArray(nips)) {
    throw new Error('NIPs must be an array')
  }

  if (nips.length === 0) {
    throw new Error('NIPs array cannot be empty')
  }

  if (nips.length > maxCount) {
    throw new Error(`Too many NIPs (max ${maxCount})`)
  }

  return nips.map(nip => validateNIP(nip))
}

/**
 * Validate and shape query filters
 */
export interface QueryShape {
  maxResults: number
  maxRelayUrls: number
  maxNIPs: number
  maxRadius: number
}

export const DEFAULT_QUERY_SHAPE: QueryShape = {
  maxResults: 1000,
  maxRelayUrls: 100,
  maxNIPs: 50,
  maxRadius: 20000, // 20,000 km (half Earth circumference)
}

export function shapeQuery(
  params: any,
  shape: QueryShape = DEFAULT_QUERY_SHAPE
): any {
  const shaped = { ...params }

  // Limit result count
  if (shaped.limit !== undefined) {
    shaped.limit = validateLimit(shaped.limit, 100, shape.maxResults)
  }

  // Limit relay URL count
  if (shaped.relayUrls !== undefined) {
    shaped.relayUrls = validateRelayUrls(shaped.relayUrls, shape.maxRelayUrls)
  }

  // Limit NIP count
  if (shaped.nips !== undefined && shaped.nips.length > 0) {
    shaped.nips = validateNIPs(shaped.nips, shape.maxNIPs)
  }

  // Limit radius
  if (shaped.radius !== undefined) {
    shaped.radius = validateRadius(shaped.radius, shape.maxRadius)
  }

  // Validate geo if present
  if (shaped.geo) {
    shaped.geo.center.lat = validateLatitude(shaped.geo.center.lat)
    shaped.geo.center.lon = validateLongitude(shaped.geo.center.lon)
    shaped.geo.radius = validateRadius(shaped.geo.radius, shape.maxRadius)
  }

  return shaped
}
