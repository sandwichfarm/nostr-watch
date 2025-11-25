import { initStateCore } from '../dist/core/index.js'
import { DEFAULT_POLICY } from '../dist/types/aggregation.js'
import { RestServer } from '../dist/rest/server.js'
import { MetricsService } from '../dist/services/metrics.js'
import { SecurityService } from '../dist/services/security.js'
import { RateLimiterService } from '../dist/services/rate-limiter.js'
import { SubscriptionManager } from '../dist/services/subscription-manager.js'
import { SSEDeliveryService } from '../dist/rest/sse-delivery.js'
import { DEFAULT_QUERY_SHAPE } from '../dist/utils/validation.js'

function assert(cond, msg) { if (!cond) throw new Error(msg) }

async function main() {
  const baseTime = Math.floor(Date.now() / 1000) - 3600
  const monitors = [
    { pubkey: 'monitor1pubkey', frequency: 600, timeout: { open: 5000, read: 5000, write: 5000 }, checks: ['open','read','write','nips'], lastSeen: baseTime, eventId: 'monitor1-event' },
    { pubkey: 'monitor2pubkey', frequency: 300, timeout: { open: 5000, read: 5000, write: 5000 }, checks: ['open','read','write','nips'], lastSeen: baseTime, eventId: 'monitor2-event' },
  ]
  const observations = [
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
    { host: '127.0.0.1', port: 0, corsOrigins: '*', enableSwagger: false, allowPolicyUpdate: false, rateLimit: { enabled: false, requestsPerSecond: 10, maxBurst: 100 } },
    { core, metrics: new MetricsService(), security: new SecurityService(new RateLimiterService(), { allowedPubkeys: [], queryShape: DEFAULT_QUERY_SHAPE, enableRateLimiting: false, enableAuth: false }), subscriptionManager: new SubscriptionManager(), sseDelivery: new SSEDeliveryService(new SubscriptionManager()), allowPolicyUpdate: false, getUptime: () => 0, getRelayCount: () => ({ transport: 1, ingestion: 1 }), getMetricsSnapshot: () => ({}) }
  )

  // relays/list
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays?limit=10&offset=0&sortBy=url' })
    assert(res.statusCode === 200, 'REST relays list failed')
    const body = res.json()
    const expectedAll = core.query.relays.getAll().sort((a,b)=>a.relayUrl.localeCompare(b.relayUrl))
    const expected = expectedAll.slice(0, 10)
    assert(body.total === expectedAll.length, 'Mismatch total in relays/list')
    assert(JSON.stringify(body.relays.map(r => r.relayUrl)) === JSON.stringify(expected.map((r) => r.relayUrl)), 'Mismatch relay URLs in relays/list')
    console.log('OK  relays/list')
  }

  // relays/get_state
  {
    const url = encodeURIComponent('wss://relay1.example.com')
    const res = await rest.getApp().inject({ method: 'GET', url: `/relays/state?relayUrl=${url}` })
    assert(res.statusCode === 200, 'REST get_state failed')
    const body = res.json()
    const expected = core.query.relays.getState('wss://relay1.example.com')
    assert(body.relay.relayUrl === expected?.relayUrl, 'Mismatch in relays/get_state relayUrl')
    console.log('OK  relays/get_state')
  }

  // relays/search
  {
    const res = await rest.getApp().inject({ method: 'POST', url: '/relays/search', payload: { network: 'clearnet', limit: 100, offset: 0 } })
    assert(res.statusCode === 200, 'REST search failed')
    const body = res.json()
    const restUrls = body.relays.map(r => r.relayUrl).sort()
    const expectedUrls = core.query.relays.search({ network: 'clearnet' }).map(r=>r.relayUrl).sort()
    assert(JSON.stringify(restUrls) === JSON.stringify(expectedUrls), 'Mismatch in relays/search results')
    console.log('OK  relays/search')
  }

  // relays/by_label
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/label?namespace=nip32.geo&value=US' })
    assert(res.statusCode === 200, 'REST by_label failed')
    const body = res.json()
    const restUrls = body.relays.map(r => r.relayUrl).sort()
    const expectedUrls = core.query.relays.byLabel('nip32.geo','US').sort()
    assert(JSON.stringify(restUrls) === JSON.stringify(expectedUrls), 'Mismatch in relays/by_label results')
    console.log('OK  relays/by_label')
  }

  // relays/by_nip
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/nip?minSupport=0.0' })
    assert(res.statusCode === 200, 'REST by_nip failed')
    const body = res.json()
    const restMap = new Map()
    for (const g of body.groups) restMap.set(g.nip, { count: g.count })
    const expectedMap = core.query.relays.byNip()
    for (const [nip, data] of Object.entries(expectedMap)) {
      const n = Number(nip)
      assert(restMap.get(n)?.count === data.relays.length, `Mismatch in by_nip count for NIP ${n}`)
    }
    console.log('OK  relays/by_nip')
  }

  // relays/by_country
  {
    const res = await rest.getApp().inject({ method: 'GET', url: '/relays/by/country' })
    assert(res.statusCode === 200, 'REST by_country failed')
    const body = res.json()
    const restMap = new Map()
    for (const g of body.groups) restMap.set(g.countryCode, g.count)
    const expectedMap = core.query.relays.byCountry()
    for (const [code, relays] of Object.entries(expectedMap)) {
      assert(restMap.get(code) === relays.length, `Mismatch in by_country count for ${code}`)
    }
    console.log('OK  relays/by_country')
  }

  console.log('All REST vs Tool parity checks passed.')
}

main().catch((err) => { console.error(err); process.exit(1) })
