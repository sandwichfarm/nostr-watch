/**
 * Tool Wrapper Utilities
 *
 * Wraps MCP tools with security, caching, and metrics
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type { SecurityService } from '../services/security.js'
import type { QueryCache } from '../services/cache.js'
import type { MetricsService } from '../services/metrics.js'
import { getLogger } from './logger.js'

const logger = getLogger().child({ module: 'tool-wrapper' })

export interface ToolContext {
  security: SecurityService
  queryCache: QueryCache
  metrics: MetricsService
  getClientPubkey: () => string | undefined
}

/**
 * Wrap a tool with security, metrics, and error handling
 */
export function wrapTool(tool: CVMTool, context: ToolContext): CVMTool {
  return {
    ...tool,
    handler: async (params: any): Promise<any> => {
      const startTime = Date.now()
      const clientPubkey = context.getClientPubkey()

      try {
        // Security check
        const authResult = context.security.authorize(
          clientPubkey,
          tool.name,
          params
        )

        if (!authResult.allowed) {
          logger.warn({
            tool: tool.name,
            clientPubkey: clientPubkey?.slice(0, 8),
            reason: authResult.reason,
          }, 'Tool access denied')

          throw new Error(authResult.reason || 'Access denied')
        }

        // Use shaped parameters (validated and bounded)
        const shapedParams = authResult.shaped || params

        // Execute tool handler
        const result = await tool.handler(shapedParams)

        // Record success metrics
        const latency = Date.now() - startTime
        context.metrics.recordLatency(tool.name, latency)

        logger.debug({
          tool: tool.name,
          latency,
          clientPubkey: clientPubkey?.slice(0, 8),
        }, 'Tool call succeeded')

        return result
      } catch (err: any) {
        // Record failure metrics
        const latency = Date.now() - startTime
        context.metrics.recordLatency(tool.name, latency)

        logger.error({
          tool: tool.name,
          latency,
          clientPubkey: clientPubkey?.slice(0, 8),
          error: err.message,
        }, 'Tool call failed')

        throw err
      }
    },
  }
}

/**
 * Wrap a cacheable tool with read-through caching
 */
export function wrapCacheableTool(
  tool: CVMTool,
  context: ToolContext,
  options: {
    cacheKeyFn: (params: any) => string
    ttlSeconds?: number
  }
): CVMTool {
  return {
    ...tool,
    handler: async (params: any): Promise<any> => {
      const startTime = Date.now()
      const clientPubkey = context.getClientPubkey()

      try {
        // Security check
        const authResult = context.security.authorize(
          clientPubkey,
          tool.name,
          params
        )

        if (!authResult.allowed) {
          logger.warn({
            tool: tool.name,
            clientPubkey: clientPubkey?.slice(0, 8),
            reason: authResult.reason,
          }, 'Tool access denied')

          throw new Error(authResult.reason || 'Access denied')
        }

        const shapedParams = authResult.shaped || params

        // Try cache first
        const cacheKey = options.cacheKeyFn(shapedParams)
        const cached = context.queryCache.get(cacheKey)

        if (cached !== undefined) {
          const latency = Date.now() - startTime
          context.metrics.recordLatency(tool.name, latency)

          logger.debug({
            tool: tool.name,
            latency,
            cacheHit: true,
          }, 'Tool call (cached)')

          return cached
        }

        // Cache miss - execute tool
        const result = await tool.handler(shapedParams)

        // Store in cache
        context.queryCache.set(cacheKey, result, options.ttlSeconds)

        const latency = Date.now() - startTime
        context.metrics.recordLatency(tool.name, latency)

        logger.debug({
          tool: tool.name,
          latency,
          cacheHit: false,
        }, 'Tool call succeeded')

        return result
      } catch (err: any) {
        const latency = Date.now() - startTime
        context.metrics.recordLatency(tool.name, latency)

        logger.error({
          tool: tool.name,
          latency,
          error: err.message,
        }, 'Tool call failed')

        throw err
      }
    },
  }
}
