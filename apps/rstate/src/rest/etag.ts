/**
 * ETag Utilities
 *
 * Generates ETags and handles conditional requests
 */

import { createHash } from 'crypto'

/**
 * Generate ETag from content
 */
export function generateETag(content: string): string {
  const hash = createHash('sha256')
  hash.update(content)
  return `"${hash.digest('hex').substring(0, 32)}"` // First 32 chars of SHA-256
}

/**
 * Check if ETag matches If-None-Match header
 */
export function etagMatches(etag: string, ifNoneMatch: string | undefined): boolean {
  if (!ifNoneMatch) return false

  // Handle multiple ETags in If-None-Match
  const requestedETags = ifNoneMatch.split(',').map(e => e.trim())
  return requestedETags.includes(etag) || requestedETags.includes('*')
}
