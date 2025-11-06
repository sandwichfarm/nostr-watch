/**
 * Rate Limiter Service
 *
 * Token bucket rate limiting per client pubkey
 */

import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'rate-limiter' })

interface TokenBucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitConfig {
  tokensPerSecond: number   // Token refill rate
  maxTokens: number          // Bucket capacity
  costPerRequest: number     // Tokens consumed per request
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  tokensPerSecond: 10,
  maxTokens: 100,
  costPerRequest: 1,
}

export class RateLimiterService {
  private buckets: Map<string, TokenBucket> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config
    logger.info({ config }, 'Rate limiter initialized')
  }

  /**
   * Check if a request is allowed and consume tokens
   *
   * @returns true if allowed, false if rate limited
   */
  checkLimit(clientPubkey: string, cost: number = this.config.costPerRequest): boolean {
    const now = Date.now()
    let bucket = this.buckets.get(clientPubkey)

    if (!bucket) {
      // New client - create bucket
      bucket = {
        tokens: this.config.maxTokens - cost,
        lastRefill: now,
      }
      this.buckets.set(clientPubkey, bucket)
      return true
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000 // seconds
    const tokensToAdd = elapsed * this.config.tokensPerSecond
    bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now

    // Check if we have enough tokens
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost
      return true
    }

    // Rate limited
    logger.warn({
      clientPubkey: clientPubkey.slice(0, 8),
      tokens: bucket.tokens,
      cost,
    }, 'Rate limit exceeded')

    return false
  }

  /**
   * Get remaining tokens for a client
   */
  getRemainingTokens(clientPubkey: string): number {
    const bucket = this.buckets.get(clientPubkey)
    if (!bucket) return this.config.maxTokens

    // Refill tokens based on elapsed time
    const now = Date.now()
    const elapsed = (now - bucket.lastRefill) / 1000
    const tokensToAdd = elapsed * this.config.tokensPerSecond
    const tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd)

    return tokens
  }

  /**
   * Reset rate limit for a client
   */
  reset(clientPubkey: string): void {
    this.buckets.delete(clientPubkey)
  }

  /**
   * Clear all rate limit buckets
   */
  clear(): void {
    this.buckets.clear()
  }

  /**
   * Evict stale buckets (not accessed in past hour)
   */
  evictStale(): number {
    const now = Date.now()
    const staleThreshold = 3600 * 1000 // 1 hour
    let evicted = 0

    for (const [pubkey, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(pubkey)
        evicted++
      }
    }

    if (evicted > 0) {
      logger.debug({ evicted }, 'Evicted stale rate limit buckets')
    }

    return evicted
  }

  /**
   * Get statistics
   */
  getStats(): {
    clientCount: number
    config: RateLimitConfig
  } {
    return {
      clientCount: this.buckets.size,
      config: this.config,
    }
  }
}
