/**
 * Relay MCP Tools
 *
 * Implements relay query, search, and geospatial tools
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type {
  RelaysListInput,
  RelaysListOutput,
  RelaysGetStateInput,
  RelaysGetStateOutput,
  RelaysSearchInput,
  RelaysSearchOutput,
  RelaysNearbyInput,
  RelaysNearbyOutput,
  RelaysBboxInput,
  RelaysBboxOutput,
  RelaysGetLabelsInput,
  RelaysGetLabelsOutput,
  RelaysListLabelsInput,
  RelaysListLabelsOutput,
  RelaysByLabelInput,
  RelaysByLabelOutput,
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
import { getLogger } from '../utils/logger.js'
import { toCompactArray, type ResponseFormat, type ResponseShape, applyShapeList, applyShapeSingle } from '../types/response-formats.js'
import { loadSchema } from '../utils/schema-loader.js'
import { normalizeRelayUrl } from '../utils/url.js'

const logger = getLogger().child({ module: 'tools-relays' })

/**
 * Helper to resolve format parameter for CVM tools
 *
 * @param formatParam - The format parameter ('full' | 'detailed' | 'simple' | undefined)
 * @returns ResponseShape - Resolved shape ('full' | 'detailed' | 'simple')
 */
function resolveFormat(formatParam: string | undefined): ResponseShape {
  if (formatParam === 'full' || formatParam === 'detailed' || formatParam === 'simple') {
    return formatParam
  }

  // Default to 'detailed'
  return 'detailed'
}

// Schemas are loaded lazily via loadSchema() utility

interface RelayToolsContext {
  core: StateCore
}

/**
 * Create relays/list tool
 */
export function createRelaysListTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list',
    description: 'Get a paginated list of all relays',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 },
        offset: { type: 'number', default: 0 },
        sortBy: { type: 'string', enum: ['url', 'updated', 'observationCount'], default: 'url' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
      },
    },
    outputSchema: loadSchema('relays-list-output.json'),
    handler: async (params: RelaysListInput): Promise<RelaysListOutput> => {
      const limit = params.limit || 50
      const offset = params.offset || 0
      const sortBy = params.sortBy || 'url'
      const sortOrder = params.sortOrder || 'asc'

      // Resolve format
      const shape = resolveFormat((params as any).format)

      let relays = ctx.core.query.relays.getAll()

      // Sort
      relays.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'url') {
          cmp = a.relayUrl.localeCompare(b.relayUrl)
        } else if (sortBy === 'updated') {
          cmp = a.updated_at - b.updated_at
        } else if (sortBy === 'observationCount') {
          cmp = a.observationCount - b.observationCount
        }
        return sortOrder === 'asc' ? cmp : -cmp
      })

      const total = relays.length
      let paged = relays.slice(offset, offset + limit)

      // Apply three-level shaping
      const formatted = applyShapeList(paged, shape)

      logger.info({ total, limit, offset, shape }, 'Relays list requested')

      return { relays: formatted as any, total, limit, offset }
    },
  }
}

/**
 * Create relays/get_state tool
 */
export function createRelaysGetStateTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/state',
    description: 'Get state for a specific relay (detailed format by default)',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrl: { type: 'string' },
        format: { type: 'string', enum: ['full', 'detailed', 'simple', 'compact'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, aggregated), simple (treated as detailed for single relay), compact (deprecated, use detailed)' },
      },
      required: ['relayUrl'],
    },
    outputSchema: loadSchema('relays-get-state-output.json'),
    handler: async (params: RelaysGetStateInput): Promise<RelaysGetStateOutput> => {
      let relay = ctx.core.query.relays.getState(params.relayUrl)

      // Resolve format
      const shape = resolveFormat((params as any).format)

      // Apply three-level shaping (simple is treated as detailed for single endpoints)
      const formatted = applyShapeSingle(relay, shape)

      logger.info({ relayUrl: params.relayUrl, found: !!relay, shape }, 'Relay state requested')
      return { relay: formatted as any }
    },
  }
}

/**
 * Create relays/search tool
 */
export function createRelaysSearchTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/search',
    description: 'Search relays with filters (detailed format by default)',
    inputSchema: {
      type: 'object',
      properties: {
        network: { type: 'string', enum: ['clearnet', 'tor', 'i2p', 'hybrid'] },
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
        minSupport: { type: 'number' },
        limit: { type: 'number', default: 100 },
        offset: { type: 'number', default: 0 },
        format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
      },
    },
    outputSchema: loadSchema('relays-list-output.json'),
    handler: async (params: RelaysSearchInput): Promise<RelaysSearchOutput> => {
      const limit = params.limit || 100
      const offset = params.offset || 0

      // Resolve format
      const shape = resolveFormat((params as any).format)

      let relays = ctx.core.query.relays.search(params)
      const total = relays.length
      let paged = relays.slice(offset, offset + limit)

      // Apply three-level shaping
      const formatted = applyShapeList(paged, shape)

      logger.info({ filters: params, total, shape }, 'Relay search requested')

      return { relays: formatted as any, total, limit, offset }
    },
  }
}

/**
 * Create relays/nearby tool
 */
export function createRelaysNearbyTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/nearby',
    description: 'Find relays near a geographic location (detailed format by default)',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lon: { type: 'number' },
        radius: { type: 'number', default: 100 },
        maxResults: { type: 'number', default: 50 },
        format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
      },
      required: ['lat', 'lon'],
    },
    outputSchema: loadSchema('relays-nearby-output.json'),
    handler: async (params: RelaysNearbyInput): Promise<RelaysNearbyOutput> => {
      const radiusKm = params.radius || 100
      const maxResults = params.maxResults || 50

      // Resolve format
      const shape = resolveFormat((params as any).format)

      const nearby = ctx.core.query.relays.nearby(params.lat, params.lon, radiusKm)

      const limitedRaw: any[] = nearby.slice(0, maxResults)

      // Apply three-level shaping and preserve distance
      const formatted = applyShapeList(limitedRaw, shape)
      const limited = (formatted as any[]).map((item: any, idx: number) => {
        // For simple format (string[]), we need to preserve distance differently
        if (typeof item === 'string') {
          return { relayUrl: item, distance: limitedRaw[idx].distance }
        }
        // For full/detailed formats (objects), add distance property
        return { ...item, distance: limitedRaw[idx].distance }
      })

      logger.info({
        lat: params.lat,
        lon: params.lon,
        radius: radiusKm,
        found: nearby.length,
        shape,
      }, 'Nearby relays requested')

      return {
        relays: limited,
        center: { lat: params.lat, lon: params.lon },
        radius: radiusKm,
      }
    },
  }
}

/**
 * Create relays/bbox tool
 */
export function createRelaysBboxTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/bbox',
    description: 'Find relays within a bounding box',
    inputSchema: {
      type: 'object',
      properties: {
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
        limit: { type: 'number', default: 100 },
        compact: { type: 'boolean', default: false },
      },
      required: ['sw', 'ne'],
    },
    outputSchema: loadSchema('relays-bbox-output.json'),
    handler: async (params: RelaysBboxInput): Promise<RelaysBboxOutput> => {
      const limit = params.limit || 100
      const compact = params.compact || false

      const inBbox = ctx.core.query.relays.bbox(params.sw, params.ne)

      const total = inBbox.length
      let limited: any = inBbox.slice(0, limit)

      // Apply compact mode if requested
      if (compact) {
        limited = compactRelayStates(limited as any) as any
      }

      logger.info({ bbox: params, found: total, compact }, 'Bbox query requested')

      return {
        relays: limited,
        bbox: { sw: params.sw, ne: params.ne },
        total,
      }
    },
  }
}

/**
 * Create relays/get_labels tool
 */
export function createRelaysGetLabelsTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/labels',
    description: 'Get labels for a specific relay',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrl: { type: 'string' },
        namespace: { type: 'string' },
      },
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

/**
 * Create relays/list_labels tool
 */
export function createRelaysListLabelsTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/labels/list',
    description: 'List all available labels',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' },
      },
    },
    outputSchema: loadSchema('relays-list-labels-output.json'),
    handler: async (params: RelaysListLabelsInput): Promise<RelaysListLabelsOutput> => {
      const labelsList = ctx.core.query.relays.listLabels(params.namespace)

      // Group by namespace
      const allLabels: Record<string, string[]> = {}
      const namespaces = new Set<string>()

      for (const { namespace, value } of labelsList) {
        namespaces.add(namespace)
        if (!allLabels[namespace]) {
          allLabels[namespace] = []
        }
        allLabels[namespace].push(value)
      }

      return {
        namespaces: Array.from(namespaces).sort(),
        labels: allLabels,
      }
    },
  }
}

/**
 * Create relays/by_label tool
 */
export function createRelaysByLabelTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/label',
    description: 'Get relays with a specific label',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string' },
        value: { type: 'string' },
        limit: { type: 'number', default: 100 },
        offset: { type: 'number', default: 0 },
        format: { type: 'string', enum: ['full', 'detailed', 'simple'], default: 'detailed', description: 'Response format: full (all attribution), detailed (default, no attribution), simple (URLs only)' },
      },
      required: ['namespace', 'value'],
    },
    outputSchema: loadSchema('relays-by-label-output.json'),
    handler: async (params: RelaysByLabelInput): Promise<RelaysByLabelOutput> => {
      const limit = params.limit || 100
      const offset = params.offset || 0

      // Resolve format
      const shape = resolveFormat((params as any).format)

      const relayUrls = ctx.core.query.relays.byLabel(params.namespace, params.value)
      let relays = relayUrls
        .map((url) => ctx.core.query.relays.getState(url))
        .filter((r) => r !== null)

      const total = relays.length
      let paged = relays.slice(offset, offset + limit)

      // Apply three-level shaping
      const formatted = applyShapeList(paged, shape)

      return {
        relays: formatted as any,
        label: { namespace: params.namespace, value: params.value },
        total,
      }
    },
  }
}

/**
 * Create relays/by_software tool
 */
export function createRelaysBySoftwareTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/software',
    description: 'Group relays by software',
    inputSchema: {
      type: 'object',
      properties: {
        family: { type: 'string' },
      },
    },
    outputSchema: loadSchema('relays-by-software-output.json'),
    handler: async (): Promise<RelaysBySoftwareOutput> => {
      const groupsMap = ctx.core.query.relays.bySoftware()

      return {
        groups: Object.entries(groupsMap).map(([family, relays]) => ({
          family,
          count: relays.length,
          relays,
        })),
      }
    },
  }
}

/**
 * Create relays/by_network tool
 */
export function createRelaysByNetworkTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/network',
    description: 'Group relays by network',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: loadSchema('relays-by-network-output.json'),
    handler: async (): Promise<RelaysByNetworkOutput> => {
      const groupsMap = ctx.core.query.relays.byNetwork()

      return {
        groups: Object.entries(groupsMap).map(([network, relays]) => ({
          network: network as any,
          count: relays.length,
          relays,
        })),
      }
    },
  }
}

/**
 * Create relays/by_nip tool
 */
export function createRelaysByNipTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/nip',
    description: 'Group relays by NIP support',
    inputSchema: {
      type: 'object',
      properties: {
        nip: { type: 'number' },
        minSupport: { type: 'number', default: 0.5 },
      },
    },
    outputSchema: loadSchema('relays-by-nip-output.json'),
    handler: async (params: RelaysByNipInput): Promise<RelaysByNipOutput> => {
      const nipData = ctx.core.query.relays.byNip()
      const minSupport = params.minSupport || 0.5

      let groups = Object.entries(nipData).map(([nip, data]) => ({
        nip: Number(nip),
        count: data.relays.length,
        avgSupport: data.supportRatio,
        relays: data.relays,
      }))

      // Filter by specific NIP if requested
      if (params.nip !== undefined) {
        groups = groups.filter((g) => g.nip === params.nip)
      }

      return {
        groups: groups
          .filter((g) => g.avgSupport >= minSupport)
          .sort((a, b) => b.count - a.count),
      }
    },
  }
}

/**
 * Create relays/by_country tool
 */
export function createRelaysByCountryTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/by/country',
    description: 'Group relays by country',
    inputSchema: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
      },
    },
    outputSchema: loadSchema('relays-by-country-output.json'),
    handler: async (params: RelaysByCountryInput): Promise<RelaysByCountryOutput> => {
      const groupsMap = ctx.core.query.relays.byCountry()

      let groups = Object.entries(groupsMap).map(([countryCode, relays]) => {
        // Get country name from the first relay's labels
        const firstRelayState = ctx.core.query.relays.getState(relays[0])
        const countryName = firstRelayState?.labels?.['countryName']?.[0]

        return {
          countryCode,
          countryName,
          count: relays.length,
          relays,
        }
      })

      // Filter by specific country code if requested
      if (params.countryCode) {
        groups = groups.filter((g) => g.countryCode === params.countryCode)
      }

      return {
        groups: groups.sort((a, b) => b.count - a.count),
      }
    },
  }
}

/**
 * Create relays/compare tool
 */
export function createRelaysCompareTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/compare',
    description: 'Compare multiple relays side-by-side',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrls: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 10,
        },
      },
      required: ['relayUrls'],
    },
    outputSchema: loadSchema('relays-compare-output.json'),
    handler: async (params: RelaysCompareInput): Promise<RelaysCompareOutput> => {
      // Normalize relay URLs
      const normalizedUrls: string[] = []
      for (const url of params.relayUrls) {
        try {
          normalizedUrls.push(normalizeRelayUrl(url))
        } catch (err) {
          logger.warn({ url, error: String(err) }, 'Invalid relay URL')
        }
      }

      const relays = ctx.core.query.relays.compare(normalizedUrls)
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
    },
  }
}

/**
 * Create relays/online tool
 */
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

/**
 * Create relays/offline tool
 */
export function createRelaysOfflineTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/offline',
    description: 'List relays considered offline (monitors checked but relay did not respond, not yet dead). Defaults derived from monitor frequencies.',
    inputSchema: {
      type: 'object',
      properties: {
        offlineThresholdSeconds: { type: 'number', description: 'Seconds since lastOpenAt to consider offline (default: max monitor frequency)' },
        deadThresholdSeconds: { type: 'number', description: 'Seconds since lastSeenAt beyond which relay is dead, not offline (default: 7 days)' },
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

/**
 * Create relays/dead_probably tool
 */
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
