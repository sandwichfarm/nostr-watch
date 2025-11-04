/**
 * Monitor MCP Tools
 *
 * Provides access to monitor announcements and catalog
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type {
  MonitorsGetInput,
  MonitorsGetOutput,
  MonitorsListInput,
  MonitorsListOutput,
} from '../types/tool-schemas.js'
import type { StateCore } from '../core/index.js'
import { getLogger } from '../utils/logger.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const logger = getLogger().child({ module: 'tools-monitors' })

// Load output schemas
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const monitorsGetOutputSchema = JSON.parse(
  readFileSync(join(__dirname, '..', 'schemas', 'monitors-get-output.json'), 'utf-8')
)
const monitorsListOutputSchema = JSON.parse(
  readFileSync(join(__dirname, '..', 'schemas', 'monitors-list-output.json'), 'utf-8')
)

interface MonitorToolsContext {
  core: StateCore
}

/**
 * Create monitors/get tool
 */
export function createMonitorsGetTool(ctx: MonitorToolsContext): CVMTool {
  return {
    name: 'monitors/get',
    description: 'Get information about a specific monitor',
    inputSchema: {
      type: 'object',
      properties: {
        pubkey: { type: 'string' },
      },
      required: ['pubkey'],
    },
    outputSchema: monitorsGetOutputSchema,
    handler: async (params: MonitorsGetInput): Promise<MonitorsGetOutput> => {
      const monitor = ctx.core.query.monitors.get(params.pubkey)

      // Build analytics from available data
      let analytics: MonitorsGetOutput['analytics'] = undefined

      if (monitor) {
        const scores = ctx.core.query.monitors.getScores()
        const score = scores[params.pubkey]

        if (score) {
          analytics = {
            pubkey: params.pubkey,
            score: {
              pubkey: params.pubkey,
              reliabilityScore: score.reliability,
              timelinessScore: 0,  // Not yet computed
              consistencyScore: 0,  // Not yet computed
              errorRate: 0,  // Not yet computed
              lastUpdated: Date.now(),
              observationCount: 0,  // Not yet tracked
            },
            coverage: {
              pubkey: params.pubkey,
              relayCount: score.coverage,
              relayUrls: [],  // Not yet tracked per-monitor
              checks: {
                open: monitor.checks.includes('open'),
                read: monitor.checks.includes('read'),
                write: monitor.checks.includes('write'),
                info: monitor.checks.includes('info') || monitor.checks.includes('nips'),
                dns: monitor.checks.includes('dns'),
                geo: monitor.checks.includes('geo'),
              },
              namespaces: [],  // Not yet tracked
              labelCount: 0,  // Not yet tracked
              firstSeen: monitor.lastSeen,  // Approximation
              lastSeen: monitor.lastSeen,
              frequency: monitor.frequency,
            },
          }
        }
      }

      logger.info({
        pubkey: params.pubkey,
        found: !!monitor,
        hasAnalytics: !!analytics,
      }, 'Monitor info requested')

      return {
        monitor: monitor ?? null,
        analytics,
      }
    },
  }
}

/**
 * Create monitors/list tool
 */
export function createMonitorsListTool(ctx: MonitorToolsContext): CVMTool {
  return {
    name: 'monitors/list',
    description: 'List all known monitors',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 100 },
        offset: { type: 'number', default: 0 },
      },
    },
    outputSchema: monitorsListOutputSchema,
    handler: async (params: MonitorsListInput): Promise<MonitorsListOutput> => {
      const limit = params.limit || 100
      const offset = params.offset || 0

      const allMonitors = ctx.core.query.monitors.getAll()
      const total = allMonitors.length

      // Sort by last seen (most recent first)
      allMonitors.sort((a, b) => b.lastSeen - a.lastSeen)

      const paged = allMonitors.slice(offset, offset + limit)

      // Build analytics array for paged monitors
      const scores = ctx.core.query.monitors.getScores()
      const analytics: MonitorsListOutput['analytics'] = paged
        .map((monitor) => {
          const score = scores[monitor.pubkey]
          if (!score) return null

          return {
            pubkey: monitor.pubkey,
            score: {
              pubkey: monitor.pubkey,
              reliabilityScore: score.reliability,
              timelinessScore: 0,
              consistencyScore: 0,
              errorRate: 0,
              lastUpdated: Date.now(),
              observationCount: 0,
            },
            coverage: {
              pubkey: monitor.pubkey,
              relayCount: score.coverage,
              relayUrls: [],
              checks: {
                open: monitor.checks.includes('open'),
                read: monitor.checks.includes('read'),
                write: monitor.checks.includes('write'),
                info: monitor.checks.includes('info') || monitor.checks.includes('nips'),
                dns: monitor.checks.includes('dns'),
                geo: monitor.checks.includes('geo'),
              },
              namespaces: [],
              labelCount: 0,
              firstSeen: monitor.lastSeen,
              lastSeen: monitor.lastSeen,
              frequency: monitor.frequency,
            },
          }
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)

      logger.info({
        total,
        limit,
        offset,
        analyticsCount: analytics?.length || 0,
      }, 'Monitors list requested')

      return {
        monitors: paged,
        total,
        analytics: analytics.length > 0 ? analytics : undefined,
      }
    },
  }
}
