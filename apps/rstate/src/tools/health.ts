/**
 * Health Tool
 *
 * Provides server health check and version information
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type { HealthPingInput, HealthPingOutput } from '../types/tool-schemas.js'
import type { MetricsService } from '../services/metrics.js'
import type { QueryCache } from '../services/cache.js'
import { getLogger } from '../utils/logger.js'
import { loadSchema } from '../utils/schema-loader.js'

const logger = getLogger().child({ module: 'health' })

interface HealthToolContext {
  getRelayCount: () => { transport: number; ingestion: number }
  getObservationCount: () => number
  getUptime: () => number
  getReady?: () => boolean
  metrics?: MetricsService
  getMetricsSnapshot?: () => any
  queryCache?: QueryCache
  cvmEnabled?: boolean
}

/**
 * Create health/ping tool
 */
export function createHealthTool(context: HealthToolContext): CVMTool {
  return {
    name: 'health/ping',
    description: 'Check server health and get version information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    outputSchema: loadSchema('health-ping-output.json'),
    handler: async (_params: HealthPingInput): Promise<HealthPingOutput> => {
      logger.debug('Health check requested')

      const relayCount = context.getRelayCount()
      const observationCount = context.getObservationCount()
      const uptime = context.getUptime()
      const ready = context.getReady ? context.getReady() : false

      // Determine status based on connectivity
      // Only consider transport relays when CVM is enabled
      let status: 'ok' | 'degraded' | 'error' = 'ok'
      const transportOk = !context.cvmEnabled || relayCount.transport > 0
      const ingestionOk = relayCount.ingestion > 0
      if (!transportOk && !ingestionOk) {
        status = 'error'
      } else if (!transportOk || !ingestionOk) {
        status = 'degraded'
      }

      // Get cache stats if available
      const cacheStats = context.queryCache ? context.queryCache.getStats() : undefined
      const cache = cacheStats ? {
        ...cacheStats,
        hitRatePercent: Math.round(cacheStats.hitRate * 100 * 100) / 100,
      } : undefined

      const response: HealthPingOutput = {
        status,
        version: process.env.npm_package_version || '0.1.0',
        uptime,
        relayCount,
        observationCount,
        timestamp: Date.now(),
        metrics: context.getMetricsSnapshot ? context.getMetricsSnapshot() : undefined,
        cache,
        // extra field, schema tolerates
        // @ts-ignore
        ready,
      }

      logger.info({ status, uptime, relayCount, observationCount }, 'Health check completed')

      return response
    },
  }
}
