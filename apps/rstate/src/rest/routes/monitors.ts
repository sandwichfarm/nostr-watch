/**
 * Monitor Routes
 *
 * HTTP endpoints for monitor information
 */

import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'
import { getLogger } from '../../utils/logger.js'
import { schemas } from '../schemas.js'

const logger = getLogger().child({ module: 'rest-monitors' })

/**
 * Register monitor routes
 */
export async function registerMonitorRoutes(app: FastifyInstance, context: RestContext): Promise<void> {
  const { core } = context

  // GET /monitors/:pubkey - Get single monitor
  app.get<{
    Params: { pubkey: string }
  }>('/monitors/:pubkey', {
    schema: {
      tags: ['monitors'],
      description: 'Get information about a specific monitor',
      params: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', minLength: 64, maxLength: 64 },
        },
        required: ['pubkey'],
      },
      response: {
        200: schemas.monitors.get,
      },
    },
  }, async (request, reply) => {
    const { pubkey } = request.params

    const monitor = core.query.monitors.get(pubkey)

    if (!monitor) {
      return reply.status(404).send({
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${pubkey} not found`,
        },
      })
    }

    // Get analytics if available
    const scores = core.query.monitors.getScores()
    const score = scores[pubkey]

    const analytics = score
      ? {
          reliability: score.reliability,
          coverage: score.coverage,
          quality: score.quality,
        }
      : undefined

    return {
      monitor,
      analytics,
    }
  })

  // GET /monitors - List all monitors
  app.get<{
    Querystring: {
      limit?: number
      offset?: number
    }
  }>('/monitors', {
    schema: {
      tags: ['monitors'],
      description: 'List all monitors with pagination',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50, maximum: 200 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
      },
      response: {
        200: schemas.monitors.list,
      },
    },
  }, async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query

    const allMonitors = core.query.monitors.getAll()
    const total = allMonitors.length

    // Sort by last seen (most recent first)
    allMonitors.sort((a, b) => b.lastSeen - a.lastSeen)

    const paged = allMonitors.slice(offset, offset + limit)

    // Get scores for analytics
    const scores = core.query.monitors.getScores()
    const analytics = paged.map((monitor) => {
      const score = scores[monitor.pubkey]
      return score
        ? {
            pubkey: monitor.pubkey,
            reliability: score.reliability,
            coverage: score.coverage,
            quality: score.quality,
          }
        : null
    }).filter((a): a is NonNullable<typeof a> => a !== null)

    return {
      monitors: paged,
      total,
      limit,
      offset,
      analytics: analytics.length > 0 ? analytics : undefined,
    }
  })

  // GET /monitors/:pubkey/analytics - Get detailed analytics for a monitor
  app.get<{
    Params: { pubkey: string }
    Querystring: { includeRelayUrls?: boolean }
  }>('/monitors/:pubkey/analytics', {
    schema: {
      tags: ['monitors'],
      description: 'Get detailed reliability and coverage analytics for a specific monitor',
      params: {
        type: 'object',
        properties: {
          pubkey: { type: 'string', minLength: 64, maxLength: 64 },
        },
        required: ['pubkey'],
      },
      querystring: {
        type: 'object',
        properties: {
          includeRelayUrls: { type: 'boolean', default: false },
        },
      },
      response: {
        200: schemas.monitors.analytics,
      },
    },
  }, async (request, reply) => {
    const { pubkey } = request.params
    const { includeRelayUrls = false } = request.query

    const analytics = core.query.monitors.getAnalytics(pubkey)

    if (!analytics) {
      return reply.status(404).send({
        error: {
          code: 'ANALYTICS_NOT_FOUND',
          message: `Analytics for monitor ${pubkey} not found. Monitor may not have enough observations yet.`,
        },
      })
    }

    // Optionally strip relayUrls to reduce payload size
    if (!includeRelayUrls) {
      analytics.coverage = { ...analytics.coverage, relayUrls: [] }
    }

    return analytics
  })

  // GET /monitors/analytics - Get detailed analytics for all monitors
  app.get<{
    Querystring: { limit?: number; offset?: number; includeRelayUrls?: boolean }
  }>('/monitors/analytics', {
    schema: {
      tags: ['monitors'],
      description: 'Get detailed reliability and coverage analytics for all monitors',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 100, minimum: 0, maximum: 1000 },
          offset: { type: 'number', default: 0, minimum: 0 },
          includeRelayUrls: { type: 'boolean', default: false },
        },
      },
      response: {
        200: schemas.monitors.analyticsList,
      },
    },
  }, async (request, reply) => {
    const { limit = 100, offset = 0, includeRelayUrls = false } = request.query

    const all = core.query.monitors.getAllAnalytics()
    const total = all.length
    let paged = all.slice(offset, offset + limit)

    if (!includeRelayUrls) {
      paged = paged.map(a => ({ ...a, coverage: { ...a.coverage, relayUrls: [] } }))
    }

    return {
      analytics: paged,
      total,
      limit,
      offset,
    }
  })

  logger.info('Monitor routes registered')
}
