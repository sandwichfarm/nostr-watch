/**
 * Geohash decoding utility
 * Converts geohash strings to latitude/longitude coordinates
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

interface LatLon {
    lat: number;
    lon: number;
}

/**
 * Decode a geohash string to latitude/longitude coordinates
 * @param geohash The geohash string to decode
 * @returns Object with lat and lon properties, or null if invalid
 */
export function decodeGeohash(geohash: string): LatLon | null {
    if (!geohash || typeof geohash !== 'string') return null;

    const hash = geohash.toLowerCase();
    let isLon = true;
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;

    for (const char of hash) {
        const idx = BASE32.indexOf(char);
        if (idx === -1) return null;

        for (let bit = 4; bit >= 0; bit--) {
            const bitValue = (idx >> bit) & 1;
            if (isLon) {
                const mid = (lonMin + lonMax) / 2;
                if (bitValue === 1) {
                    lonMin = mid;
                } else {
                    lonMax = mid;
                }
            } else {
                const mid = (latMin + latMax) / 2;
                if (bitValue === 1) {
                    latMin = mid;
                } else {
                    latMax = mid;
                }
            }
            isLon = !isLon;
        }
    }

    return {
        lat: (latMin + latMax) / 2,
        lon: (lonMin + lonMax) / 2
    };
}
