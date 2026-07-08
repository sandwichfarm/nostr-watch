/**
 * Relay Routes
 *
 * HTTP endpoints for relay state queries
 * Each list endpoint is split into /simple, /detailed, /full variants
 */

import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'
import type { RelayState } from '../../types/aggregation.js'
import type { TrustAssertionStatus } from '../../core/trust/trusted-relay-assertions.js'
import { getLogger } from '../../utils/logger.js'
import { applyShapeList, applyShapeSingle } from '../../types/response-formats.js'
import { schemas } from '../schemas.js'
import { normalizeRelayUrl } from '../../utils/url.js'

const logger = getLogger().child({ module: 'rest-relays' })

// ─── Shared sort helpers ────────────────────────────────────────────

type SortBy = 'url' | 'updated' | 'observationCount' | 'lastSeen'

function sortRelays(relays: RelayState[], sortBy: SortBy, sortOrder: 'asc' | 'desc'): void {
  relays.sort((a, b) => {
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
}

// ─── Shared querystring schemas ─────────────────────────────────────

const sortQueryProps = {
  sortBy: { type: 'string' as const, enum: ['url', 'updated', 'observationCount', 'lastSeen'], default: 'url' },
  sortOrder: { type: 'string' as const, enum: ['asc', 'desc'], default: 'asc' },
}

const paginationQueryProps = {
  limit: { type: 'number' as const, default: 50, maximum: 200 },
  offset: { type: 'number' as const, default: 0, minimum: 0 },
}

/**
 * Register relay routes
 */
export async function registerRelayRoutes(app: FastifyInstance, context: RestContext): Promise<void> {
  const { core } = context

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/{simple,detailed,full}
  // ═══════════════════════════════════════════════════════════════════

  function getRelaysList(sortBy: SortBy = 'url', sortOrder: 'asc' | 'desc' = 'asc'): RelayState[] {
    const all = core.query.relays.getAll()
    sortRelays(all, sortBy, sortOrder)
    return all
  }

  // GET /relays/trust — single relay trust assertion
  app.get<{
    Querystring: { relayUrl: string }
  }>('/relays/trust', {
    schema: {
      tags: ['relays'],
      description: 'Get rstate trusted relay assertion for a specific relay',
      querystring: {
        type: 'object',
        properties: { relayUrl: { type: 'string', format: 'uri' } },
        required: ['relayUrl'],
      },
      response: { 200: schemas.relays.trust },
    },
  }, async (request, reply) => {
    const trust = core.query.trust(request.query.relayUrl)
    if (!trust) {
      return reply.status(404).send({ error: { code: 'RELAY_NOT_FOUND', message: `Relay ${request.query.relayUrl} not found` } })
    }
    return { trust }
  })

  // GET /relays/trust/list — paginated trust assertions
  app.get<{
    Querystring: {
      status?: TrustAssertionStatus
      minScore?: number
      minConfidence?: number
      includeUnreachable?: boolean
      limit?: number
      offset?: number
    }
  }>('/relays/trust/list', {
    schema: {
      tags: ['relays'],
      description: 'List rstate trusted relay assertions',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['evaluated', 'insufficient_data', 'unreachable', 'blocked'] },
          minScore: { type: 'number', minimum: 0, maximum: 100 },
          minConfidence: { type: 'number', minimum: 0, maximum: 100 },
          includeUnreachable: { type: 'boolean', default: true },
          limit: { type: 'number', default: 50, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
      },
      response: { 200: schemas.relays.trustList },
    },
  }, async (request) => {
    const { limit = 50, offset = 0, ...filters } = request.query
    const total = core.query.trustList(filters).length
    const assertions = core.query.trustList({ ...filters, limit, offset })
    return { assertions, total, limit, offset }
  })

  // GET /relays — no pagination, all results (simple format)
  app.get<{
    Querystring: { sortBy?: SortBy; sortOrder?: 'asc' | 'desc' }
  }>('/relays', {
    schema: {
      tags: ['relays'],
      description: 'List all relay URLs (simple format, no pagination)',
      querystring: { type: 'object', properties: { ...sortQueryProps } },
      response: { 200: schemas.relays.listSimple },
    },
  }, async (request) => {
    const { sortBy = 'url', sortOrder = 'asc' } = request.query
    const items = getRelaysList(sortBy, sortOrder)
    return { relays: applyShapeList(items, 'simple') as any, total: items.length }
  })

  // GET /relays/detailed — paginated
  app.get<{
    Querystring: { limit?: number; offset?: number; sortBy?: SortBy; sortOrder?: 'asc' | 'desc' }
  }>('/relays/detailed', {
    schema: {
      tags: ['relays'],
      description: 'List relay states in detailed format (no contributor attribution)',
      querystring: { type: 'object', properties: { ...paginationQueryProps, ...sortQueryProps } },
      response: { 200: schemas.relays.listObject },
    },
  }, async (request) => {
    const { limit = 50, offset = 0, sortBy = 'url', sortOrder = 'asc' } = request.query
    const items = getRelaysList(sortBy, sortOrder)
    const paged = items.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'detailed') as any, total: items.length, limit, offset }
  })

  // GET /relays/full — paginated
  app.get<{
    Querystring: { limit?: number; offset?: number; sortBy?: SortBy; sortOrder?: 'asc' | 'desc' }
  }>('/relays/full', {
    schema: {
      tags: ['relays'],
      description: 'List relay states in full format (with contributor attribution)',
      querystring: { type: 'object', properties: { ...paginationQueryProps, ...sortQueryProps } },
      response: { 200: schemas.relays.listObject },
    },
  }, async (request) => {
    const { limit = 50, offset = 0, sortBy = 'url', sortOrder = 'asc' } = request.query
    const items = getRelaysList(sortBy, sortOrder)
    const paged = items.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'full') as any, total: items.length, limit, offset }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/state — unchanged (single relay)
  // ═══════════════════════════════════════════════════════════════════

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
      response: { 200: schemas.relays.getState },
    },
  }, async (request, reply) => {
    const { relayUrl } = request.query
    const shape = (request.query.format === 'full' || request.query.format === 'detailed' || request.query.format === 'simple')
      ? request.query.format : 'detailed'

    let state = core.query.relays.getState(relayUrl)
    if (!state) {
      return reply.status(404).send({ error: { code: 'RELAY_NOT_FOUND', message: `Relay ${relayUrl} not found` } })
    }
    return { relay: applyShapeSingle(state, shape) as any }
  })

  // ═══════════════════════════════════════════════════════════════════
  // POST /relays/search/{simple,detailed,full}
  // ═══════════════════════════════════════════════════════════════════

  const searchBodyProps = {
    network: { type: 'string' as const },
    nips: { type: 'array' as const, items: { type: 'number' as const } },
    software: {
      type: 'object' as const,
      properties: {
        family: { type: 'string' as const },
        version: { type: 'string' as const },
      },
    },
    labels: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          namespace: { type: 'string' as const },
          value: { type: 'string' as const },
        },
        required: ['namespace', 'value'] as const,
      },
    },
    maxLatency: {
      type: 'object' as const,
      properties: {
        open: { type: 'number' as const },
        read: { type: 'number' as const },
        write: { type: 'number' as const },
      },
    },
    minSupport: { type: 'number' as const, minimum: 0, maximum: 1 },
  }

  function searchRelays(filters: any): RelayState[] {
    return core.query.relays.search(filters)
  }

  // POST /relays/search — no pagination, all results (simple format)
  app.post<{
    Body: {
      network?: string; nips?: number[]; software?: { family?: string; version?: string }
      labels?: { namespace: string; value: string }[]
      maxLatency?: { open?: number; read?: number; write?: number }
      minSupport?: number
    }
  }>('/relays/search', {
    schema: {
      tags: ['relays'],
      description: 'Search relays with filters, return URLs only (no pagination)',
      body: { type: 'object', properties: { ...searchBodyProps } },
      response: { 200: schemas.relays.searchSimple },
    },
  }, async (request) => {
    const results = searchRelays(request.body)
    return { relays: applyShapeList(results, 'simple') as any, total: results.length }
  })

  // POST /relays/search/detailed — paginated
  app.post<{
    Body: {
      network?: string; nips?: number[]; software?: { family?: string; version?: string }
      labels?: { namespace: string; value: string }[]
      maxLatency?: { open?: number; read?: number; write?: number }
      minSupport?: number; limit?: number; offset?: number
    }
  }>('/relays/search/detailed', {
    schema: {
      tags: ['relays'],
      description: 'Search relays with filters, return detailed format',
      body: {
        type: 'object',
        properties: {
          ...searchBodyProps,
          limit: { type: 'number', default: 100, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
      },
      response: { 200: schemas.relays.searchObject },
    },
  }, async (request) => {
    const { limit = 100, offset = 0, ...filters } = request.body
    const results = searchRelays(filters)
    const paged = results.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'detailed') as any, total: results.length, limit, offset }
  })

  // POST /relays/search/full — paginated
  app.post<{
    Body: {
      network?: string; nips?: number[]; software?: { family?: string; version?: string }
      labels?: { namespace: string; value: string }[]
      maxLatency?: { open?: number; read?: number; write?: number }
      minSupport?: number; limit?: number; offset?: number
    }
  }>('/relays/search/full', {
    schema: {
      tags: ['relays'],
      description: 'Search relays with filters, return full format with attribution',
      body: {
        type: 'object',
        properties: {
          ...searchBodyProps,
          limit: { type: 'number', default: 100, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
      },
      response: { 200: schemas.relays.searchObject },
    },
  }, async (request) => {
    const { limit = 100, offset = 0, ...filters } = request.body
    const results = searchRelays(filters)
    const paged = results.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'full') as any, total: results.length, limit, offset }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/nearby/{simple,detailed,full}
  // ═══════════════════════════════════════════════════════════════════

  const nearbyQueryProps = {
    lat: { type: 'number' as const, minimum: -90, maximum: 90 },
    lon: { type: 'number' as const, minimum: -180, maximum: 180 },
    radius: { type: 'number' as const, default: 100, minimum: 1 },
  }

  function nearbyRelays(lat: number, lon: number, radius: number): RelayState[] {
    return core.query.relays.nearby(lat, lon, radius)
  }

  // GET /relays/nearby — no pagination, returns {relayUrl, distance}[] (simple format)
  app.get<{
    Querystring: { lat: number; lon: number; radius?: number }
  }>('/relays/nearby', {
    schema: {
      tags: ['relays'],
      description: 'Find nearby relays, return URLs with distance (no pagination)',
      querystring: { type: 'object', properties: { ...nearbyQueryProps }, required: ['lat', 'lon'] },
      response: { 200: schemas.relays.nearbySimple },
    },
  }, async (request) => {
    const { lat, lon, radius = 100 } = request.query
    const results = nearbyRelays(lat, lon, radius)
    const relays = results.map((r: any) => ({ relayUrl: r.relayUrl, distance: r.distance }))
    return { relays, center: { lat, lon }, radius }
  })

  // GET /relays/nearby/detailed — no pagination (geo results naturally bounded by radius)
  app.get<{
    Querystring: { lat: number; lon: number; radius?: number }
  }>('/relays/nearby/detailed', {
    schema: {
      tags: ['relays'],
      description: 'Find nearby relays in detailed format',
      querystring: { type: 'object', properties: { ...nearbyQueryProps }, required: ['lat', 'lon'] },
      response: { 200: schemas.relays.nearbyObject },
    },
  }, async (request) => {
    const { lat, lon, radius = 100 } = request.query
    const results = nearbyRelays(lat, lon, radius)
    const shaped = applyShapeList(results, 'detailed') as any[]
    const relays = shaped.map((item: any, idx: number) => ({ ...item, distance: (results[idx] as any).distance }))
    return { relays, center: { lat, lon }, radius }
  })

  // GET /relays/nearby/full — no pagination
  app.get<{
    Querystring: { lat: number; lon: number; radius?: number }
  }>('/relays/nearby/full', {
    schema: {
      tags: ['relays'],
      description: 'Find nearby relays in full format with attribution',
      querystring: { type: 'object', properties: { ...nearbyQueryProps }, required: ['lat', 'lon'] },
      response: { 200: schemas.relays.nearbyObject },
    },
  }, async (request) => {
    const { lat, lon, radius = 100 } = request.query
    const results = nearbyRelays(lat, lon, radius)
    const shaped = applyShapeList(results, 'full') as any[]
    const relays = shaped.map((item: any, idx: number) => ({ ...item, distance: (results[idx] as any).distance }))
    return { relays, center: { lat, lon }, radius }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/bbox/{simple,detailed,full}
  // ═══════════════════════════════════════════════════════════════════

  const bboxQueryProps = {
    'sw.lat': { type: 'number' as const, minimum: -90, maximum: 90 },
    'sw.lon': { type: 'number' as const, minimum: -180, maximum: 180 },
    'ne.lat': { type: 'number' as const, minimum: -90, maximum: 90 },
    'ne.lon': { type: 'number' as const, minimum: -180, maximum: 180 },
  }

  function bboxRelays(query: any): { results: RelayState[]; sw: { lat: number; lon: number }; ne: { lat: number; lon: number } } {
    const sw = { lat: query['sw.lat'], lon: query['sw.lon'] }
    const ne = { lat: query['ne.lat'], lon: query['ne.lon'] }
    return { results: core.query.relays.bbox(sw, ne), sw, ne }
  }

  // GET /relays/bbox — no pagination (simple format)
  app.get<{
    Querystring: { 'sw.lat': number; 'sw.lon': number; 'ne.lat': number; 'ne.lon': number }
  }>('/relays/bbox', {
    schema: {
      tags: ['relays'],
      description: 'Find relays within a bounding box, return URLs only (no pagination)',
      querystring: { type: 'object', properties: { ...bboxQueryProps }, required: ['sw.lat', 'sw.lon', 'ne.lat', 'ne.lon'] },
      response: { 200: schemas.relays.bboxSimple },
    },
  }, async (request) => {
    const { results, sw, ne } = bboxRelays(request.query)
    return { relays: applyShapeList(results, 'simple') as any, bbox: { sw, ne }, total: results.length }
  })

  // GET /relays/bbox/detailed — paginated
  app.get<{
    Querystring: { 'sw.lat': number; 'sw.lon': number; 'ne.lat': number; 'ne.lon': number; limit?: number; offset?: number }
  }>('/relays/bbox/detailed', {
    schema: {
      tags: ['relays'],
      description: 'Find relays within a bounding box in detailed format',
      querystring: {
        type: 'object',
        properties: {
          ...bboxQueryProps,
          limit: { type: 'number', default: 100, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
        required: ['sw.lat', 'sw.lon', 'ne.lat', 'ne.lon'],
      },
      response: { 200: schemas.relays.bboxObject },
    },
  }, async (request) => {
    const query = request.query as any
    const { results, sw, ne } = bboxRelays(query)
    const limit = query.limit ?? 100
    const offset = query.offset ?? 0
    const paged = results.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'detailed') as any, bbox: { sw, ne }, total: results.length, limit, offset }
  })

  // GET /relays/bbox/full — paginated
  app.get<{
    Querystring: { 'sw.lat': number; 'sw.lon': number; 'ne.lat': number; 'ne.lon': number; limit?: number; offset?: number }
  }>('/relays/bbox/full', {
    schema: {
      tags: ['relays'],
      description: 'Find relays within a bounding box in full format with attribution',
      querystring: {
        type: 'object',
        properties: {
          ...bboxQueryProps,
          limit: { type: 'number', default: 100, maximum: 500 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
        required: ['sw.lat', 'sw.lon', 'ne.lat', 'ne.lon'],
      },
      response: { 200: schemas.relays.bboxObject },
    },
  }, async (request) => {
    const query = request.query as any
    const { results, sw, ne } = bboxRelays(query)
    const limit = query.limit ?? 100
    const offset = query.offset ?? 0
    const paged = results.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'full') as any, bbox: { sw, ne }, total: results.length, limit, offset }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/labels — unchanged
  // ═══════════════════════════════════════════════════════════════════

  app.get<{
    Querystring: { relayUrl: string; namespace?: string }
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
      response: { 200: schemas.relays.getLabels },
    },
  }, async (request) => {
    const { relayUrl, namespace } = request.query
    const labels = core.query.relays.getLabels(relayUrl)
    if (namespace) {
      return { labels: { [namespace]: labels[namespace] || [] } }
    }
    return { labels }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/labels/list — unchanged
  // ═══════════════════════════════════════════════════════════════════

  app.get<{
    Querystring: { namespace?: string }
  }>('/relays/labels/list', {
    schema: {
      tags: ['relays'],
      description: 'List all available labels',
      querystring: { type: 'object', properties: { namespace: { type: 'string' } } },
      response: { 200: schemas.relays.listLabels },
    },
  }, async (request) => {
    const { namespace } = request.query
    const labelsList = core.query.relays.listLabels(namespace)
    const allLabels: Record<string, string[]> = {}
    const namespaces = new Set<string>()
    for (const { namespace: ns, value } of labelsList) {
      namespaces.add(ns)
      if (!allLabels[ns]) allLabels[ns] = []
      allLabels[ns].push(value)
    }
    return { namespaces: Array.from(namespaces).sort(), labels: allLabels }
  })

  // ═══════════════════════════════════════════════════════════════════
  // GET /relays/by/label/{simple,detailed,full}
  // ═══════════════════════════════════════════════════════════════════

  function byLabelRelays(namespace: string, value: string): RelayState[] {
    const relayUrls = core.query.relays.byLabel(namespace, value)
    return relayUrls
      .map((url) => core.query.relays.getState(url))
      .filter((r): r is RelayState => r !== null)
  }

  // GET /relays/by/label — no pagination (simple format)
  app.get<{
    Querystring: { namespace: string; value: string }
  }>('/relays/by/label', {
    schema: {
      tags: ['relays'],
      description: 'Find relays with a specific label, return URLs only (no pagination)',
      querystring: {
        type: 'object',
        properties: { namespace: { type: 'string' }, value: { type: 'string' } },
        required: ['namespace', 'value'],
      },
      response: { 200: schemas.relays.byLabelSimple },
    },
  }, async (request) => {
    const { namespace, value } = request.query
    const relays = byLabelRelays(namespace, value)
    return { relays: applyShapeList(relays, 'simple') as any, label: { namespace, value }, total: relays.length }
  })

  // GET /relays/by/label/detailed — paginated
  app.get<{
    Querystring: { namespace: string; value: string; limit?: number; offset?: number }
  }>('/relays/by/label/detailed', {
    schema: {
      tags: ['relays'],
      description: 'Find relays with a specific label in detailed format',
      querystring: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          value: { type: 'string' },
          limit: { type: 'number', default: 100, maximum: 200 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
        required: ['namespace', 'value'],
      },
      response: { 200: schemas.relays.byLabelObject },
    },
  }, async (request) => {
    const { namespace, value, limit = 100, offset = 0 } = request.query
    const relays = byLabelRelays(namespace, value)
    const paged = relays.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'detailed') as any, label: { namespace, value }, total: relays.length, limit, offset }
  })

  // GET /relays/by/label/full — paginated
  app.get<{
    Querystring: { namespace: string; value: string; limit?: number; offset?: number }
  }>('/relays/by/label/full', {
    schema: {
      tags: ['relays'],
      description: 'Find relays with a specific label in full format with attribution',
      querystring: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          value: { type: 'string' },
          limit: { type: 'number', default: 100, maximum: 200 },
          offset: { type: 'number', default: 0, minimum: 0 },
        },
        required: ['namespace', 'value'],
      },
      response: { 200: schemas.relays.byLabelObject },
    },
  }, async (request) => {
    const { namespace, value, limit = 100, offset = 0 } = request.query
    const relays = byLabelRelays(namespace, value)
    const paged = relays.slice(offset, offset + limit)
    return { relays: applyShapeList(paged, 'full') as any, label: { namespace, value }, total: relays.length, limit, offset }
  })

  // ═══════════════════════════════════════════════════════════════════
  // Unchanged endpoints (no format splitting)
  // ═══════════════════════════════════════════════════════════════════

  // GET /relays/by/software
  app.get<{
    Querystring: { family?: string }
  }>('/relays/by/software', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by software family',
      querystring: { type: 'object', properties: { family: { type: 'string' } } },
      response: { 200: schemas.relays.bySoftware },
    },
  }, async (request) => {
    const { family } = request.query
    const grouped = core.query.relays.bySoftware()
    if (family) {
      return { relays: grouped[family] || [], total: (grouped[family] || []).length }
    }
    return { groups: grouped }
  })

  // GET /relays/by/network
  app.get('/relays/by/network', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by network type',
      response: { 200: schemas.relays.byNetwork },
    },
  }, async () => {
    const grouped = core.query.relays.byNetwork()
    const groups = Object.entries(grouped).map(([network, relays]) => ({
      network, count: relays.length, relays,
    }))
    return { groups }
  })

  // GET /relays/by/nip
  app.get<{
    Querystring: { nip?: number; minSupport?: number }
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
      response: { 200: schemas.relays.byNip },
    },
  }, async (request) => {
    const { nip, minSupport = 0.5 } = request.query
    const nipData = core.query.relays.byNip()
    let groups = Object.entries(nipData).map(([nipNum, data]) => ({
      nip: Number(nipNum), count: data.relays.length, avgSupport: data.supportRatio, relays: data.relays,
    }))
    if (nip !== undefined) {
      groups = groups.filter((g) => g.nip === nip)
    }
    return { groups: groups.filter((g) => g.avgSupport >= minSupport).sort((a, b) => b.count - a.count) }
  })

  // GET /relays/by/country
  app.get<{
    Querystring: { countryCode?: string }
  }>('/relays/by/country', {
    schema: {
      tags: ['relays'],
      description: 'Get relays grouped by country',
      querystring: {
        type: 'object',
        properties: { countryCode: { type: 'string', pattern: '^[A-Z]{2}$' } },
      },
      response: { 200: schemas.relays.byCountry },
    },
  }, async (request) => {
    const { countryCode } = request.query
    const groupsMap = core.query.relays.byCountry()
    let groups = Object.entries(groupsMap).map(([code, relays]) => {
      const firstRelayState = core.query.relays.getState(relays[0])
      const countryName = firstRelayState?.labels?.['countryName']?.[0]
      return { countryCode: code, countryName, count: relays.length, relays }
    })
    if (countryCode) {
      groups = groups.filter((g) => g.countryCode === countryCode)
    }
    return { groups: groups.sort((a, b) => b.count - a.count) }
  })

  // POST /relays/compare
  app.post<{
    Body: { relayUrls: string[] }
  }>('/relays/compare', {
    schema: {
      tags: ['relays'],
      description: 'Compare multiple relays side-by-side',
      body: {
        type: 'object',
        properties: {
          relayUrls: { type: 'array', items: { type: 'string', format: 'uri' }, minItems: 1, maxItems: 10 },
        },
        required: ['relayUrls'],
      },
      response: { 200: schemas.relays.compare },
    },
  }, async (request) => {
    const { relayUrls } = request.body
    const normalizedUrls: string[] = []
    for (const url of relayUrls) {
      try { normalizedUrls.push(normalizeRelayUrl(url)) } catch (err) {
        logger.warn({ url, error: String(err) }, 'Invalid relay URL')
      }
    }
    const relays = core.query.relays.compare(normalizedUrls).filter((r): r is NonNullable<typeof r> => r !== null)
    if (relays.length === 0) {
      return {
        relays: [],
        comparison: { common: { nips: [], requirements: [] }, differences: { network: false, software: false, latency: false } },
      }
    }
    const nipSets = relays.map((r) => new Set(r.nips?.list || []))
    const commonNips = Array.from(nipSets[0]).filter((nip) => nipSets.every((set) => set.has(nip)))
    const reqKeys = new Set<string>()
    relays.forEach((r) => { if (r.requirements) Object.keys(r.requirements).forEach((key) => reqKeys.add(key)) })
    const commonReqs = Array.from(reqKeys).filter((key) => {
      const values = relays.map((r) => r.requirements?.[key]?.value).filter((v) => v !== undefined)
      return values.length === relays.length && values.every((v) => v === values[0])
    })
    const networks = new Set(relays.map((r) => r.network?.value).filter(Boolean))
    const softwareFamilies = new Set(relays.map((r) => r.software?.family?.value).filter(Boolean))
    let latencyDiff = false
    for (const key of ['open', 'read', 'write'] as const) {
      const latencies = relays.map((r) => r.rtt?.[key]?.value).filter((v): v is number => v !== undefined)
      if (latencies.length > 1) {
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const maxDiff = Math.max(...latencies.map((l) => Math.abs(l - avg)))
        if (maxDiff / avg > 0.2) { latencyDiff = true; break }
      }
    }
    return {
      relays,
      comparison: {
        common: { nips: commonNips, requirements: commonReqs },
        differences: { network: networks.size > 1, software: softwareFamilies.size > 1, latency: latencyDiff },
      },
    }
  })

  // POST /relays/online
  app.post<{
    Body: { onlineWindowSeconds?: number; network?: string; labels?: { namespace: string; value: string }[] }
  }>('/relays/online', {
    schema: {
      tags: ['relays'],
      description: 'Get currently online relays',
      body: {
        type: 'object',
        properties: {
          onlineWindowSeconds: { type: 'number', minimum: 60 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
          },
        },
      },
      response: { 200: schemas.relays.availability },
    },
  }, async (request) => {
    const { onlineWindowSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.online({ onlineWindowSeconds, filters })
    return { relays, total: relays.length, limit: 0, offset: 0 }
  })

  // POST /relays/offline
  app.post<{
    Body: { offlineThresholdSeconds?: number; deadThresholdSeconds?: number; network?: string; labels?: { namespace: string; value: string }[] }
  }>('/relays/offline', {
    schema: {
      tags: ['relays'],
      description: 'Get relays that are offline but not yet dead',
      body: {
        type: 'object',
        properties: {
          offlineThresholdSeconds: { type: 'number', minimum: 60 },
          deadThresholdSeconds: { type: 'number', minimum: 3600 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
          },
        },
      },
      response: { 200: schemas.relays.availability },
    },
  }, async (request) => {
    const { offlineThresholdSeconds, deadThresholdSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.offline({ offlineThresholdSeconds, deadThresholdSeconds, filters })
    return { relays, total: relays.length }
  })

  // POST /relays/dead
  app.post<{
    Body: { deadThresholdSeconds?: number; network?: string; labels?: { namespace: string; value: string }[] }
  }>('/relays/dead', {
    schema: {
      tags: ['relays'],
      description: 'Get probably dead relays',
      body: {
        type: 'object',
        properties: {
          deadThresholdSeconds: { type: 'number', minimum: 3600 },
          network: { type: 'string' },
          labels: {
            type: 'array',
            items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
          },
        },
      },
      response: { 200: schemas.relays.availability },
    },
  }, async (request) => {
    const { deadThresholdSeconds, network, labels } = request.body
    const filters = (network || labels) ? { network, labels } : undefined
    const relays = core.query.relays.dead({ deadThresholdSeconds, filters })
    return { relays, total: relays.length }
  })

  logger.info('Relay routes registered')
}
