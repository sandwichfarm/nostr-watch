/**
 * URL Normalization Utilities
 *
 * Ensures consistent relay URL formatting per RFC3986
 */

/**
 * Normalize a relay URL to canonical form
 * - Force lowercase hostname
 * - Remove trailing slashes
 * - Ensure wss:// protocol
 * - Remove default port (443 for wss)
 */
export function normalizeRelayUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())

    // Force wss protocol
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
      throw new Error(`Invalid protocol: ${parsed.protocol}`)
    }

    // Lowercase hostname
    const hostname = parsed.hostname.toLowerCase()

    // Remove default port
    let port = parsed.port
    if ((parsed.protocol === 'wss:' && port === '443') ||
        (parsed.protocol === 'ws:' && port === '80')) {
      port = ''
    }

    // Remove trailing slashes from pathname
    let pathname = parsed.pathname
    while (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    // Reconstruct URL
    const portPart = port ? `:${port}` : ''
    const pathPart = pathname === '/' ? '' : pathname
    const searchPart = parsed.search || ''
    const hashPart = parsed.hash || ''

    return `${parsed.protocol}//${hostname}${portPart}${pathPart}${searchPart}${hashPart}`
  } catch (err) {
    throw new Error(`Failed to normalize URL "${url}": ${err}`)
  }
}

/**
 * Validate that a string is a valid relay URL
 */
export function isValidRelayUrl(url: string): boolean {
  try {
    normalizeRelayUrl(url)
    return true
  } catch {
    return false
  }
}

/**
 * Batch normalize relay URLs, filtering out invalid ones
 */
export function normalizeRelayUrls(urls: string[]): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const url of urls) {
    try {
      const norm = normalizeRelayUrl(url)
      if (!seen.has(norm)) {
        normalized.push(norm)
        seen.add(norm)
      }
    } catch {
      // Skip invalid URLs
      continue
    }
  }

  return normalized
}
