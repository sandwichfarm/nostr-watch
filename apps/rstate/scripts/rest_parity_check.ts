import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { RestServer } from '../src/rest/server.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { SubscriptionManager } from '../src/services/subscription-manager.js'
import { SSEDeliveryService } from '../src/rest/sse-delivery.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import {
  createRelaysListDetailedTool,
  createRelaysGetStateTool,
  createRelaysSearchDetailedTool,
  createRelaysByLabelDetailedTool,
  createRelaysByNipTool,
  createRelaysByCountryTool,
} from '../src/tools/relays.js'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const baseTime = Math.floor(Date.now() / 1000) - 3600

  const monitors: MonitorAnnouncement[] = [
    { pubkey: 'monitor1pubkey', frequency: 600, timeout: { open: 5000, read: 5000, write: 5000 }, checks: ['open', 'read', 'write', 'nips'], lastSeen: baseTime, eventId: 'monitor1-event' },
    { pubkey: 'monitor2pubkey', frequency: 300, timeout: { open: 5000, read: 5000, write: 5000 }, checks: ['open', 'read', 'write', 'nips'], lastSeen: baseTime, eventId: 'monitor2-event' },
  ]
  const observations: RelayObservation[] = [
    { id: 'obs1-monitor1', author: 'monitor1pubkey', relayUrl: 'wss://relay1.example.com', network: 'clearnet', created_at: baseTime + 100, rtt: { open: 50, read: 30, write: 25 }, nips: [1,11,42,50], software: { family: 'strfry', version: '1.0.0' }, labels: [{ namespace: 'nip32.asn', value: 'AS13335' }, { namespace: 'nip32.geo', value: 'US' }, { namespace: 'nip32.isp', value: 'Cloudflare' }], geohashes: ['9q8yy','9q8y','9q8'] },
    { id: 'obs1-monitor2', author: 'monitor2pubkey', relayUrl: 'wss://relay1.example.com', network: 'clearnet', created_at: baseTime + 200, rtt: { open: 55, read: 32, write: 27 }, nips: [1,11,42,50], software: { family: 'strfry', version: '1.0.0' }, labels: [{ namespace: 'nip32.asn', value: 'AS13335' }, { namespace: 'nip32.geo', value: 'US' }, { namespace: 'nip32.isp', value: 'Cloudflare' }], geohashes: ['9q8yy','9q8y','9q8'] },
    { id: 'obs2-monitor1', author: 'monitor1pubkey', relayUrl: 'wss://relay2.example.com', network: 'tor', created_at: baseTime + 150, rtt: { open: 200 }, nips: [1,11], software: { family: 'nostr-rs-relay', version: '0.8.0' }, labels: [] },
    { id: 'obs2-monitor2', author: 'monitor2pubkey', relayUrl: 'wss://relay2.example.com', network: 'tor', created_at: baseTime + 250, rtt: { open: 210 }, nips: [1,11], software: { family: 'nostr-rs-relay', version: '0.8.0' }, labels: [] },
    { id: 'obs3-monitor1', author: 'monitor1pubkey', relayUrl: 'wss://relay3.example.com', network: 'clearnet', created_at: baseTime + 180, rtt: {}, nips: [], labels: [{ namespace: 'nip32.geo', value: 'DE' }], geohashes: ['u0y'] },
  ]

  const core = initStateCore({ aggregation: DEFAULT_POLICY })
  for (const m of monitors) core.ingest.monitor(m)
  core.ingest.observations(observations)
  core.computeAll()

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
      metrics: new MetricsService(),
      security: new SecurityService(new RateLimiterService(), { allowedPubkeys: [], queryShape: DEFAULT_QUERY_SHAPE, enableRateLimiting: false, enableAuth: false }),
      subscriptionManager: new SubscriptionManager(),
      sseDelivery: new SSEDeliveryService(new SubscriptionManager()),
      allowPolicyUpdate: false,
      getUptime: () => 0,
      getRelayCount: () => ({ transport: 1, ingestion: 1 }),
      getMetricsSnapshot: () => ({}),
    }
  )

  // Tool handlers
  const tools = {
    list: createRelaysListDetailedTool({ core }),
    getState: createRelaysGetStateTool({ core }),
    search: createRelaysSearchDetailedTool({ core }),
    byLabel: createRelaysByLabelDetailedTool({ core }),
    byNip: createRelaysByNipTool({ core }),
    byCountry: createRelaysByCountryTool({ core }),
  }

  // 1) relays/list
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays?limit=10&offset=0&sortBy=url' })
    assert(res.statusCode === 200, 'REST relays list failed')
    const body = res.json() as any
    const toolOut = await tools.list.handler({ limit: 10, offset: 0, sortBy: 'url' } as any)
    assert(body.total === toolOut.total, 'Mismatch total in relays/list')
    assert(JSON.stringify(body.relays.map((r: any) => r.relayUrl)) === JSON.stringify((toolOut.relays as any[]).map(r => (r as any).relayUrl)), 'Mismatch relay URLs in relays/list')
    console.log('OK  relays/list')
  }

  // 2) relays/get_state
  {
    const url = encodeURIComponent('wss://relay1.example.com')
    const res = await rest.getApp().inject({ method: 'GET', url: `/relays/state?relayUrl=${url}` })
    assert(res.statusCode === 200, 'REST get_state failed')
    const body = res.json() as any
    const toolOut = await tools.getState.handler({ relayUrl: 'wss://relay1.example.com' } as any)
    assert(body.relay.relayUrl === toolOut.relay?.relayUrl, 'Mismatch in relays/get_state relayUrl')
    console.log('OK  relays/get_state')
  }

  // 3) relays/search (network=clearnet)
  {
    const res = await rest.getApp().inject({ method: 'POST', url: '/relays/search', payload: { network: 'clearnet', limit: 100, offset: 0 } })
    assert(res.statusCode === 200, 'REST search failed')
    const body = res.json() as any
    const toolOut = await tools.search.handler({ network: 'clearnet' } as any)
    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    assert(JSON.stringify(restUrls) === JSON.stringify(toolUrls), 'Mismatch in relays/search results')
    console.log('OK  relays/search')
  }

  // 4) relays/by_label (nip32.geo=US)
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/label?namespace=nip32.geo&value=US' })
    assert(res.statusCode === 200, 'REST by_label failed')
    const body = res.json() as any
    const toolOut = await tools.byLabel.handler({ namespace: 'nip32.geo', value: 'US' } as any)
    const restUrls = (body.relays as any[]).map(r => r.relayUrl).sort()
    const toolUrls = (toolOut.relays as any[]).map((r: any) => r.relayUrl).sort()
    assert(JSON.stringify(restUrls) === JSON.stringify(toolUrls), 'Mismatch in relays/by_label results')
    console.log('OK  relays/by_label')
  }

  // 5) relays/by_nip
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/nip?minSupport=0.0' })
    assert(res.statusCode === 200, 'REST by_nip failed')
    const body = res.json() as any
    const toolOut = await tools.byNip.handler({} as any)
    const restMap = new Map<number, { count: number }>()
    for (const g of body.groups as any[]) restMap.set(g.nip, { count: g.count })
    for (const g of (toolOut.groups as any[])) {
      assert(restMap.get(g.nip)?.count === g.count, `Mismatch in by_nip count for NIP ${g.nip}`)
    }
    console.log('OK  relays/by_nip')
  }

  // 6) relays/by_country
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/country' })
    assert(res.statusCode === 200, 'REST by_country failed')
    const body = res.json() as any
    const toolOut = await tools.byCountry.handler({} as any)
    const restMap = new Map<string, number>()
    for (const g of body.groups as any[]) restMap.set(g.countryCode, g.count)
    for (const g of (toolOut.groups as any[])) {
      assert(restMap.get(g.countryCode) === g.count, `Mismatch in by_country count for ${g.countryCode}`)
    }
    console.log('OK  relays/by_country')
  }

  console.log('All REST vs Tool parity checks passed.')
}

main().catch((err) => {
  console.error('Parity check failed:', err)
  process.exit(1)
})

