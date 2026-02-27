/**
 * REST vs Tool Parity Tests
 *
 * Compares selected REST endpoints with their corresponding MCP tool handlers
 * over a fixed seeded dataset to ensure parity of results.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { RestServer } from '../src/rest/server.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import {
  createRelaysListTool,
  createRelaysGetStateTool,
  createRelaysSearchTool,
  createRelaysByLabelTool,
  createRelaysByNipTool,
  createRelaysByCountryTool,
} from '../src/tools/relays.js'

describe('REST vs Tool Parity (seeded dataset)', () => {
  // Seeded test data (copied from parity.test.ts)
  const baseTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago

  const monitors: MonitorAnnouncement[] = [
    {
      pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
      frequency: 600,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips'],
      lastSeen: baseTime,
      eventId: 'monitor1-event',
    },
    {
      pubkey: '0000000000000000000000000000000000000000000000000000000000000002',
      frequency: 300,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips'],
      lastSeen: baseTime,
      eventId: 'monitor2-event',
    },
  ]

  const observations: RelayObservation[] = [
    {
      id: 'obs1-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay1.example.com',
      network: 'clearnet',
      created_at: baseTime + 100,
      rtt: { open: 50, read: 30, write: 25 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [
        { namespace: 'nip32.asn', value: 'AS13335' },
        { namespace: 'nip32.geo', value: 'US' },
        { namespace: 'nip32.isp', value: 'Cloudflare' },
      ],
      geohashes: ['9q8yy', '9q8y', '9q8'],
    },
    {
      id: 'obs1-monitor2',
      author: '0000000000000000000000000000000000000000000000000000000000000002',
      relayUrl: 'wss://relay1.example.com',
      network: 'clearnet',
      created_at: baseTime + 200,
      rtt: { open: 55, read: 32, write: 27 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [
        { namespace: 'nip32.asn', value: 'AS13335' },
        { namespace: 'nip32.geo', value: 'US' },
        { namespace: 'nip32.isp', value: 'Cloudflare' },
      ],
      geohashes: ['9q8yy', '9q8y', '9q8'],
    },
    {
      id: 'obs2-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay2.example.com',
      network: 'tor',
      created_at: baseTime + 150,
      rtt: { open: 200 },
      nips: [1, 11],
      software: { family: 'nostr-rs-relay', version: '0.8.0' },
      labels: [],
    },
    {
      id: 'obs2-monitor2',
      author: '0000000000000000000000000000000000000000000000000000000000000002',
      relayUrl: 'wss://relay2.example.com',
      network: 'tor',
      created_at: baseTime + 250,
      rtt: { open: 210 },
      nips: [1, 11],
      software: { family: 'nostr-rs-relay', version: '0.8.0' },
      labels: [],
    },
    {
      id: 'obs3-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay3.example.com',
      network: 'clearnet',
      created_at: baseTime + 180,
      rtt: {},
      nips: [],
      labels: [ { namespace: 'nip32.geo', value: 'DE' } ],
      geohashes: ['u0y'],
    },
    // Add more observations for monitor1 to meet minObservationsForScore (10)
    {
      id: 'obs4-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay4.example.com',
      network: 'clearnet',
      created_at: baseTime + 300,
      rtt: { open: 48 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs5-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay5.example.com',
      network: 'clearnet',
      created_at: baseTime + 400,
      rtt: { open: 52 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs6-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay6.example.com',
      network: 'clearnet',
      created_at: baseTime + 500,
      rtt: { open: 45 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs7-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay7.example.com',
      network: 'clearnet',
      created_at: baseTime + 600,
      rtt: { open: 49 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs8-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay8.example.com',
      network: 'clearnet',
      created_at: baseTime + 700,
      rtt: { open: 51 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs9-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay9.example.com',
      network: 'clearnet',
      created_at: baseTime + 800,
      rtt: { open: 47 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
    {
      id: 'obs10-monitor1',
      author: '0000000000000000000000000000000000000000000000000000000000000001',
      relayUrl: 'wss://relay10.example.com',
      network: 'clearnet',
      created_at: baseTime + 900,
      rtt: { open: 53 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [{ namespace: 'nip32.geo', value: 'US' }],
      geohashes: ['9q8yy'],
    },
  ]

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
    list: createRelaysListTool({ core }),
    getState: createRelaysGetStateTool({ core }),
    search: createRelaysSearchTool({ core }),
    byLabel: createRelaysByLabelTool({ core }),
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
    const res = await app.inject({ method: 'GET', url: '/relays?limit=10&offset=0&sortBy=url' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.list.handler({ limit: 10, offset: 0, sortBy: 'url' } as any)

    expect(body.total).toBe(toolOut.total)
    expect((body.relays as any[]).map(r => r.relayUrl)).toEqual((toolOut.relays as any[]).map((r: any) => r.relayUrl))
  })

  it('parity: relays/get_state', async () => {
    const url = encodeURIComponent('wss://relay1.example.com')
    const res = await rest.getApp().inject({ method: 'GET', url: `/relays/state?relayUrl=${url}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.getState.handler({ relayUrl: 'wss://relay1.example.com' } as any)

    expect(body.relay.relayUrl).toBe(toolOut.relay?.relayUrl)
  })

  it('parity: relays/search (network=clearnet)', async () => {
    const res = await rest.getApp().inject({ method: 'POST', url: '/relays/search', payload: { network: 'clearnet', limit: 100, offset: 0 } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.search.handler({ network: 'clearnet' } as any)

    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    expect(restUrls).toEqual(toolUrls)
  })

  it('parity: relays/by_label (nip32.geo=US)', async () => {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/label?namespace=nip32.geo&value=US' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any

    const toolOut = await tools.byLabel.handler({ namespace: 'nip32.geo', value: 'US' } as any)

    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    expect(restUrls).toEqual(toolUrls)
  })

  it('parity: relays/by_nip', async () => {
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

  it('parity: relays/by_country', async () => {
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
