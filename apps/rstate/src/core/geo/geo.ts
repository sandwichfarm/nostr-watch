/**
 * Geo Service
 *
 * Handles geospatial queries and geohash processing
 */

import type { RelayObservation } from '../types/events.js'
import type { RelayState } from '../types/aggregation.js'
import { geohashToLatLon, selectHighestPrecision } from '../../utils/geohash.js'
import {
  haversineDistance,
  isWithinRadius,
  isWithinBbox,
  sortByDistance,
} from '../../utils/haversine.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'geo' })

/**
 * Relay with geo information
 */
export interface RelayWithGeo extends RelayState {
  geo: {
    lat: number
    lon: number
    precision: number
    geohash: string
    support: number
    authors: string[]
  }
}

export class GeoService {
  constructor() {
    logger.info('Geo service initialized')
  }

  /**
   * Add geo information to relay state from observations
   */
  addGeoToState(state: RelayState, observations: RelayObservation[]): void {
    // Collect all geohashes from observations
    const geohashByAuthor = new Map<string, string>()

    for (const obs of observations) {
      if (obs.geohashes && obs.geohashes.length > 0) {
        // Pick highest precision geohash for this observation
        const highest = selectHighestPrecision(obs.geohashes)
        if (highest) {
          geohashByAuthor.set(obs.author, highest)
        }
      }
    }

    if (geohashByAuthor.size === 0) {
      return
    }

    // Find most common geohash (or highest precision if tied)
    const geohashCounts = new Map<string, Set<string>>()
    for (const [author, geohash] of geohashByAuthor.entries()) {
      if (!geohashCounts.has(geohash)) {
        geohashCounts.set(geohash, new Set())
      }
      geohashCounts.get(geohash)!.add(author)
    }

    // Pick geohash with most support, or highest precision on tie
    let bestGeohash = ''
    let bestAuthors: Set<string> = new Set()
    let maxSupport = 0

    for (const [geohash, authors] of geohashCounts.entries()) {
      if (authors.size > maxSupport ||
          (authors.size === maxSupport && geohash.length > bestGeohash.length)) {
        bestGeohash = geohash
        bestAuthors = authors
        maxSupport = authors.size
      }
    }

    // Decode geohash to lat/lon
    try {
      const { lat, lon, precision } = geohashToLatLon(bestGeohash)
      const support = bestAuthors.size / geohashByAuthor.size

      state.geo = {
        lat,
        lon,
        precision,
        geohash: bestGeohash,
        support,
        authors: Array.from(bestAuthors),
      }
    } catch (err) {
      logger.warn({ geohash: bestGeohash, err }, 'Failed to decode geohash')
    }
  }

  /**
   * Filter relays within a radius of a center point
   */
  findWithinRadius(
    relays: RelayWithGeo[],
    centerLat: number,
    centerLon: number,
    radiusKm: number
  ): Array<RelayWithGeo & { distance: number }> {
    const results: Array<RelayWithGeo & { distance: number }> = []

    for (const relay of relays) {
      if (!relay.geo) continue

      if (isWithinRadius(centerLat, centerLon, relay.geo.lat, relay.geo.lon, radiusKm)) {
        const distance = haversineDistance(centerLat, centerLon, relay.geo.lat, relay.geo.lon)
        results.push({ ...relay, distance })
      }
    }

    return results.sort((a, b) => a.distance - b.distance)
  }

  /**
   * Filter relays within a bounding box
   */
  findWithinBbox(
    relays: RelayWithGeo[],
    swLat: number,
    swLon: number,
    neLat: number,
    neLon: number
  ): RelayWithGeo[] {
    const results: RelayWithGeo[] = []

    for (const relay of relays) {
      if (!relay.geo) continue

      if (isWithinBbox(relay.geo.lat, relay.geo.lon, swLat, swLon, neLat, neLon)) {
        results.push(relay)
      }
    }

    return results
  }

  /**
   * Find nearest N relays to a point
   */
  findNearest(
    relays: RelayWithGeo[],
    centerLat: number,
    centerLon: number,
    limit: number
  ): Array<RelayWithGeo & { distance: number }> {
    const relaysWithDistance = sortByDistance(
      centerLat,
      centerLon,
      relays.filter((r) => r.geo).map((r) => ({
        ...r,
        lat: r.geo!.lat,
        lon: r.geo!.lon,
      }))
    )

    return relaysWithDistance.slice(0, limit) as Array<RelayWithGeo & { distance: number }>
  }

  /**
   * Check if relays have geo information
   */
  filterWithGeo(relays: RelayState[]): RelayWithGeo[] {
    return relays.filter((r): r is RelayWithGeo => r.geo !== undefined)
  }
}
