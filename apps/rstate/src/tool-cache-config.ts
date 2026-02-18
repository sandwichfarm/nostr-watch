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
    cacheKeyFn: (p) => `relays:list:${p.limit || 50}:${p.offset || 0}:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}:${p.format || 'detailed'}`,
  },
  {
    toolName: 'relays/get_state',
    cacheKeyFn: (p) => `relays:state:${p.relayUrl}:${p.format || 'detailed'}`,
  },
  {
    toolName: 'relays/search',
    cacheKeyFn: (p) => `relays:search:${JSON.stringify(p)}`,
  },
  {
    toolName: 'relays/nearby',
    cacheKeyFn: (p) => `nearby:${p.lat}:${p.lon}:${p.radius || 100}:${p.maxResults || 50}:${p.format || 'detailed'}`,
  },
  {
    toolName: 'relays/bbox',
    cacheKeyFn: (p) => `bbox:${p.sw.lat}:${p.sw.lon}:${p.ne.lat}:${p.ne.lon}:${p.limit || 100}:${p.compact || false}`,
  },
  {
    toolName: 'relays/get_labels',
    cacheKeyFn: (p) => `labels:${p.relayUrl}:${p.namespace || 'all'}`,
  },
  {
    toolName: 'relays/list_labels',
    cacheKeyFn: (p) => `list-labels:${p.namespace || 'all'}`,
  },
  {
    toolName: 'relays/by_label',
    cacheKeyFn: (p) => `relays:group:label:${p.namespace}:${p.value}:${p.limit || 100}:${p.offset || 0}:${p.format || 'detailed'}`,
  },
  {
    toolName: 'relays/by_software',
    cacheKeyFn: (p) => `relays:group:software${p.family ? ':' + p.family : ''}`,
  },
  {
    toolName: 'relays/by_network',
    cacheKeyFn: () => `relays:group:network`,
  },
  {
    toolName: 'relays/by_nip',
    cacheKeyFn: (p) => `relays:group:nip${p.nip !== undefined ? ':' + p.nip : ''}:${p.minSupport ?? 0.5}`,
  },
  {
    toolName: 'relays/by_country',
    cacheKeyFn: (p) => `relays:group:country${p.countryCode ? ':' + p.countryCode : ''}`,
  },
  {
    toolName: 'relays/compare',
    cacheKeyFn: (p) => `compare:${p.relayUrls.sort().join(',')}`,
  },

  // --- Availability tools (short TTL) ---
  {
    toolName: 'relays/online',
    cacheKeyFn: (p) => `availability:online:${p.onlineWindowSeconds || 'default'}:${p.limit ?? 100}:${p.offset ?? 0}:${p.filters ? JSON.stringify(p.filters) : 'none'}`,
    ttlSeconds: 30,
  },
  {
    toolName: 'relays/offline',
    cacheKeyFn: (p) => `availability:offline:${p.offlineSeenSeconds || 86400}:${p.offlineThresholdSeconds || 3600}:${p.limit ?? 100}:${p.offset ?? 0}:${p.filters ? JSON.stringify(p.filters) : 'none'}`,
    ttlSeconds: 30,
  },
  {
    toolName: 'relays/dead_probably',
    cacheKeyFn: (p) => `availability:dead:${p.deadThresholdSeconds || 604800}:${p.limit ?? 100}:${p.offset ?? 0}:${p.filters ? JSON.stringify(p.filters) : 'none'}`,
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
export function buildCacheConfigMap(): Map<string, { enabled: boolean; cacheKeyFn: (params: any) => string; ttlSeconds?: number }> {
  const map = new Map<string, { enabled: boolean; cacheKeyFn: (params: any) => string; ttlSeconds?: number }>()
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
export function getCacheConfig(toolName: string): { enabled: boolean; cacheKeyFn: (params: any) => string; ttlSeconds?: number } | undefined {
  const entry = TOOL_CACHE_REGISTRY.find(e => e.toolName === toolName)
  if (!entry) return undefined
  return {
    enabled: true,
    cacheKeyFn: entry.cacheKeyFn,
    ttlSeconds: entry.ttlSeconds,
  }
}
