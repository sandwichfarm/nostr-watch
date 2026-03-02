/**
 * Relay Routes
 *
 * HTTP endpoints for relay state queries
 */

import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'
import { getLogger } from '../../utils/logger.js'
import { type ResponseShape, applyShapeList, applyShapeSingle } from '../../types/response-formats.js'
import { schemas } from '../schemas.js'
import { normalizeRelayUrl } from '../../utils/url.js'

const logger = getLogger().child({ module: 'rest-relays' })

/**
 * Helper to resolve format parameter
 *
 * @param formatParam - The format query/body parameter ('full' | 'detailed' | 'simple' | undefined)
 * @returns ResponseShape - Resolved shape ('full' | 'detailed' | 'simple')
 */
function resolveFormat(formatParam: string | undefined): ResponseShape {
  if (formatParam === 'full' || formatParam === 'detailed' || formatParam === 'simple') {
    return formatParam
  }

  // Default to 'detailed'
  return 'detailed'
}

/**
 * Register relay routes
 */
export async function registerRelayRoutes(app: FastifyInstance, context: RestContext): Promise<void> {
  const { core } = context

  // GET /relays - List all relays (detailed by default)
  app.get<{
    Querystring: {
      limit?: number
      offset?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      format?: string
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
          format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
        },
      },
      response: {
        200: schemas.relays.list,
      },
    },
  }, async (request, _reply) => {
    const { limit = 50, offset = 0, sortBy = 'url', sortOrder = 'asc' } = request.query

    // Resolve format
    const shape = resolveFormat(request.query.format)

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
    Querystring: { relayUrl: string; format?: string }
  }>('/relays/state', {
    schema: {
      tags: ['relays'],
      description: 'Get state for a specific relay (detailed format by default)',
      querystring: {
        type: 'object',
        properties: {
          relayUrl: { type: 'string', format: 'uri' },
          format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (treated as detailed for single relay)' },
        },
        required: ['relayUrl'],
      },
      response: {
        200: schemas.relays.getState,
      },
    },
  }, async (request, reply) => {
    const { relayUrl } = request.query

    // Resolve format
    const shape = resolveFormat(request.query.format)

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
    }
  }>('/relays/search', {
    schema: {
      tags: ['relays'],
      description: 'Search relays with complex filters, pagination, and three-level response shaping',
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
          format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
        },
      },
      response: {
        200: schemas.relays.list,
      },
    },
  }, async (request, _reply) => {
    const { limit = 100, offset = 0, format: reqFormat, ...filters } = request.body

    // Resolve format
    const shape = resolveFormat(reqFormat)

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
  }, async (request, _reply) => {
    const { lat, lon, radius = 100 } = request.query

    // Resolve format
    const shape = resolveFormat(request.query.format)

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
  }, async (request, _reply) => {
    const query = request.query as any
    const sw = { lat: query['sw.lat'], lon: query['sw.lon'] }
    const ne = { lat: query['ne.lat'], lon: query['ne.lon'] }

    // Resolve format
    const shape = resolveFormat(query.format)

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
  }, async (request, _reply) => {
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
  }, async (request, _reply) => {
    const { namespace, value, limit = 100, offset = 0 } = request.query

    // Resolve format
    const shape = resolveFormat(request.query.format)

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
  }, async (request, _reply) => {
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
  }, async (_request, _reply) => {
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
      },
    },
  }, async (request, _reply) => {
    const { relayUrls } = request.body

    // Normalize relay URLs
    const normalizedUrls: string[] = []
    for (const url of relayUrls) {
      try {
        normalizedUrls.push(normalizeRelayUrl(url))
      } catch (err) {
        logger.warn({ url, error: String(err) }, 'Invalid relay URL')
      }
    }

    const relays = core.query.relays.compare(normalizedUrls)
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (relays.length === 0) {
      return {
        relays: [],
        comparison: {
          common: { nips: [], requirements: [] },
          differences: { network: false, software: false, latency: false },
        },
      }
    }

    // Find common NIPs
    const nipSets = relays.map((r) => new Set(r.nips?.list || []))
    const commonNips = Array.from(nipSets[0]).filter((nip) =>
      nipSets.every((set) => set.has(nip))
    )

    // Find common requirements
    const reqKeys = new Set<string>()
    relays.forEach((r) => {
      if (r.requirements) {
        Object.keys(r.requirements).forEach((key) => reqKeys.add(key))
      }
    })
    const commonReqs = Array.from(reqKeys).filter((key) => {
      const values = relays
        .map((r) => r.requirements?.[key]?.value)
        .filter((v) => v !== undefined)
      return values.length === relays.length && values.every((v) => v === values[0])
    })

    // Check for differences
    const networks = new Set(relays.map((r) => r.network?.value).filter(Boolean))
    const softwareFamilies = new Set(relays.map((r) => r.software?.family?.value).filter(Boolean))

    // Check latency differences (consider different if > 20% variance)
    let latencyDiff = false
    for (const key of ['open', 'read', 'write'] as const) {
      const latencies = relays
        .map((r) => r.rtt?.[key]?.value)
        .filter((v): v is number => v !== undefined)
      if (latencies.length > 1) {
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const maxDiff = Math.max(...latencies.map((l) => Math.abs(l - avg)))
        if (maxDiff / avg > 0.2) {
          latencyDiff = true
          break
        }
      }
    }

    return {
      relays,
      comparison: {
        common: {
          nips: commonNips,
          requirements: commonReqs,
        },
        differences: {
          network: networks.size > 1,
          software: softwareFamilies.size > 1,
          latency: latencyDiff,
        },
      },
    }
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
      description: 'Get currently online relays. A relay is online if it responded within the max monitor frequency window. Defaults derived from monitor frequencies.',
      body: {
        type: 'object',
        properties: {
          onlineWindowSeconds: { type: 'number', minimum: 60, description: 'Override the online window in seconds (default: max monitor frequency)' },
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
  }, async (request, _reply) => {
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
      offlineThresholdSeconds?: number
      deadThresholdSeconds?: number
      network?: string
      labels?: { namespace: string; value: string }[]
    }
  }>('/relays/offline', {
    schema: {
      tags: ['relays'],
      description: 'Get relays that are offline but not yet dead. Offline means monitors checked recently but the relay did not respond. Defaults derived from monitor frequencies.',
      body: {
        type: 'object',
        properties: {
          offlineThresholdSeconds: { type: 'number', minimum: 60, description: 'Seconds since lastOpenAt to consider offline (default: max monitor frequency)' },
          deadThresholdSeconds: { type: 'number', minimum: 3600, description: 'Seconds since lastSeenAt beyond which relay is dead, not offline (default: 7 days)' },
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
  }, async (request, _reply) => {
    const { offlineThresholdSeconds, deadThresholdSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.offline({
      offlineThresholdSeconds,
      deadThresholdSeconds,
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
  }, async (request, _reply) => {
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
