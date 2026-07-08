/**
 * REST vs Tool Parity Tests
 *
 * Compares selected REST endpoints with their corresponding MCP tool handlers
 * over a fixed seeded dataset to ensure parity of results.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { RestServer } from '../src/rest/server.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import {
  createRelaysListDetailedTool,
  createRelaysGetStateTool,
  createRelaysSearchDetailedTool,
  createRelaysByLabelDetailedTool,
  createRelaysByNipTool,
  createRelaysByCountryTool,
} from '../src/tools/relays.js'
import { monitors, observations } from './fixtures/seed-data.js'

describe('REST vs Tool Parity (seeded dataset)', () => {
  // Shared instances
  const core = initStateCore({ aggregation: DEFAULT_POLICY })
  const metrics = new MetricsService()
  const security = new SecurityService(new RateLimiterService(), {
    allowedPubkeys: [],
    queryShape: DEFAULT_QUERY_SHAPE,
    enableRateLimiting: false,
    enableAuth: false,
  })
  const rest = new RestServer(
    {
      host: '127.0.0.1',
      port: 0,
      corsOrigins: '*',
      enableSwagger: false,
      allowPolicyUpdate: false,
      rateLimit: { enabled: false, requestsPerSecond: 10, maxBurst: 100 },
    },
    {
      core,
      metrics,
      security,
      allowPolicyUpdate: false,
      getUptime: () => 0,
      getRelayCount: () => ({ transport: 1, ingestion: 1 }),
      getMetricsSnapshot: () => ({}),
      getReady: () => true,
    }
  )

  // Tool handlers using the same core
  const tools = {
    list: createRelaysListDetailedTool({ core }),
    getState: createRelaysGetStateTool({ core }),
    search: createRelaysSearchDetailedTool({ core }),
    byLabel: createRelaysByLabelDetailedTool({ core }),
    byNip: createRelaysByNipTool({ core }),
    byCountry: createRelaysByCountryTool({ core }),
  }

  beforeAll(async () => {
    // Seed core
    for (const m of monitors) core.ingest.monitor(m)
    core.ingest.observations(observations)

    // Count observations per monitor
    const obs1Count = observations.filter(o => o.author === '0000000000000000000000000000000000000000000000000000000000000001').length
    const obs2Count = observations.filter(o => o.author === '0000000000000000000000000000000000000000000000000000000000000002').length
    console.log(`Monitor 1 observation count: ${obs1Count}`)
    console.log(`Monitor 2 observation count: ${obs2Count}`)

    core.computeAll()

    const allAnalytics = core.query.monitors.getAllAnalytics()
    console.log(`Total analytics computed: ${allAnalytics.length}`)
    console.log('Analytics pubkeys:', allAnalytics.map(a => a.pubkey))
  })

  it('parity: relays/list', async () => {
    const app = rest.getApp()
    const res = await app.inject({ method: 'GET', url: '/relays/detailed?limit=10&offset=0&sortBy=url' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.list.handler({ limit: 10, offset: 0, sortBy: 'url' } as any)

    expect(body.total).toBe(toolOut.total)
    expect((body.relays as any[]).map(r => r.relayUrl)).toEqual((toolOut.relays as any[]).map((r: any) => r.relayUrl))
  })

  it('parity: relays/state', async () => {
    const url = encodeURIComponent('wss://relay1.example.com')
    const res = await rest.getApp().inject({ method: 'GET', url: `/relays/state?relayUrl=${url}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.getState.handler({ relayUrl: 'wss://relay1.example.com' } as any)

    expect(body.relay.relayUrl).toBe(toolOut.relay?.relayUrl)
  })

  it('parity: relays/search (network=clearnet)', async () => {
    const res = await rest.getApp().inject({ method: 'POST', url: '/relays/search/detailed', payload: { network: 'clearnet', limit: 100, offset: 0 } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.search.handler({ network: 'clearnet' } as any)

    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    expect(restUrls).toEqual(toolUrls)
  })

  it('parity: relays/by/label (nip32.geo=US)', async () => {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/label/detailed?namespace=nip32.geo&value=US' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.byLabel.handler({ namespace: 'nip32.geo', value: 'US' } as any)

    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    expect(restUrls).toEqual(toolUrls)
  })

  it('parity: relays/by/nip', async () => {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/nip?minSupport=0.0' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.byNip.handler({} as any)

    const restMap = new Map<number, { count: number }>()
    for (const g of body.groups as any[]) restMap.set(g.nip, { count: g.count })
    for (const g of (toolOut.groups as any[])) {
      expect(restMap.get(g.nip)?.count).toBe(g.count)
    }
  })

  it('parity: relays/by/country', async () => {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/country' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.byCountry.handler({} as any)

    const restMap = new Map<string, number>()
    for (const g of body.groups as any[]) restMap.set(g.countryCode, g.count)
    for (const g of (toolOut.groups as any[])) {
      expect(restMap.get(g.countryCode)).toBe(g.count)
    }
  })

  it('parity: monitors/:pubkey/analytics (includeRelayUrls=true)', async () => {
    const pubkey = '0000000000000000000000000000000000000000000000000000000000000001'
    const res = await rest.getApp().inject({ method: 'GET', url: `/monitors/${pubkey}/analytics?includeRelayUrls=true` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    const expected = core.query.monitors.getAnalytics(pubkey)
    expect(expected).toBeDefined()
    expect(body.pubkey).toBe(expected!.pubkey)
    expect(new Set(body.coverage.relayUrls)).toEqual(new Set(expected!.coverage.relayUrls))
  })

  it('parity: monitors/analytics list (pubkeys and counts)', async () => {
    const res = await rest.getApp().inject({ method: 'GET', url: `/monitors/analytics?limit=100&offset=0&includeRelayUrls=false` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    const expected = core.query.monitors.getAllAnalytics()
    expect(body.total).toBe(expected.length)
    const restPubkeys = new Set((body.analytics as any[]).map(a => a.pubkey))
    const expectedPubkeys = new Set(expected.map(a => a.pubkey))
    expect(restPubkeys).toEqual(expectedPubkeys)
    // ensure relayUrls stripped
    for (const a of body.analytics as any[]) {
      expect(Array.isArray(a.coverage.relayUrls)).toBe(true)
      expect(a.coverage.relayUrls.length).toBe(0)
    }
  })
})
