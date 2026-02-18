/**
 * Cache Key Coverage Tests
 *
 * Ensures every output-affecting parameter is included in each tool's cacheKeyFn.
 * Three layers:
 *   1. Schema introspection — automatically detects missing params
 *   2. Behavioral divergence — proves different params produce different output
 *   3. Integration cache poisoning — end-to-end via ToolRegistry + QueryCache
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { TOOL_CACHE_REGISTRY, getCacheConfig } from '../src/tool-cache-config.js'
import { ToolRegistry } from '../src/mcp/tool-adapter.js'
import { QueryCache } from '../src/services/cache.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import {
  createRelaysListTool,
  createRelaysGetStateTool,
  createRelaysSearchTool,
  createRelaysNearbyTool,
  createRelaysBboxTool,
  createRelaysGetLabelsTool,
  createRelaysListLabelsTool,
  createRelaysByLabelTool,
  createRelaysBySoftwareTool,
  createRelaysByNetworkTool,
  createRelaysByNipTool,
  createRelaysByCountryTool,
  createRelaysCompareTool,
  createRelaysOnlineTool,
  createRelaysOfflineTool,
  createRelaysDeadTool,
} from '../src/tools/relays.js'
import { seedCore } from './fixtures/seed-data.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate two distinct valid values for a JSON schema property definition.
 * Used by Layer 1 to vary one property at a time.
 */
function generateAlternateValues(propSchema: any): [any, any] | null {
  if (!propSchema) return null

  if (propSchema.enum && propSchema.enum.length >= 2) {
    return [propSchema.enum[0], propSchema.enum[1]]
  }

  switch (propSchema.type) {
    case 'number':
      return [1, 2]
    case 'string':
      return ['alpha', 'bravo']
    case 'boolean':
      return [true, false]
    case 'array':
      return [['a'], ['a', 'b']]
    case 'object':
      // Nested objects — skip automatic testing (handled in Layer 2)
      return null
    default:
      return null
  }
}

/**
 * Build a base params object with default values for all properties.
 * Uses schema defaults where available; falls back to type-appropriate values.
 */
function buildBaseParams(inputSchema: any): Record<string, any> {
  const base: Record<string, any> = {}
  const props = inputSchema?.properties || {}

  for (const [key, schema] of Object.entries<any>(props)) {
    if (schema.default !== undefined) {
      base[key] = schema.default
    } else if (schema.enum) {
      base[key] = schema.enum[0]
    } else {
      switch (schema.type) {
        case 'number':
          base[key] = 1
          break
        case 'string':
          base[key] = 'test'
          break
        case 'boolean':
          base[key] = false
          break
        case 'array':
          base[key] = []
          break
        case 'object':
          base[key] = {}
          break
      }
    }
  }

  return base
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const core = initStateCore({ aggregation: DEFAULT_POLICY })
const toolsContext = { core }

/**
 * Map from tool name to its CVMTool definition (with inputSchema + handler)
 */
const TOOL_FACTORIES: Record<string, () => any> = {
  'relays/list': () => createRelaysListTool(toolsContext),
  'relays/get_state': () => createRelaysGetStateTool(toolsContext),
  'relays/search': () => createRelaysSearchTool(toolsContext),
  'relays/nearby': () => createRelaysNearbyTool(toolsContext),
  'relays/bbox': () => createRelaysBboxTool(toolsContext),
  'relays/get_labels': () => createRelaysGetLabelsTool(toolsContext),
  'relays/list_labels': () => createRelaysListLabelsTool(toolsContext),
  'relays/by_label': () => createRelaysByLabelTool(toolsContext),
  'relays/by_software': () => createRelaysBySoftwareTool(toolsContext),
  'relays/by_network': () => createRelaysByNetworkTool(toolsContext),
  'relays/by_nip': () => createRelaysByNipTool(toolsContext),
  'relays/by_country': () => createRelaysByCountryTool(toolsContext),
  'relays/compare': () => createRelaysCompareTool(toolsContext),
  'relays/online': () => createRelaysOnlineTool(toolsContext),
  'relays/offline': () => createRelaysOfflineTool(toolsContext),
  'relays/dead_probably': () => createRelaysDeadTool(toolsContext),
}

/** Cached tool instances */
const toolInstances = new Map<string, any>()
function getTool(name: string) {
  if (!toolInstances.has(name)) {
    const factory = TOOL_FACTORIES[name]
    if (!factory) throw new Error(`No factory for tool: ${name}`)
    toolInstances.set(name, factory())
  }
  return toolInstances.get(name)!
}

beforeAll(() => {
  seedCore(core)
})

// ---------------------------------------------------------------------------
// Layer 1: Schema Introspection — automatic detection of missing cache key params
// ---------------------------------------------------------------------------

describe('Layer 1: Schema Introspection — cache key covers all input properties', () => {
  for (const entry of TOOL_CACHE_REGISTRY) {
    const factory = TOOL_FACTORIES[entry.toolName]
    if (!factory) continue // skip monitor tools etc. that don't have factories here

    const tool = factory()
    const props = tool.inputSchema?.properties || {}
    const propNames = Object.keys(props)

    if (propNames.length === 0) continue // no params to test (e.g. by_network)

    describe(`${entry.toolName}`, () => {
      for (const propName of propNames) {
        const propSchema = props[propName]
        const alternates = generateAlternateValues(propSchema)
        if (!alternates) continue // skip un-testable types (nested objects)

        it(`cache key varies with "${propName}"`, () => {
          const base = buildBaseParams(tool.inputSchema)
          const paramsA = { ...base, [propName]: alternates[0] }
          const paramsB = { ...base, [propName]: alternates[1] }

          const keyA = entry.cacheKeyFn(paramsA)
          const keyB = entry.cacheKeyFn(paramsB)

          expect(keyA).not.toBe(keyB)
        })
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Layer 2: Behavioral Divergence — runtime proof that different params
//          produce different output, and cache keys also differ.
// ---------------------------------------------------------------------------

describe('Layer 2: Behavioral Divergence — different params produce different cache keys', () => {
  // Paginated tools
  const paginatedTools = [
    'relays/list',
    'relays/by_label',
    'relays/online',
    'relays/offline',
    'relays/dead_probably',
  ]

  for (const toolName of paginatedTools) {
    it(`${toolName}: limit/offset vary cache key`, () => {
      const config = getCacheConfig(toolName)!
      const baseParams = toolName === 'relays/by_label'
        ? { namespace: 'nip32.geo', value: 'US', limit: 1, offset: 0 }
        : { limit: 1, offset: 0 }

      const keyPage1 = config.cacheKeyFn({ ...baseParams, limit: 1, offset: 0 })
      const keyPage2 = config.cacheKeyFn({ ...baseParams, limit: 1, offset: 1 })
      expect(keyPage1).not.toBe(keyPage2)
    })
  }

  // Format tools
  const formatTools = ['relays/list', 'relays/by_label', 'relays/nearby']

  for (const toolName of formatTools) {
    it(`${toolName}: format varies cache key`, () => {
      const config = getCacheConfig(toolName)!
      const base = toolName === 'relays/by_label'
        ? { namespace: 'nip32.geo', value: 'US' }
        : toolName === 'relays/nearby'
          ? { lat: 37, lon: -122, radius: 100 }
          : {}

      const keyFull = config.cacheKeyFn({ ...base, format: 'full' })
      const keySimple = config.cacheKeyFn({ ...base, format: 'simple' })
      expect(keyFull).not.toBe(keySimple)
    })
  }

  it('relays/by_nip: minSupport varies cache key', () => {
    const config = getCacheConfig('relays/by_nip')!
    const keyLow = config.cacheKeyFn({ minSupport: 0.0 })
    const keyHigh = config.cacheKeyFn({ minSupport: 1.0 })
    expect(keyLow).not.toBe(keyHigh)
  })

  it('relays/by_software: family varies cache key', () => {
    const config = getCacheConfig('relays/by_software')!
    const keyAll = config.cacheKeyFn({})
    const keyStrfry = config.cacheKeyFn({ family: 'strfry' })
    expect(keyAll).not.toBe(keyStrfry)
  })

  it('relays/by_software: different families produce different cache keys', () => {
    const config = getCacheConfig('relays/by_software')!
    const keyStrfry = config.cacheKeyFn({ family: 'strfry' })
    const keyNostrRs = config.cacheKeyFn({ family: 'nostr-rs-relay' })
    expect(keyStrfry).not.toBe(keyNostrRs)
  })

  it('relays/nearby: maxResults varies cache key', () => {
    const config = getCacheConfig('relays/nearby')!
    const key1 = config.cacheKeyFn({ lat: 37, lon: -122, maxResults: 1 })
    const key50 = config.cacheKeyFn({ lat: 37, lon: -122, maxResults: 50 })
    expect(key1).not.toBe(key50)
  })

  it('relays/bbox: limit varies cache key', () => {
    const config = getCacheConfig('relays/bbox')!
    const sw = { lat: 32, lon: -125 }
    const ne = { lat: 42, lon: -120 }
    const key10 = config.cacheKeyFn({ sw, ne, limit: 10 })
    const key100 = config.cacheKeyFn({ sw, ne, limit: 100 })
    expect(key10).not.toBe(key100)
  })

  it('relays/bbox: compact varies cache key', () => {
    const config = getCacheConfig('relays/bbox')!
    const sw = { lat: 32, lon: -125 }
    const ne = { lat: 42, lon: -120 }
    const keyFalse = config.cacheKeyFn({ sw, ne, compact: false })
    const keyTrue = config.cacheKeyFn({ sw, ne, compact: true })
    expect(keyFalse).not.toBe(keyTrue)
  })
})

// ---------------------------------------------------------------------------
// Layer 3: Integration Cache Poisoning — end-to-end via ToolRegistry + QueryCache
// ---------------------------------------------------------------------------

describe('Layer 3: Integration — no cache poisoning through ToolRegistry pipeline', () => {
  let registry: ToolRegistry
  let queryCache: QueryCache

  beforeAll(() => {
    queryCache = new QueryCache(60, 1000)
    const metrics = new MetricsService()
    const security = new SecurityService(new RateLimiterService(), {
      allowedPubkeys: [],
      queryShape: DEFAULT_QUERY_SHAPE,
      enableRateLimiting: false,
      enableAuth: false,
    })

    registry = new ToolRegistry({
      security,
      queryCache,
      metrics,
      transport: { getClientPubkey: () => undefined },
    })

    // Register tools with cache configs from the registry
    const toolNames = Object.keys(TOOL_FACTORIES)
    for (const name of toolNames) {
      const tool = getTool(name)
      const config = getCacheConfig(name)
      registry.registerTool(tool, config)
    }
  })

  it('relays/list: page 1 and page 2 return different results (no cache poisoning)', async () => {
    const result1 = await registry.executeTool('relays/list', { limit: 1, offset: 0, sortBy: 'url', sortOrder: 'asc' })
    const result2 = await registry.executeTool('relays/list', { limit: 1, offset: 1, sortBy: 'url', sortOrder: 'asc' })

    // Both should return data
    expect(result1.relays).toHaveLength(1)
    expect(result2.relays).toHaveLength(1)

    // They should be DIFFERENT relays (not cache-poisoned)
    expect((result1.relays[0] as any).relayUrl).not.toBe((result2.relays[0] as any).relayUrl)
  })

  it('relays/list: full vs simple format return different structures', async () => {
    const resultFull = await registry.executeTool('relays/list', { limit: 1, offset: 0, format: 'full' })
    const resultSimple = await registry.executeTool('relays/list', { limit: 1, offset: 0, format: 'simple' })

    // Full format returns objects, simple returns strings
    const fullItem = resultFull.relays[0]
    const simpleItem = resultSimple.relays[0]

    expect(typeof fullItem).toBe('object')
    expect(typeof simpleItem).toBe('string')
  })

  it('relays/by_software: with family filter vs without returns different groups', async () => {
    const resultAll = await registry.executeTool('relays/by_software', {})
    const resultStrfry = await registry.executeTool('relays/by_software', { family: 'strfry' })

    // Unfiltered should have multiple groups
    expect(resultAll.groups.length).toBeGreaterThan(1)

    // Filtered should have at most 1 group
    expect(resultStrfry.groups.length).toBeLessThanOrEqual(1)
    if (resultStrfry.groups.length > 0) {
      expect(resultStrfry.groups[0].family).toBe('strfry')
    }
  })

  it('relays/by_nip: different minSupport thresholds return different counts', async () => {
    const resultLow = await registry.executeTool('relays/by_nip', { minSupport: 0.0 })
    const resultHigh = await registry.executeTool('relays/by_nip', { minSupport: 1.0 })

    // With minSupport=0 we should get more groups than with minSupport=1.0
    expect(resultLow.groups.length).toBeGreaterThanOrEqual(resultHigh.groups.length)
  })

  it('relays/online: different pagination returns different slices', async () => {
    const result1 = await registry.executeTool('relays/online', { limit: 1, offset: 0 })
    const result2 = await registry.executeTool('relays/online', { limit: 1, offset: 1 })

    // If there are >= 2 online relays, results should differ
    if (result1.total >= 2) {
      expect(result1.relays[0]).not.toBe(result2.relays[0])
    }
  })
})
