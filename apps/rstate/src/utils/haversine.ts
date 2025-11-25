/**
 * Haversine Distance Calculations
 *
 * Calculate great-circle distances between lat/lon coordinates
 */

const EARTH_RADIUS_KM = 6371

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate Haversine distance between two points in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Check if a point is within a radius of a center point
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number
): boolean {
  const distance = haversineDistance(centerLat, centerLon, pointLat, pointLon)
  return distance <= radiusKm
}

/**
 * Check if a point is within a bounding box
 */
export function isWithinBbox(
  pointLat: number,
  pointLon: number,
  swLat: number,
  swLon: number,
  neLat: number,
  neLon: number
): boolean {
  // Handle longitude wrap-around (bbox crossing 180° meridian)
  const lonInRange =
    swLon <= neLon
      ? pointLon >= swLon && pointLon <= neLon
      : pointLon >= swLon || pointLon <= neLon

  return pointLat >= swLat && pointLat <= neLat && lonInRange
}

/**
 * Sort points by distance from a center point
 */
export function sortByDistance<T extends { lat: number; lon: number }>(
  centerLat: number,
  centerLon: number,
  points: T[]
): Array<T & { distance: number }> {
  return points
    .map((point) => ({
      ...point,
      distance: haversineDistance(centerLat, centerLon, point.lat, point.lon),
    }))
    .sort((a, b) => a.distance - b.distance)
}
