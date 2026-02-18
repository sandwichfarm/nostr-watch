/**
 * Tool Cache Configuration Registry
 *
 * Single source of truth for all CVM tool cache key functions.
 * Extracted from server.ts for testability and to prevent cache key bugs.
 */

import type { CacheConfig } from './mcp/tool-adapter.js'

export interface ToolCacheEntry {
  toolName: string
  cacheKeyFn: (params: any) => string
  ttlSeconds?: number
}

const serialize = (value: unknown) => JSON.stringify(value ?? null)
const listKey = (prefix: string, p: any) =>
  `${prefix}:${p.limit || 50}:${p.offset || 0}:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}`
const searchKey = (prefix: string, p: any) => `${prefix}:${serialize(p)}`
const nearbyKey = (prefix: string, p: any) =>
  `${prefix}:${p.lat}:${p.lon}:${p.radius || 100}:${p.maxResults || 50}`
const bboxKey = (prefix: string, p: any) =>
  `${prefix}:${p.sw?.lat}:${p.sw?.lon}:${p.ne?.lat}:${p.ne?.lon}:${p.limit || 100}:${p.offset || 0}`
const byLabelKey = (prefix: string, p: any) =>
  `${prefix}:${p.namespace}:${p.value}:${p.limit || 100}:${p.offset || 0}`
const filtersKey = (filters: unknown) => (filters ? serialize(filters) : 'none')

/**
 * Registry of all tool cache configurations.
 *
 * Every parameter that affects output MUST be included in the cache key.
 * Missing a parameter causes cache poisoning: different requests returning
 * the same (wrong) cached result.
 */
export const TOOL_CACHE_REGISTRY: ToolCacheEntry[] = [
  // --- Relay tools ---
  {
    toolName: 'relays/list',
    cacheKeyFn: (p) => listKey('relays:list', p),
  },
  {
    toolName: 'relays/list/detailed',
    cacheKeyFn: (p) => listKey('relays:list:detailed', p),
  },
  {
    toolName: 'relays/list/full',
    cacheKeyFn: (p) => listKey('relays:list:full', p),
  },
  {
    toolName: 'relays/state',
    cacheKeyFn: (p) => `relays:state:${p.relayUrl}:${p.format || 'detailed'}`,
  },
  {
    toolName: 'relays/search',
    cacheKeyFn: (p) => searchKey('relays:search', p),
  },
  {
    toolName: 'relays/search/detailed',
    cacheKeyFn: (p) => searchKey('relays:search:detailed', p),
  },
  {
    toolName: 'relays/search/full',
    cacheKeyFn: (p) => searchKey('relays:search:full', p),
  },
  {
    toolName: 'relays/nearby',
    cacheKeyFn: (p) => nearbyKey('nearby', p),
  },
  {
    toolName: 'relays/nearby/detailed',
    cacheKeyFn: (p) => nearbyKey('nearby:detailed', p),
  },
  {
    toolName: 'relays/nearby/full',
    cacheKeyFn: (p) => nearbyKey('nearby:full', p),
  },
  {
    toolName: 'relays/bbox',
    cacheKeyFn: (p) => bboxKey('bbox', p),
  },
  {
    toolName: 'relays/bbox/detailed',
    cacheKeyFn: (p) => bboxKey('bbox:detailed', p),
  },
  {
    toolName: 'relays/bbox/full',
    cacheKeyFn: (p) => bboxKey('bbox:full', p),
  },
  {
    toolName: 'relays/labels',
    cacheKeyFn: (p) => `labels:${p.relayUrl}:${p.namespace || 'all'}`,
  },
  {
    toolName: 'relays/labels/list',
    cacheKeyFn: (p) => `list-labels:${p.namespace || 'all'}`,
  },
  {
    toolName: 'relays/by/label',
    cacheKeyFn: (p) => byLabelKey('relays:group:label', p),
  },
  {
    toolName: 'relays/by/label/detailed',
    cacheKeyFn: (p) => byLabelKey('relays:group:label:detailed', p),
  },
  {
    toolName: 'relays/by/label/full',
    cacheKeyFn: (p) => byLabelKey('relays:group:label:full', p),
  },
  {
    toolName: 'relays/by/software',
    cacheKeyFn: (p) => `relays:group:software${p.family ? ':' + p.family : ''}`,
  },
  {
    toolName: 'relays/by/network',
    cacheKeyFn: () => `relays:group:network`,
  },
  {
    toolName: 'relays/by/nip',
    cacheKeyFn: (p) => `relays:group:nip${p.nip !== undefined ? ':' + p.nip : ''}:${p.minSupport ?? 0.5}`,
  },
  {
    toolName: 'relays/by/country',
    cacheKeyFn: (p) => `relays:group:country${p.countryCode ? ':' + p.countryCode : ''}`,
  },
  {
    toolName: 'relays/compare',
    cacheKeyFn: (p) => `compare:${[...(p.relayUrls || [])].sort().join(',')}`,
  },

  // --- Availability tools (short TTL) ---
  {
    toolName: 'relays/online',
    cacheKeyFn: (p) => `availability:online:${p.onlineWindowSeconds || 'default'}:${p.limit ?? 100}:${p.offset ?? 0}:${filtersKey(p.filters)}`,
    ttlSeconds: 30,
  },
  {
    toolName: 'relays/offline',
    cacheKeyFn: (p) => `availability:offline:${p.offlineSeenSeconds || 86400}:${p.offlineThresholdSeconds || 3600}:${p.deadThresholdSeconds || 604800}:${p.limit ?? 100}:${p.offset ?? 0}:${filtersKey(p.filters)}`,
    ttlSeconds: 30,
  },
  {
    toolName: 'relays/dead',
    cacheKeyFn: (p) => `availability:dead:${p.deadThresholdSeconds || 604800}:${p.limit ?? 100}:${p.offset ?? 0}:${filtersKey(p.filters)}`,
    ttlSeconds: 30,
  },

  // --- Monitor tools ---
  {
    toolName: 'monitors/get',
    cacheKeyFn: (p) => `monitor:${p.pubkey}`,
  },
  {
    toolName: 'monitors/list',
    cacheKeyFn: (p) => `monitors:${p.limit || 100}:${p.offset || 0}`,
  },
]

/**
 * Build a lookup map from tool name to CacheConfig for use in server.ts
 */
export function buildCacheConfigMap(): Map<string, CacheConfig> {
  const map = new Map<string, CacheConfig>()
  for (const entry of TOOL_CACHE_REGISTRY) {
    map.set(entry.toolName, {
      enabled: true,
      cacheKeyFn: entry.cacheKeyFn,
      ttlSeconds: entry.ttlSeconds,
    })
  }
  return map
}

/**
 * Get cache config for a specific tool
 */
export function getCacheConfig(toolName: string): CacheConfig | undefined {
  const entry = TOOL_CACHE_REGISTRY.find(e => e.toolName === toolName)
  if (!entry) return undefined
  return {
    enabled: true,
    cacheKeyFn: entry.cacheKeyFn,
    ttlSeconds: entry.ttlSeconds,
  }
}
