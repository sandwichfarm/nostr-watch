/**
 * Relay Routes
 *
 * HTTP endpoints for relay state queries
 */

import type { FastifyInstance, FastifyReply } from 'fastify'
import type { RestContext } from '../server.js'
import { getPaymentsPreHandler } from '../payments.js'
import { getLogger } from '../../utils/logger.js'
import { compactRelayStates } from '../../utils/compact.js'
import { toCompact, toCompactArray, type ResponseFormat, type ResponseShape, applyShapeList, applyShapeSingle } from '../../types/response-formats.js'
import { schemas } from '../schemas.js'

const logger = getLogger().child({ module: 'rest-relays' })

/**
 * Helper to resolve format parameter and emit deprecation headers
 * Handles legacy 'compact' param (both string and boolean) for backward compatibility
 *
 * @param formatParam - The format query/body parameter ('full' | 'detailed' | 'simple' | 'compact' | undefined)
 * @param compactParam - Legacy compact parameter (boolean | undefined)
 * @param reply - Fastify reply object for setting deprecation headers
 * @returns ResponseShape - Resolved shape ('full' | 'detailed' | 'simple')
 */
function resolveFormatAndEmitDeprecation(
  formatParam: string | undefined,
  compactParam: boolean | string | undefined,
  reply: FastifyReply
): ResponseShape {
  // If format parameter is provided and valid, it takes precedence
  if (formatParam === 'full' || formatParam === 'detailed' || formatParam === 'simple') {
    return formatParam
  }

  // Handle legacy boolean/string compact parameter
  if (compactParam !== undefined) {
    reply.header('Deprecation', 'true')
    reply.header('Link', '</docs/migration#response-format>; rel="deprecation"')
    logger.warn('Legacy boolean compact parameter used, will be removed in future version')

    // Convert string "true"/"false" to boolean
    const compactBool = typeof compactParam === 'string'
      ? compactParam === 'true'
      : compactParam

    return compactBool ? 'detailed' : 'full'
  }

  // Handle legacy string 'compact' value (map to 'detailed' for now)
  if (formatParam === 'compact') {
    reply.header('Deprecation', 'true')
    reply.header('Link', '</docs/migration#response-format>; rel="deprecation"')
    logger.warn('Legacy format=compact used, use format=detailed instead')
    return 'detailed'
  }

  // Default to 'detailed' (current behavior)
  return 'detailed'
}

/**
 * Register relay routes
 */
export async function registerRelayRoutes(app: FastifyInstance, context: RestContext): Promise<void> {
  const { core } = context

  // Initialize payments pre-handler (if payments enabled)
  const paymentsPreHandler = await getPaymentsPreHandler()

  // GET /relays - List all relays (detailed by default)
  app.get<{
    Querystring: {
      limit?: number
      offset?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      format?: string
      compact?: boolean | string
    }
  }>('/relays', {
    schema: {
      tags: ['relays'],
      description: 'List all relay states with pagination (detailed format by default)',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50, maximum: 200 },
          offset: { type: 'number', default: 0, minimum: 0 },
          sortBy: { type: 'string', enum: ['url', 'updated', 'observationCount', 'lastSeen'], default: 'url' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (URLs only), compact (deprecated, use detailed)' },
        },
      },
      response: {
        200: schemas.relays.list,
      },
    },
  }, async (request, reply) => {
    const { limit = 50, offset = 0, sortBy = 'url', sortOrder = 'asc' } = request.query

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(request.query.format, request.query.compact, reply)

    const allStates = core.query.relays.getAll()

    // Sort
    allStates.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'url') {
        comparison = a.relayUrl.localeCompare(b.relayUrl)
      } else if (sortBy === 'updated') {
        comparison = (a.updated_at || 0) - (b.updated_at || 0)
      } else if (sortBy === 'observationCount') {
        comparison = (a.observationCount || 0) - (b.observationCount || 0)
      } else if (sortBy === 'lastSeen') {
        comparison = (a.lastSeenAt || 0) - (b.lastSeenAt || 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    let paged = allStates.slice(offset, offset + limit)

    // Apply three-level shaping
    const formatted = applyShapeList(paged, shape)

    return {
      relays: formatted as any,
      total: allStates.length,
      limit,
      offset,
    }
  })

  // GET /relays/state - Get single relay state (detailed by default)
  app.get<{
    Querystring: { relayUrl: string; format?: string; compact?: boolean | string }
  }>('/relays/state', {
    schema: {
      tags: ['relays'],
      description: 'Get state for a specific relay (detailed format by default)',
      querystring: {
        type: 'object',
        properties: {
          relayUrl: { type: 'string', format: 'uri' },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (treated as detailed for single relay), compact (deprecated, use detailed)' },
        },
        required: ['relayUrl'],
      },
      response: {
        200: schemas.relays.getState,
      },
    },
  }, async (request, reply) => {
    const { relayUrl } = request.query

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(request.query.format, request.query.compact, reply)

    let state = core.query.relays.getState(relayUrl)

    if (!state) {
      return reply.status(404).send({
        error: {
          code: 'RELAY_NOT_FOUND',
          message: `Relay ${relayUrl} not found`,
        },
      })
    }

    // Apply three-level shaping (simple is treated as detailed for single endpoints)
    const formatted = applyShapeSingle(state, shape)

    return { relay: formatted as any }
  })

  // POST /relays/search - Search relays with filters
  app.post<{
    Body: {
      network?: string
      nips?: number[]
      software?: { family?: string; version?: string }
      labels?: { namespace: string; value: string }[]
      maxLatency?: { open?: number; read?: number; write?: number }
      minSupport?: number
      limit?: number
      offset?: number
      format?: string
      compact?: boolean | string
    }
  }>('/relays/search', {
    schema: {
      tags: ['relays'],
      description: 'Search relays with complex filters, pagination, and three-level response shaping',
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Authorization header for paid routes. Formats: "L402 <macaroon>:<preimage>" or "Cashu <token>"'
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          network: { type: 'string' },
          nips: { type: 'array', items: { type: 'number' } },
          software: {
            type: 'object',
            properties: {
              family: { type: 'string' },
              version: { type: 'string' },
            },
          },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['namespace', 'value'],
            },
          },
          maxLatency: {
            type: 'object',
            properties: {
              open: { type: 'number' },
              read: { type: 'number' },
              write: { type: 'number' },
            },
          },
          minSupport: { type: 'number', minimum: 0, maximum: 1 },
          limit: { type: 'number', default: 100, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (URLs only), compact (deprecated, use detailed)' },
        },
      },
      response: {
        200: schemas.relays.list,
        402: {
          description: 'Payment Required when pricing applies. Returns 402 challenge headers.',
          type: 'object',
          properties: { error: { type: 'string', example: 'Payment Required' } },
          headers: {
            'WWW-Authenticate': { description: 'L402 challenge', schema: { type: 'string' } },
            'X-Cashu': { description: 'Cashu P2PK challenge', schema: { type: 'string' } }
          }
        }
      },
    },
    preHandler: paymentsPreHandler ? [paymentsPreHandler] : undefined,
  }, async (request, reply) => {
    const { limit = 100, offset = 0, format: reqFormat, compact, ...filters } = request.body

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(reqFormat, compact, reply)

    const results = core.query.relays.search(filters)
    const total = results.length

    // Apply pagination
    let paged = results.slice(offset, offset + limit)

    // Apply three-level shaping
    const formatted = applyShapeList(paged, shape)

    return { relays: formatted as any, total, limit, offset }
  })

  // GET /relays/nearby - Find relays near a point
  app.get<{
    Querystring: {
      lat: number
      lon: number
      radius?: number
      format?: string
      compact?: boolean | string
    }
  }>('/relays/nearby', {
    schema: {
      tags: ['relays'],
      description: 'Find relays near a geographic point',
      querystring: {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
          radius: { type: 'number', default: 100, minimum: 1 },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (URLs only), compact (deprecated)' },
        },
        required: ['lat', 'lon'],
      },
      response: {
        200: schemas.relays.nearby,
      },
    },
  }, async (request, reply) => {
    const { lat, lon, radius = 100 } = request.query

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(request.query.format, request.query.compact, reply)

    let results = core.query.relays.nearby(lat, lon, radius)

    // Apply three-level shaping
    const formatted = applyShapeList(results, shape)

    return {
      relays: formatted as any,
      center: { lat, lon },
      radius,
    }
  })

  // GET /relays/bbox - Find relays in bounding box
  app.get<{
    Querystring: {
      'sw.lat': number
      'sw.lon': number
      'ne.lat': number
      'ne.lon': number
      format?: string
      compact?: boolean | string
    }
  }>('/relays/bbox', {
    schema: {
      tags: ['relays'],
      description: 'Find relays within a bounding box',
      querystring: {
        type: 'object',
        properties: {
          'sw.lat': { type: 'number', minimum: -90, maximum: 90 },
          'sw.lon': { type: 'number', minimum: -180, maximum: 180 },
          'ne.lat': { type: 'number', minimum: -90, maximum: 90 },
          'ne.lon': { type: 'number', minimum: -180, maximum: 180 },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (URLs only), compact (deprecated)' },
        },
        required: ['sw.lat', 'sw.lon', 'ne.lat', 'ne.lon'],
      },
      response: {
        200: schemas.relays.bbox,
      },
    },
  }, async (request, reply) => {
    const query = request.query as any
    const sw = { lat: query['sw.lat'], lon: query['sw.lon'] }
    const ne = { lat: query['ne.lat'], lon: query['ne.lon'] }

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(query.format, query.compact, reply)

    let results = core.query.relays.bbox(sw, ne)

    // Apply three-level shaping
    const formatted = applyShapeList(results, shape)

    return {
      relays: formatted as any,
      bbox: { sw, ne },
      total: results.length,
    }
  })

  // GET /relays/labels - Get labels for a relay
  app.get<{
    Querystring: {
      relayUrl: string
      namespace?: string
    }
  }>('/relays/labels', {
    schema: {
      tags: ['relays'],
      description: 'Get labels for a specific relay',
      querystring: {
        type: 'object',
        properties: {
          relayUrl: { type: 'string', format: 'uri' },
          namespace: { type: 'string' },
        },
        required: ['relayUrl'],
      },
      response: {
        200: schemas.relays.getLabels,
      },
    },
  }, async (request, reply) => {
    const { relayUrl, namespace } = request.query
    const labels = core.query.relays.getLabels(relayUrl)

    if (namespace) {
      return { labels: { [namespace]: labels[namespace] || [] } }
    }

    return { labels }
  })

  // GET /relays/labels/list - List all available labels
  app.get<{
    Querystring: { namespace?: string }
  }>('/relays/labels/list', {
    schema: {
      tags: ['relays'],
      description: 'List all available labels',
      querystring: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
        },
      },
      response: {
        200: schemas.relays.listLabels,
      },
    },
  }, async (request, _reply) => {
    const { namespace } = request.query
    const labelsList = core.query.relays.listLabels(namespace)

    // Group by namespace (matching CVM tool output)
    const allLabels: Record<string, string[]> = {}
    const namespaces = new Set<string>()

    for (const { namespace: ns, value } of labelsList) {
      namespaces.add(ns)
      if (!allLabels[ns]) {
        allLabels[ns] = []
      }
      allLabels[ns].push(value)
    }

    return {
      namespaces: Array.from(namespaces).sort(),
      labels: allLabels,
    }
  })

  // GET /relays/by/label - Find relays by label
  app.get<{
    Querystring: {
      namespace: string
      value: string
      limit?: number
      offset?: number
      format?: string
      compact?: boolean
    }
  }>('/relays/by/label', {
    schema: {
      tags: ['relays'],
      description: 'Find relays with a specific label',
      querystring: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          value: { type: 'string' },
          limit: { type: 'number', default: 100, maximum: 200 },
          offset: { type: 'number', default: 0, minimum: 0 },
          format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (URLs only), compact (deprecated)' },
        },
        required: ['namespace', 'value'],
      },
      response: {
        200: schemas.relays.byLabel,
      },
    },
  }, async (request, reply) => {
    const { namespace, value, limit = 100, offset = 0 } = request.query

    // Resolve format with backward compatibility and deprecation handling
    const shape = resolveFormatAndEmitDeprecation(request.query.format, request.query.compact, reply)

    const relayUrls = core.query.relays.byLabel(namespace, value)
    const relays = relayUrls
      .map((url) => core.query.relays.getState(url))
      .filter((r) => r !== null)

    const total = relays.length
    let paged = relays.slice(offset, offset + limit)

    // Apply three-level shaping
    const formatted = applyShapeList(paged, shape)

    return {
      relays: formatted as any,
      label: { namespace, value },
      total,
    }
  })

  // GET /relays/by/software - Group relays by software
  app.get<{
    Querystring: { family?: string }
  }>('/relays/by/software', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by software family',
      querystring: {
        type: 'object',
        properties: {
          family: { type: 'string' },
        },
      },
      response: {
        200: schemas.relays.bySoftware,
      },
    },
  }, async (request, reply) => {
    const { family } = request.query
    const grouped = core.query.relays.bySoftware()

    if (family) {
      return { relays: grouped[family] || [], total: (grouped[family] || []).length }
    }

    return { groups: grouped }
  })

  // GET /relays/by/network - Group relays by network
  app.get('/relays/by/network', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by network type',
      response: {
        200: schemas.relays.byNetwork,
      },
    },
  }, async (request, reply) => {
    const grouped = core.query.relays.byNetwork()
    // Transform Record<string, string[]> to array format expected by schema
    const groups = Object.entries(grouped).map(([network, relays]) => ({
      network,
      count: relays.length,
      relays
    }))
    return { groups }
  })

  // GET /relays/by/nip - Group relays by NIP support
  app.get<{
    Querystring: {
      nip?: number
      minSupport?: number
    }
  }>('/relays/by/nip', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by NIP support',
      querystring: {
        type: 'object',
        properties: {
          nip: { type: 'number' },
          minSupport: { type: 'number', default: 0.5, minimum: 0, maximum: 1 },
        },
      },
      response: {
        200: schemas.relays.byNip,
      },
    },
  }, async (request, _reply) => {
    const { nip, minSupport = 0.5 } = request.query
    const nipData = core.query.relays.byNip()

    let groups = Object.entries(nipData).map(([nipNum, data]) => ({
      nip: Number(nipNum),
      count: data.relays.length,
      avgSupport: data.supportRatio,
      relays: data.relays,
    }))

    // Filter by specific NIP if requested
    if (nip !== undefined) {
      groups = groups.filter((g) => g.nip === nip)
    }

    return {
      groups: groups
        .filter((g) => g.avgSupport >= minSupport)
        .sort((a, b) => b.count - a.count),
    }
  })

  // GET /relays/by/country - Group relays by country
  app.get<{
    Querystring: { countryCode?: string }
  }>('/relays/by/country', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by country',
      querystring: {
        type: 'object',
        properties: {
          countryCode: { type: 'string', pattern: '^[A-Z]{2}$' },
        },
      },
      response: {
        200: schemas.relays.byCountry,
      },
    },
  }, async (request, _reply) => {
    const { countryCode } = request.query
    const groupsMap = core.query.relays.byCountry()

    let groups = Object.entries(groupsMap).map(([code, relays]) => {
      // Get country name from the first relay's labels
      const firstRelayState = core.query.relays.getState(relays[0])
      const countryName = firstRelayState?.labels?.['countryName']?.[0]

      return {
        countryCode: code,
        countryName,
        count: relays.length,
        relays,
      }
    })

    // Filter by specific country code if requested
    if (countryCode) {
      groups = groups.filter((g) => g.countryCode === countryCode)
    }

    return {
      groups: groups.sort((a, b) => b.count - a.count),
    }
  })

  // POST /relays/compare - Compare multiple relays
  app.post<{
    Body: { relayUrls: string[] }
  }>('/relays/compare', {
    schema: {
      tags: ['relays'],
      description: 'Compare multiple relays side-by-side',
      // Document Authorization header for 402 flows (L402 and Cashu)
      headers: {
        type: 'object',
        properties: {
          authorization: {
            type: 'string',
            description: 'Authorization header. Formats: "L402 <macaroon>:<preimage>" or "Cashu <token>". Example: L402 eyJ...:abcdef | Cashu cashuBeyJ...'
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          relayUrls: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ['relayUrls'],
      },
      response: {
        200: schemas.relays.compare,
        402: {
          description: 'Payment Required. Returns 402 challenge headers for supported methods.',
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Payment Required' },
          },
          headers: {
            'WWW-Authenticate': {
              description: 'L402 challenge with macaroon and BOLT11 invoice',
              schema: { type: 'string' },
              example: 'L402 macaroon="<base64url>", invoice="lnbc15000n1p..."',
            },
            'X-Cashu': {
              description: 'Cashu P2PK base64 challenge payload',
              schema: { type: 'string' },
              example: 'eyJtaW50IjoiaHR0cHM6Ly9taW50LmV4YW1wbGUuY29tIiwiYW1vdW50TXNhdCI6NTAwMCwicDJwa1B1YmtleSI6Ij...'
            },
          },
        },
      },
    },
    preHandler: paymentsPreHandler ? [paymentsPreHandler] : undefined,
  }, async (request, reply) => {
    const { relayUrls } = request.body
    const results = core.query.relays.compare(relayUrls)
    return { relays: results }
  })

  // POST /relays/online - Get online relays (supports label filtering)
  app.post<{
    Body: {
      onlineWindowSeconds?: number
      network?: string
      labels?: { namespace: string; value: string }[]
    }
  }>('/relays/online', {
    schema: {
      tags: ['relays'],
      description: 'Get currently online relays with optional label filtering',
      body: {
        type: 'object',
        properties: {
          onlineWindowSeconds: { type: 'number', minimum: 60 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['namespace', 'value'],
            },
          },
        },
      },
      response: {
        200: schemas.relays.availability,
      },
    },
  }, async (request, reply) => {
    const { onlineWindowSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.online({
      onlineWindowSeconds,
      filters,
    })
    return { relays, total: relays.length, limit: 0, offset: 0 }
  })

  // POST /relays/offline - Get offline relays (supports label filtering)
  app.post<{
    Body: {
      offlineSeenSeconds?: number
      offlineThresholdSeconds?: number
      network?: string
      labels?: { namespace: string; value: string }[]
    }
  }>('/relays/offline', {
    schema: {
      tags: ['relays'],
      description: 'Get recently seen but currently offline relays with optional label filtering',
      body: {
        type: 'object',
        properties: {
          offlineSeenSeconds: { type: 'number', minimum: 60 },
          offlineThresholdSeconds: { type: 'number', minimum: 60 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['namespace', 'value'],
            },
          },
        },
      },
      response: {
        200: schemas.relays.availability,
      },
    },
  }, async (request, reply) => {
    const { offlineSeenSeconds, offlineThresholdSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.offline({
      offlineSeenSeconds,
      offlineThresholdSeconds,
      filters,
    })
    return { relays, total: relays.length }
  })

  // POST /relays/dead - Get probably dead relays (supports label filtering)
  app.post<{
    Body: {
      deadThresholdSeconds?: number
      network?: string
      labels?: { namespace: string; value: string }[]
    }
  }>('/relays/dead', {
    schema: {
      tags: ['relays'],
      description: 'Get probably dead relays (not seen in a long time) with optional label filtering',
      body: {
        type: 'object',
        properties: {
          deadThresholdSeconds: { type: 'number', minimum: 3600 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                namespace: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['namespace', 'value'],
            },
          },
        },
      },
      response: {
        200: schemas.relays.availability,
      },
    },
  }, async (request, reply) => {
    const { deadThresholdSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.dead({
      deadThresholdSeconds,
      filters,
    })
    return { relays, total: relays.length }
  })

  logger.info('Relay routes registered')
}
