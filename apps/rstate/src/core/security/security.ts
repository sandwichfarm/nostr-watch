/**
 * Security Service
 *
 * Coordinates rate limiting, authorization, and input validation
 */

import type { RateLimiterService } from '../../services/rate-limiter.js'
import { shapeQuery, type QueryShape } from '../../utils/validation.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'security' })

export interface SecurityConfig {
  allowedPubkeys: string[]        // Allowlist for sensitive methods
  queryShape: QueryShape          // Query shaping limits
  enableRateLimiting: boolean     // Enable/disable rate limiting
  enableAuth: boolean             // Enable/disable authentication (testing convenience)
  allowAnyPubkey?: boolean        // When true, accept any authenticated pubkey (allowlist wildcard)
}

export class SecurityService {
  constructor(
    private rateLimiter: RateLimiterService,
    private config: SecurityConfig
  ) {
    logger.info({
      allowlistSize: config.allowedPubkeys.length,
      queryShape: config.queryShape,
      rateLimiting: config.enableRateLimiting,
    }, 'Security service initialized')
  }

  /**
   * Check if a request is authorized
   *
   * @param clientPubkey - Client public key (undefined if unauthenticated)
   * @param methodName - MCP tool name
   * @param params - Tool parameters
   * @returns { allowed: boolean, reason?: string, shaped?: any }
   */
  authorize(
    clientPubkey: string | undefined,
    methodName: string,
    params: any
  ): { allowed: boolean; reason?: string; shaped?: any } {
    // Check authentication for sensitive methods (if enabled)
    if (this.config.enableAuth && this.requiresAuth(methodName)) {
      if (!clientPubkey) {
        logger.warn({ methodName }, 'Unauthenticated request to sensitive method')
        return {
          allowed: false,
          reason: 'Authentication required for this method',
        }
      }

      // Check allowlist
      const allowAny = !!this.config.allowAnyPubkey || this.config.allowedPubkeys.includes('*')
      if (!allowAny && this.config.allowedPubkeys.length > 0) {
        if (!this.config.allowedPubkeys.includes(clientPubkey)) {
          logger.warn({
            methodName,
            clientPubkey: clientPubkey.slice(0, 8),
          }, 'Unauthorized request from non-allowlisted client')
          return {
            allowed: false,
            reason: 'Client not authorized for this method',
          }
        }
      }
    }

    // Rate limiting
    if (this.config.enableRateLimiting && clientPubkey) {
      const cost = this.getMethodCost(methodName)
      if (!this.rateLimiter.checkLimit(clientPubkey, cost)) {
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
        }
      }
    }

    // Query shaping
    try {
      const shaped = shapeQuery(params, this.config.queryShape)
      return { allowed: true, shaped }
    } catch (err: any) {
      logger.warn({ err, methodName }, 'Query shaping validation failed')
      return {
        allowed: false,
        reason: err.message || 'Invalid query parameters',
      }
    }
  }

  /**
   * Check if a method requires authentication
   */
  private requiresAuth(methodName: string): boolean {
    const sensitiveMethods = [
      'policy/set',
      // Add other sensitive methods as needed
    ]
    return sensitiveMethods.includes(methodName)
  }

  /**
   * Get rate limit cost for a method
   */
  private getMethodCost(methodName: string): number {
    // Expensive queries cost more
    const costMap: Record<string, number> = {
      'relays/list': 2,
      'relays/search': 5,
      'relays/by_nip': 5,
      'relays/by_software': 5,
      'relays/by_network': 3,
      'relays/by_country': 3,
      'relays/nearby': 3,
      'relays/bbox': 3,
      'relays/compare': 10,
      'monitors/list': 2,
      'policy/set': 10,
    }

    return costMap[methodName] || 1
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats()
  }

  /**
   * Evict stale rate limit buckets
   */
  evictStaleRateLimits(): number {
    return this.rateLimiter.evictStale()
  }
}
