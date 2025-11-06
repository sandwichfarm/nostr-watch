/**
 * Cache Service
 *
 * Provides TTL-based caching for expensive query results
 * Supports invalidation patterns for cache busting
 */

import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'cache' })

interface CacheEntry<T> {
  value: T
  expiresAt: number
  lastAccessed: number
  hitCount: number
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number
  private maxSize: number
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  }

  constructor(defaultTTLSeconds: number = 60, maxSize: number = 10000) {
    this.defaultTTL = defaultTTLSeconds * 1000
    this.maxSize = maxSize
    logger.info({ defaultTTLSeconds, maxSize }, 'Cache service initialized')
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }

    const now = Date.now()
    if (now >= entry.expiresAt) {
      // Expired
      this.cache.delete(key)
      this.stats.expirations++
      this.stats.misses++
      return undefined
    }

    // Update access tracking for LRU
    entry.lastAccessed = now
    entry.hitCount++
    this.stats.hits++

    return entry.value as T
  }

  /**
   * Set a cached value with optional custom TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTTL
    const now = Date.now()
    const expiresAt = now + ttl

    // Check if we need to evict entries (LRU)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: now,
      hitCount: 0,
    })
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
      logger.debug({ key: oldestKey }, 'LRU cache entry evicted')
    }
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let invalidated = 0

    // Convert glob-style pattern to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      logger.debug({ pattern, invalidated }, 'Cache pattern invalidated')
    }

    return invalidated
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    logger.info({ cleared: size }, 'Cache cleared')
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = Date.now()
    let evicted = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key)
        evicted++
      }
    }

    if (evicted > 0) {
      logger.debug({ evicted }, 'Expired cache entries evicted')
    }

    return evicted
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    expired: number
    hits: number
    misses: number
    evictions: number
    expirations: number
    hitRate: number
    utilizationPercent: number
  } {
    const now = Date.now()
    let expired = 0

    for (const entry of this.cache.values()) {
      if (now >= entry.expiresAt) {
        expired++
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expired,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      hitRate,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
    }
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    }
  }

  /**
   * Get detailed cache entry information (for debugging)
   */
  getEntryDetails(key: string): {
    exists: boolean
    expired: boolean
    expiresIn?: number
    lastAccessed?: number
    hitCount?: number
  } {
    const entry = this.cache.get(key)
    if (!entry) {
      return { exists: false, expired: false }
    }

    const now = Date.now()
    const expired = now >= entry.expiresAt

    return {
      exists: true,
      expired,
      expiresIn: expired ? 0 : entry.expiresAt - now,
      lastAccessed: entry.lastAccessed,
      hitCount: entry.hitCount,
    }
  }
}

/**
 * Query Cache - Specialized cache for MCP query results
 */
export class QueryCache extends CacheService {
  /**
   * Generate cache key for relay list queries
   */
  relayListKey(sortBy?: string, sortOrder?: string): string {
    return `relays:list:${sortBy || 'url'}:${sortOrder || 'asc'}`
  }

  /**
   * Generate cache key for relay state
   */
  relayStateKey(relayUrl: string): string {
    return `relays:state:${relayUrl}`
  }

  /**
   * Generate cache key for relay search
   */
  relaySearchKey(params: Record<string, any>): string {
    const sorted = Object.keys(params).sort()
    const parts = sorted.map(k => `${k}=${JSON.stringify(params[k])}`)
    return `relays:search:${parts.join(':')}`
  }

  /**
   * Generate cache key for grouping queries
   */
  relayGroupKey(groupType: string, filter?: string): string {
    return `relays:group:${groupType}${filter ? ':' + filter : ''}`
  }

  /**
   * Invalidate all relay-related caches
   */
  invalidateRelays(): number {
    return this.invalidatePattern('relays:*')
  }

  /**
   * Invalidate specific relay state
   */
  invalidateRelayState(relayUrl: string): boolean {
    return this.delete(this.relayStateKey(relayUrl))
  }

  /**
   * Invalidate search and grouping caches
   */
  invalidateQueries(): number {
    let count = 0
    count += this.invalidatePattern('relays:search:*')
    count += this.invalidatePattern('relays:group:*')
    count += this.invalidatePattern('relays:list:*')
    return count
  }

  /**
   * Invalidate cache by exact key or prefix pattern
   */
  invalidate(keyOrPrefix: string): number {
    // If it looks like a prefix (ends with : or *), use pattern matching
    if (keyOrPrefix.endsWith(':') || keyOrPrefix.includes('*')) {
      const pattern = keyOrPrefix.endsWith(':') ? keyOrPrefix + '*' : keyOrPrefix
      return this.invalidatePattern(pattern)
    }

    // Otherwise, exact key deletion
    return this.delete(keyOrPrefix) ? 1 : 0
  }
}
