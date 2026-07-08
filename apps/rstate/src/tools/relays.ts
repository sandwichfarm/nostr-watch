/**
 * Relay MCP Tools
 *
 * Implements relay query, search, and geospatial tools.
 * Each list endpoint is split into /simple, /detailed, /full variants.
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type {
  RelaysListInput,
  RelaysGetStateInput,
  RelaysGetStateOutput,
  RelaysTrustInput,
  RelaysTrustOutput,
  RelaysTrustListInput,
  RelaysTrustListOutput,
  RelaysSearchInput,
  RelaysNearbyInput,
  RelaysBboxInput,
  RelaysGetLabelsInput,
  RelaysGetLabelsOutput,
  RelaysListLabelsInput,
  RelaysListLabelsOutput,
  RelaysByLabelInput,
  RelaysBySoftwareOutput,
  RelaysByNetworkOutput,
  RelaysByNipInput,
  RelaysByNipOutput,
  RelaysByCountryInput,
  RelaysByCountryOutput,
  RelaysCompareInput,
  RelaysCompareOutput,
  RelaysAvailabilityOnlineInput,
  RelaysAvailabilityOfflineInput,
  RelaysAvailabilityDeadInput,
  RelaysAvailabilityOutput,
} from '../types/tool-schemas.js'
import type { StateCore } from '../core/index.js'
import type { RelayState } from '../types/aggregation.js'
import { getLogger } from '../utils/logger.js'
import { type ResponseShape, applyShapeList, applyShapeSingle } from '../types/response-formats.js'
import { loadSchema } from '../utils/schema-loader.js'
import { normalizeRelayUrl } from '../utils/url.js'

const logger = getLogger().child({ module: 'tools-relays' })

interface RelayToolsContext {
  core: StateCore
}

// ─── Shared sort helpers ────────────────────────────────────────────

type SortBy = 'url' | 'updated' | 'observationCount'

function sortRelays(relays: RelayState[], sortBy: SortBy, sortOrder: 'asc' | 'desc'): void {
  relays.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'url') cmp = a.relayUrl.localeCompare(b.relayUrl)
    else if (sortBy === 'updated') cmp = a.updated_at - b.updated_at
    else if (sortBy === 'observationCount') cmp = a.observationCount - b.observationCount
    return sortOrder === 'asc' ? cmp : -cmp
  })
}

// ─── Shared input schema fragments ─────────────────────────────────

const sortInputProps = {
  sortBy: { type: 'string', enum: ['url', 'updated', 'observationCount'], default: 'url' },
  sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
}

const paginationInputProps = {
  limit: { type: 'number', default: 50 },
  offset: { type: 'number', default: 0 },
}

const searchInputProps = {
  network: { type: 'string', enum: ['clearnet', 'tor', 'i2p', 'hybrid'] },
  nips: { type: 'array', items: { type: 'number' } },
  software: {
    type: 'object',
    properties: { family: { type: 'string' }, version: { type: 'string' } },
  },
  labels: {
    type: 'array',
    items: {
      type: 'object',
      properties: { namespace: { type: 'string' }, value: { type: 'string' } },
      required: ['namespace', 'value'],
    },
  },
  maxLatency: {
    type: 'object',
    properties: { open: { type: 'number' }, read: { type: 'number' }, write: { type: 'number' } },
  },
  minSupport: { type: 'number' },
}

// ─── Shared core query helpers ──────────────────────────────────────

function relaysListCore(ctx: RelayToolsContext, params: RelaysListInput): RelayState[] {
  const sortBy = params.sortBy || 'url'
  const sortOrder = params.sortOrder || 'asc'
  const relays = ctx.core.query.relays.getAll()
  sortRelays(relays, sortBy, sortOrder)
  return relays
}

function relaysSearchCore(ctx: RelayToolsContext, params: RelaysSearchInput): RelayState[] {
  return ctx.core.query.relays.search(params)
}

function relaysNearbyCore(ctx: RelayToolsContext, params: RelaysNearbyInput): any[] {
  const radiusKm = params.radius || 100
  const maxResults = params.maxResults || 50
  const nearby = ctx.core.query.relays.nearby(params.lat, params.lon, radiusKm)
  return nearby.slice(0, maxResults)
}

function relaysBboxCore(ctx: RelayToolsContext, params: RelaysBboxInput): RelayState[] {
  return ctx.core.query.relays.bbox(params.sw, params.ne)
}

function relaysByLabelCore(ctx: RelayToolsContext, params: RelaysByLabelInput): RelayState[] {
  const relayUrls = ctx.core.query.relays.byLabel(params.namespace, params.value)
  return relayUrls
    .map((url) => ctx.core.query.relays.getState(url))
    .filter((r): r is RelayState => r !== null)
}

// ═══════════════════════════════════════════════════════════════════
// relays/list/{simple,detailed,full}
// ═══════════════════════════════════════════════════════════════════

export function createRelaysListTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list',
    description: 'Get a paginated list of relay URLs (simple format)',
    inputSchema: {
      type: 'object',
      properties: { ...paginationInputProps, ...sortInputProps },
    },
    outputSchema: loadSchema('relays-list-simple-output.json'),
    handler: async (params: RelaysListInput) => {
      const limit = params.limit || 50
      const offset = params.offset || 0
      const all = relaysListCore(ctx, params)
      const total = all.length
      const paged = all.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'simple')
      logger.info({ total, limit, offset, shape: 'simple' }, 'Relays list/simple requested')
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysListDetailedTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list/detailed',
    description: 'Get a paginated list of relay states (detailed format, no attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...paginationInputProps, ...sortInputProps },
    },
    outputSchema: loadSchema('relays-list-object-output.json'),
    handler: async (params: RelaysListInput) => {
      const limit = params.limit || 50
      const offset = params.offset || 0
      const all = relaysListCore(ctx, params)
      const total = all.length
      const paged = all.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'detailed')
      logger.info({ total, limit, offset, shape: 'detailed' }, 'Relays list/detailed requested')
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysListFullTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list/full',
    description: 'Get a paginated list of relay states (full format with attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...paginationInputProps, ...sortInputProps },
    },
    outputSchema: loadSchema('relays-list-object-output.json'),
    handler: async (params: RelaysListInput) => {
      const limit = params.limit || 50
      const offset = params.offset || 0
      const all = relaysListCore(ctx, params)
      const total = all.length
      const paged = all.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'full')
      logger.info({ total, limit, offset, shape: 'full' }, 'Relays list/full requested')
      return { relays, total, limit, offset }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/state — unchanged (single relay)
// ═══════════════════════════════════════════════════════════════════

export function createRelaysGetStateTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/state',
    description: 'Get state for a specific relay (detailed format by default)',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrl: { type: 'string' },
        format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (treated as detailed for single relay)' },
      },
      required: ['relayUrl'],
    },
    outputSchema: loadSchema('relays-get-state-output.json'),
    handler: async (params: RelaysGetStateInput): Promise<RelaysGetStateOutput> => {
      let relay = ctx.core.query.relays.getState(params.relayUrl)
      const shape: ResponseShape = ((params as any).format === 'full' || (params as any).format === 'detailed' || (params as any).format === 'simple')
        ? (params as any).format : 'detailed'
      const formatted = applyShapeSingle(relay, shape)
      logger.info({ relayUrl: params.relayUrl, found: !!relay, shape }, 'Relay state requested')
      return { relay: formatted as any }
    },
  }
}

export function createRelaysTrustTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/trust',
    description: 'Get rstate trusted relay assertion for a specific relay',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrl: { type: 'string' },
      },
      required: ['relayUrl'],
    },
    outputSchema: loadSchema('relays-trust-output.json'),
    handler: async (params: RelaysTrustInput): Promise<RelaysTrustOutput> => {
      return { trust: ctx.core.query.trust(params.relayUrl) }
    },
  }
}

export function createRelaysTrustListTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/trust/list',
    description: 'List rstate trusted relay assertions',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['evaluated', 'insufficient_data', 'unreachable', 'blocked'] },
        minScore: { type: 'number' },
        minConfidence: { type: 'number' },
        includeUnreachable: { type: 'boolean', default: true },
        limit: { type: 'number', default: 50 },
        offset: { type: 'number', default: 0 },
      },
    },
    outputSchema: loadSchema('relays-trust-list-output.json'),
    handler: async (params: RelaysTrustListInput): Promise<RelaysTrustListOutput> => {
      const limit = params.limit ?? 50
      const offset = params.offset ?? 0
      const filters = {
        status: params.status,
        minScore: params.minScore,
        minConfidence: params.minConfidence,
        includeUnreachable: params.includeUnreachable,
      }
      const total = ctx.core.query.trustList(filters).length
      const assertions = ctx.core.query.trustList({ ...filters, limit, offset })
      return { assertions, total, limit, offset }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/search/{simple,detailed,full}
// ═══════════════════════════════════════════════════════════════════

export function createRelaysSearchTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/search',
    description: 'Search relays with filters, return URLs only (simple format)',
    inputSchema: {
      type: 'object',
      properties: { ...searchInputProps, ...paginationInputProps },
    },
    outputSchema: loadSchema('relays-search-simple-output.json'),
    handler: async (params: RelaysSearchInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysSearchCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'simple')
      logger.info({ filters: params, total, shape: 'simple' }, 'Relay search/simple requested')
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysSearchDetailedTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/search/detailed',
    description: 'Search relays with filters (detailed format, no attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...searchInputProps, ...paginationInputProps },
    },
    outputSchema: loadSchema('relays-search-object-output.json'),
    handler: async (params: RelaysSearchInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysSearchCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'detailed')
      logger.info({ filters: params, total, shape: 'detailed' }, 'Relay search/detailed requested')
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysSearchFullTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/search/full',
    description: 'Search relays with filters (full format with attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...searchInputProps, ...paginationInputProps },
    },
    outputSchema: loadSchema('relays-search-object-output.json'),
    handler: async (params: RelaysSearchInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysSearchCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'full')
      logger.info({ filters: params, total, shape: 'full' }, 'Relay search/full requested')
      return { relays, total, limit, offset }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/nearby/{simple,detailed,full}
// ═══════════════════════════════════════════════════════════════════

const nearbyInputProps = {
  lat: { type: 'number' },
  lon: { type: 'number' },
  radius: { type: 'number', default: 100 },
  maxResults: { type: 'number', default: 50 },
}

export function createRelaysNearbyTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/nearby',
    description: 'Find nearby relays, return URLs with distance (simple format)',
    inputSchema: {
      type: 'object',
      properties: { ...nearbyInputProps },
      required: ['lat', 'lon'],
    },
    outputSchema: loadSchema('relays-nearby-simple-output.json'),
    handler: async (params: RelaysNearbyInput) => {
      const radiusKm = params.radius || 100
      const results = relaysNearbyCore(ctx, params)
      const relays = results.map((r: any) => ({ relayUrl: r.relayUrl, distance: r.distance }))
      logger.info({ lat: params.lat, lon: params.lon, radius: radiusKm, found: results.length, shape: 'simple' }, 'Nearby relays/simple requested')
      return { relays, center: { lat: params.lat, lon: params.lon }, radius: radiusKm }
    },
  }
}

export function createRelaysNearbyDetailedTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/nearby/detailed',
    description: 'Find nearby relays (detailed format, no attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...nearbyInputProps },
      required: ['lat', 'lon'],
    },
    outputSchema: loadSchema('relays-nearby-object-output.json'),
    handler: async (params: RelaysNearbyInput) => {
      const radiusKm = params.radius || 100
      const results = relaysNearbyCore(ctx, params)
      const shaped = applyShapeList(results, 'detailed') as any[]
      const relays = shaped.map((item: any, idx: number) => ({ ...item, distance: results[idx].distance }))
      logger.info({ lat: params.lat, lon: params.lon, radius: radiusKm, found: results.length, shape: 'detailed' }, 'Nearby relays/detailed requested')
      return { relays, center: { lat: params.lat, lon: params.lon }, radius: radiusKm }
    },
  }
}

export function createRelaysNearbyFullTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/nearby/full',
    description: 'Find nearby relays (full format with attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...nearbyInputProps },
      required: ['lat', 'lon'],
    },
    outputSchema: loadSchema('relays-nearby-object-output.json'),
    handler: async (params: RelaysNearbyInput) => {
      const radiusKm = params.radius || 100
      const results = relaysNearbyCore(ctx, params)
      const shaped = applyShapeList(results, 'full') as any[]
      const relays = shaped.map((item: any, idx: number) => ({ ...item, distance: results[idx].distance }))
      logger.info({ lat: params.lat, lon: params.lon, radius: radiusKm, found: results.length, shape: 'full' }, 'Nearby relays/full requested')
      return { relays, center: { lat: params.lat, lon: params.lon }, radius: radiusKm }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/bbox/{simple,detailed,full}
// ═══════════════════════════════════════════════════════════════════

const bboxInputProps = {
  sw: {
    type: 'object',
    properties: { lat: { type: 'number' }, lon: { type: 'number' } },
    required: ['lat', 'lon'],
  },
  ne: {
    type: 'object',
    properties: { lat: { type: 'number' }, lon: { type: 'number' } },
    required: ['lat', 'lon'],
  },
}

export function createRelaysBboxTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/bbox',
    description: 'Find relays within a bounding box, return URLs only (simple format)',
    inputSchema: {
      type: 'object',
      properties: { ...bboxInputProps, ...paginationInputProps },
      required: ['sw', 'ne'],
    },
    outputSchema: loadSchema('relays-bbox-simple-output.json'),
    handler: async (params: RelaysBboxInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysBboxCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'simple')
      logger.info({ bbox: params, found: total, shape: 'simple' }, 'Bbox/simple query requested')
      return { relays, bbox: { sw: params.sw, ne: params.ne }, total, limit, offset }
    },
  }
}

export function createRelaysBboxDetailedTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/bbox/detailed',
    description: 'Find relays within a bounding box (detailed format, no attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...bboxInputProps, ...paginationInputProps },
      required: ['sw', 'ne'],
    },
    outputSchema: loadSchema('relays-bbox-object-output.json'),
    handler: async (params: RelaysBboxInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysBboxCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'detailed')
      logger.info({ bbox: params, found: total, shape: 'detailed' }, 'Bbox/detailed query requested')
      return { relays, bbox: { sw: params.sw, ne: params.ne }, total, limit, offset }
    },
  }
}

export function createRelaysBboxFullTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/bbox/full',
    description: 'Find relays within a bounding box (full format with attribution)',
    inputSchema: {
      type: 'object',
      properties: { ...bboxInputProps, ...paginationInputProps },
      required: ['sw', 'ne'],
    },
    outputSchema: loadSchema('relays-bbox-object-output.json'),
    handler: async (params: RelaysBboxInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const results = relaysBboxCore(ctx, params)
      const total = results.length
      const paged = results.slice(offset, offset + limit)
      const relays = applyShapeList(paged, 'full')
      logger.info({ bbox: params, found: total, shape: 'full' }, 'Bbox/full query requested')
      return { relays, bbox: { sw: params.sw, ne: params.ne }, total, limit, offset }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/labels, relays/labels/list — unchanged
// ═══════════════════════════════════════════════════════════════════

export function createRelaysGetLabelsTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/labels',
    description: 'Get labels for a specific relay',
    inputSchema: {
      type: 'object',
      properties: { relayUrl: { type: 'string' }, namespace: { type: 'string' } },
      required: ['relayUrl'],
    },
    outputSchema: loadSchema('relays-get-labels-output.json'),
    handler: async (params: RelaysGetLabelsInput): Promise<RelaysGetLabelsOutput> => {
      let labels = ctx.core.query.relays.getLabels(params.relayUrl)
      if (params.namespace) {
        labels = { [params.namespace]: labels[params.namespace] || [] }
      }
      return { relayUrl: params.relayUrl, labels }
    },
  }
}

export function createRelaysListLabelsTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/labels/list',
    description: 'List all available labels',
    inputSchema: {
      type: 'object',
      properties: { namespace: { type: 'string' } },
    },
    outputSchema: loadSchema('relays-list-labels-output.json'),
    handler: async (params: RelaysListLabelsInput): Promise<RelaysListLabelsOutput> => {
      const labelsList = ctx.core.query.relays.listLabels(params.namespace)
      const allLabels: Record<string, string[]> = {}
      const namespaces = new Set<string>()
      for (const { namespace, value } of labelsList) {
        namespaces.add(namespace)
        if (!allLabels[namespace]) allLabels[namespace] = []
        allLabels[namespace].push(value)
      }
      return { namespaces: Array.from(namespaces).sort(), labels: allLabels }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// relays/by/label/{simple,detailed,full}
// ═══════════════════════════════════════════════════════════════════

export function createRelaysByLabelTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/label',
    description: 'Get relays with a specific label, return URLs only (simple format)',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' }, value: { type: 'string' },
        ...paginationInputProps,
      },
      required: ['namespace', 'value'],
    },
    outputSchema: loadSchema('relays-by-label-simple-output.json'),
    handler: async (params: RelaysByLabelInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const relays = relaysByLabelCore(ctx, params)
      const total = relays.length
      const paged = relays.slice(offset, offset + limit)
      const formatted = applyShapeList(paged, 'simple')
      return { relays: formatted, label: { namespace: params.namespace, value: params.value }, total, limit, offset }
    },
  }
}

export function createRelaysByLabelDetailedTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/label/detailed',
    description: 'Get relays with a specific label (detailed format, no attribution)',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' }, value: { type: 'string' },
        ...paginationInputProps,
      },
      required: ['namespace', 'value'],
    },
    outputSchema: loadSchema('relays-by-label-object-output.json'),
    handler: async (params: RelaysByLabelInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const relays = relaysByLabelCore(ctx, params)
      const total = relays.length
      const paged = relays.slice(offset, offset + limit)
      const formatted = applyShapeList(paged, 'detailed')
      return { relays: formatted, label: { namespace: params.namespace, value: params.value }, total, limit, offset }
    },
  }
}

export function createRelaysByLabelFullTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/label/full',
    description: 'Get relays with a specific label (full format with attribution)',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' }, value: { type: 'string' },
        ...paginationInputProps,
      },
      required: ['namespace', 'value'],
    },
    outputSchema: loadSchema('relays-by-label-object-output.json'),
    handler: async (params: RelaysByLabelInput) => {
      const limit = params.limit || 100
      const offset = params.offset || 0
      const relays = relaysByLabelCore(ctx, params)
      const total = relays.length
      const paged = relays.slice(offset, offset + limit)
      const formatted = applyShapeList(paged, 'full')
      return { relays: formatted, label: { namespace: params.namespace, value: params.value }, total, limit, offset }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// Unchanged tools (no format splitting)
// ═══════════════════════════════════════════════════════════════════

export function createRelaysBySoftwareTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/software',
    description: 'Group relays by software',
    inputSchema: {
      type: 'object',
      properties: { family: { type: 'string' } },
    },
    outputSchema: loadSchema('relays-by-software-output.json'),
    handler: async (params: { family?: string }): Promise<RelaysBySoftwareOutput> => {
      const groupsMap = ctx.core.query.relays.bySoftware()

      if (params.family) {
        const relays = groupsMap[params.family] || []
        return {
          groups: relays.length > 0
            ? [{ family: params.family, count: relays.length, relays }]
            : [],
        }
      }

      return {
        groups: Object.entries(groupsMap).map(([family, relays]) => ({
          family, count: relays.length, relays,
        })),
      }
    },
  }
}

export function createRelaysByNetworkTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/network',
    description: 'Group relays by network',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: loadSchema('relays-by-network-output.json'),
    handler: async (): Promise<RelaysByNetworkOutput> => {
      const groupsMap = ctx.core.query.relays.byNetwork()
      return {
        groups: Object.entries(groupsMap).map(([network, relays]) => ({
          network: network as any, count: relays.length, relays,
        })),
      }
    },
  }
}

export function createRelaysByNipTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/nip',
    description: 'Group relays by NIP support',
    inputSchema: {
      type: 'object',
      properties: { nip: { type: 'number' }, minSupport: { type: 'number', default: 0.5 } },
    },
    outputSchema: loadSchema('relays-by-nip-output.json'),
    handler: async (params: RelaysByNipInput): Promise<RelaysByNipOutput> => {
      const nipData = ctx.core.query.relays.byNip()
      const minSupport = params.minSupport || 0.5
      let groups = Object.entries(nipData).map(([nip, data]) => ({
        nip: Number(nip), count: data.relays.length, avgSupport: data.supportRatio, relays: data.relays,
      }))
      if (params.nip !== undefined) {
        groups = groups.filter((g) => g.nip === params.nip)
      }
      return { groups: groups.filter((g) => g.avgSupport >= minSupport).sort((a, b) => b.count - a.count) }
    },
  }
}

export function createRelaysByCountryTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/country',
    description: 'Group relays by country',
    inputSchema: {
      type: 'object',
      properties: { countryCode: { type: 'string' } },
    },
    outputSchema: loadSchema('relays-by-country-output.json'),
    handler: async (params: RelaysByCountryInput): Promise<RelaysByCountryOutput> => {
      const groupsMap = ctx.core.query.relays.byCountry()
      let groups = Object.entries(groupsMap).map(([countryCode, relays]) => {
        const firstRelayState = ctx.core.query.relays.getState(relays[0])
        const countryName = firstRelayState?.labels?.['countryName']?.[0]
        return { countryCode, countryName, count: relays.length, relays }
      })
      if (params.countryCode) {
        groups = groups.filter((g) => g.countryCode === params.countryCode)
      }
      return { groups: groups.sort((a, b) => b.count - a.count) }
    },
  }
}

export function createRelaysCompareTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/compare',
    description: 'Compare multiple relays side-by-side',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrls: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 10 },
      },
      required: ['relayUrls'],
    },
    outputSchema: loadSchema('relays-compare-output.json'),
    handler: async (params: RelaysCompareInput): Promise<RelaysCompareOutput> => {
      const normalizedUrls: string[] = []
      for (const url of params.relayUrls) {
        try { normalizedUrls.push(normalizeRelayUrl(url)) } catch (err) {
          logger.warn({ url, error: String(err) }, 'Invalid relay URL')
        }
      }
      const relays = ctx.core.query.relays.compare(normalizedUrls).filter((r): r is NonNullable<typeof r> => r !== null)
      if (relays.length === 0) {
        return { relays: [], comparison: { common: { nips: [], requirements: [] }, differences: { network: false, software: false, latency: false } } }
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
    },
  }
}

// ═══════════════════════════════════════════════════════════════════
// Availability tools — unchanged
// ═══════════════════════════════════════════════════════════════════

export function createRelaysOnlineTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/online',
    description: 'List relays considered online (recent successful open)',
    inputSchema: {
      type: 'object',
      properties: {
        onlineWindowSeconds: { type: 'number' },
        filters: {
          type: 'object',
          properties: {
            network: { type: 'string' },
            labels: {
              type: 'array',
              items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
            },
          },
        },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    outputSchema: loadSchema('relays-availability-output.json'),
    handler: async (params: RelaysAvailabilityOnlineInput): Promise<RelaysAvailabilityOutput> => {
      const urls = ctx.core.query.relays.online({ onlineWindowSeconds: params.onlineWindowSeconds, filters: params.filters })
      const limit = params.limit ?? 100
      const offset = params.offset ?? 0
      const total = urls.length
      const relays = urls.slice(offset, offset + limit)
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysOfflineTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/offline',
    description: 'List relays considered offline (monitors checked but relay did not respond, not yet dead)',
    inputSchema: {
      type: 'object',
      properties: {
        offlineThresholdSeconds: { type: 'number' },
        deadThresholdSeconds: { type: 'number' },
        filters: {
          type: 'object',
          properties: {
            network: { type: 'string' },
            labels: {
              type: 'array',
              items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
            },
          },
        },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    outputSchema: loadSchema('relays-availability-output.json'),
    handler: async (params: RelaysAvailabilityOfflineInput): Promise<RelaysAvailabilityOutput> => {
      const urls = ctx.core.query.relays.offline({
        offlineThresholdSeconds: params.offlineThresholdSeconds,
        deadThresholdSeconds: params.deadThresholdSeconds,
        filters: params.filters,
      })
      const limit = params.limit ?? 100
      const offset = params.offset ?? 0
      const total = urls.length
      const relays = urls.slice(offset, offset + limit)
      return { relays, total, limit, offset }
    },
  }
}

export function createRelaysDeadTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/dead',
    description: 'List relays considered dead (not seen for a long time)',
    inputSchema: {
      type: 'object',
      properties: {
        deadThresholdSeconds: { type: 'number' },
        filters: {
          type: 'object',
          properties: {
            network: { type: 'string' },
            labels: {
              type: 'array',
              items: { type: 'object', properties: { namespace: { type: 'string' }, value: { type: 'string' } }, required: ['namespace', 'value'] },
            },
          },
        },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
    outputSchema: loadSchema('relays-availability-output.json'),
    handler: async (params: RelaysAvailabilityDeadInput): Promise<RelaysAvailabilityOutput> => {
      const urls = ctx.core.query.relays.dead({ deadThresholdSeconds: params.deadThresholdSeconds, filters: params.filters })
      const limit = params.limit ?? 100
      const offset = params.offset ?? 0
      const total = urls.length
      const relays = urls.slice(offset, offset + limit)
      return { relays, total, limit, offset }
    },
  }
}
