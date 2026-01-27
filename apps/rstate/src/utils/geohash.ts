/**
 * Geohash Utilities
 *
 * Decode geohashes to lat/lon coordinates
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

interface GeohashBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/**
 * Decode a geohash string to lat/lon bounds
 */
export function decodeGeohash(geohash: string): {
  lat: number
  lon: number
  latError: number
  lonError: number
  precision: number
} {
  const bounds: GeohashBounds = {
    minLat: -90,
    maxLat: 90,
    minLon: -180,
    maxLon: 180,
  }

  let isEven = true

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) {
      throw new Error(`Invalid geohash character: ${char}`)
    }

    for (let i = 4; i >= 0; i--) {
      const bit = (idx >> i) & 1

      if (isEven) {
        // Longitude
        const mid = (bounds.minLon + bounds.maxLon) / 2
        if (bit === 1) {
          bounds.minLon = mid
        } else {
          bounds.maxLon = mid
        }
      } else {
        // Latitude
        const mid = (bounds.minLat + bounds.maxLat) / 2
        if (bit === 1) {
          bounds.minLat = mid
        } else {
          bounds.maxLat = mid
        }
      }

      isEven = !isEven
    }
  }

  const lat = (bounds.minLat + bounds.maxLat) / 2
  const lon = (bounds.minLon + bounds.maxLon) / 2
  const latError = bounds.maxLat - lat
  const lonError = bounds.maxLon - lon

  return {
    lat,
    lon,
    latError,
    lonError,
    precision: geohash.length,
  }
}

/**
 * Decode geohash to center point (simplified)
 */
export function geohashToLatLon(geohash: string): { lat: number; lon: number; precision: number } {
  const decoded = decodeGeohash(geohash)
  return {
    lat: decoded.lat,
    lon: decoded.lon,
    precision: decoded.precision,
  }
}

/**
 * Get the precision (character count) of a geohash
 */
export function getGeohashPrecision(geohash: string): number {
  return geohash.length
}

/**
 * Select the highest precision geohash from a list
 */
export function selectHighestPrecision(geohashes: string[]): string | undefined {
  if (geohashes.length === 0) return undefined

  return geohashes.reduce((highest, current) => {
    return current.length > highest.length ? current : highest
  })
}
