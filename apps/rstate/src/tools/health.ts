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
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const logger = getLogger().child({ module: 'health' })

// Load output schema
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const healthPingOutputSchema = JSON.parse(
  readFileSync(join(__dirname, '..', 'schemas', 'health-ping-output.json'), 'utf-8')
)

interface HealthToolContext {
  getRelayCount: () => { transport: number; ingestion: number }
  getObservationCount: () => number
  getUptime: () => number
  getReady?: () => boolean
  metrics?: MetricsService
  getMetricsSnapshot?: () => any
  queryCache?: QueryCache
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
    outputSchema: healthPingOutputSchema,
    handler: async (_params: HealthPingInput): Promise<HealthPingOutput> => {
      logger.debug('Health check requested')

      const relayCount = context.getRelayCount()
      const observationCount = context.getObservationCount()
      const uptime = context.getUptime()
      const ready = context.getReady ? context.getReady() : false

      // Determine status based on connectivity
      let status: 'ok' | 'degraded' | 'error' = 'ok'
      if (relayCount.transport === 0 && relayCount.ingestion === 0) {
        status = 'error'
      } else if (relayCount.transport === 0 || relayCount.ingestion === 0) {
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
