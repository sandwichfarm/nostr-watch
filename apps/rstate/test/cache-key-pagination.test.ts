/**
 * Regression coverage for MCP cache keys used by paginated GUI data calls.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import type {
  MonitorAnnouncement,
  RelayObservation
} from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { ToolRegistry } from '../src/mcp/tool-adapter.js'
import { QueryCache } from '../src/services/cache.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import { createRelaysListDetailedTool } from '../src/tools/relays.js'
import { getCacheConfig } from '../src/tool-cache-config.js'

const baseTime = Math.floor(Date.now() / 1000) - 3600

const monitors: MonitorAnnouncement[] = [
  {
    pubkey: 'monitor1pubkey',
    frequency: 600,
    timeout: { open: 5000, read: 5000, write: 5000 },
    checks: ['open', 'read', 'write', 'nips'],
    lastSeen: baseTime,
    eventId: 'monitor1-event'
  }
]

const observations: RelayObservation[] = [
  {
    id: 'obs-a',
    author: 'monitor1pubkey',
    relayUrl: 'wss://alpha.example.com',
    network: 'clearnet',
    created_at: baseTime + 100,
    rtt: { open: 50 },
    nips: [1, 11],
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy']
  },
  {
    id: 'obs-b',
    author: 'monitor1pubkey',
    relayUrl: 'wss://bravo.example.com',
    network: 'clearnet',
    created_at: baseTime + 200,
    rtt: { open: 60 },
    nips: [1, 11],
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yz']
  }
]

function seedCore() {
  const core = initStateCore({ aggregation: DEFAULT_POLICY })
  for (const monitor of monitors) core.ingest.monitor(monitor)
  core.ingest.observations(observations)
  core.computeAll()
  return core
}

function createCachedRegistry() {
  const core = seedCore()
  const cacheConfig = getCacheConfig('relays/list/detailed')
  expect(cacheConfig).toBeDefined()

  const registry = new ToolRegistry({
    queryCache: new QueryCache(),
    metrics: new MetricsService(),
    security: new SecurityService(new RateLimiterService(), {
      allowedPubkeys: [],
      queryShape: DEFAULT_QUERY_SHAPE,
      enableRateLimiting: false,
      enableAuth: false,
      allowAnyPubkey: true
    }),
    transport: { getClientPubkey: () => undefined }
  })

  registry.registerTool(createRelaysListDetailedTool({ core }), {
    enabled: true,
    cacheKeyFn: cacheConfig!.cacheKeyFn
  })

  return registry
}

function cacheKey(toolName: string, params: Record<string, unknown>): string {
  const cacheConfig = getCacheConfig(toolName)
  expect(cacheConfig?.cacheKeyFn).toBeDefined()
  return cacheConfig!.cacheKeyFn!(params)
}

describe('MCP relay tool cache keys', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = createCachedRegistry()
  })

  it('does not reuse page-one cached relays for later list pages', async () => {
    const firstPage = await registry.executeTool('relays/list/detailed', {
      limit: 1,
      offset: 0,
      sortBy: 'url',
      sortOrder: 'asc'
    })
    const secondPage = await registry.executeTool('relays/list/detailed', {
      limit: 1,
      offset: 1,
      sortBy: 'url',
      sortOrder: 'asc'
    })

    expect(firstPage.relays).toHaveLength(1)
    expect(secondPage.relays).toHaveLength(1)
    expect(firstPage.relays[0].relayUrl).toBe('wss://alpha.example.com')
    expect(secondPage.relays[0].relayUrl).toBe('wss://bravo.example.com')
  })

  it('varies cache keys by pagination and other output-affecting inputs', () => {
    expect(
      cacheKey('relays/list/detailed', { limit: 1, offset: 0, sortBy: 'url' })
    ).not.toBe(
      cacheKey('relays/list/detailed', { limit: 1, offset: 1, sortBy: 'url' })
    )
    expect(
      cacheKey('relays/by/label/detailed', {
        namespace: 'nip32.geo',
        value: 'US',
        limit: 1,
        offset: 0
      })
    ).not.toBe(
      cacheKey('relays/by/label/detailed', {
        namespace: 'nip32.geo',
        value: 'US',
        limit: 1,
        offset: 1
      })
    )
    expect(cacheKey('relays/online', { limit: 1, offset: 0 })).not.toBe(
      cacheKey('relays/online', { limit: 1, offset: 1 })
    )
    expect(
      cacheKey('relays/bbox/detailed', {
        sw: { lat: 1, lon: 2 },
        ne: { lat: 3, lon: 4 },
        limit: 1,
        offset: 0
      })
    ).not.toBe(
      cacheKey('relays/bbox/detailed', {
        sw: { lat: 1, lon: 2 },
        ne: { lat: 3, lon: 4 },
        limit: 1,
        offset: 1
      })
    )
    expect(
      cacheKey('relays/state', {
        relayUrl: 'wss://alpha.example.com',
        format: 'detailed'
      })
    ).not.toBe(
      cacheKey('relays/state', {
        relayUrl: 'wss://alpha.example.com',
        format: 'full'
      })
    )
    expect(cacheKey('relays/by/nip', { nip: 11, minSupport: 0.5 })).not.toBe(
      cacheKey('relays/by/nip', { nip: 11, minSupport: 0.75 })
    )
  })
})
