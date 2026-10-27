import { describe, expect, it } from 'vitest'
import { parseRelayObservation as coreParse } from '../src/core/events/normalization.js'
import { parseRelayObservation as serviceParse } from '../src/services/normalization.js'
import { initStateCore } from '../src/core/index.js'
import { validateNetwork } from '../src/utils/validation.js'
import type { NostrEvent } from '../src/core/types/events.js'
import Ajv from 'ajv'
import { createRelaysByNetworkTool, createRelaysSearchDetailedTool } from '../src/tools/relays.js'
import { RestServer } from '../src/rest/server.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'

const now = Math.floor(Date.now() / 1000)
const event: NostrEvent = {
  id: 'fips-observation', pubkey: 'fips-monitor', created_at: now,
  kind: 30166, sig: '', content: '{}',
  tags: [['d', 'ws://relay.fips:7777'], ['n', 'fips'], ['rtt-open', '42']],
}

describe('FIPS observation pipeline', () => {
  it.each([coreParse, serviceParse])('preserves the network during normalization', (parse) => {
    const observation = parse(event)
    expect(observation?.network).toBe('fips')
    expect(observation?.relayUrl).toContain('relay.fips:7777')
    expect(observation?.rtt?.open).toBe(42)
  })

  it.each(['clearnet', 'tor', 'i2p', 'fips', 'hybrid'])('accepts %s network queries', (network) => {
    expect(validateNetwork(network)).toBe(network)
  })

  it('aggregates and indexes FIPS separately from clearnet', () => {
    const core = initStateCore({ aggregation: { quorum: 0.5 } })
    core.ingest.monitor({
      pubkey: event.pubkey, frequency: 600, timeout: {}, checks: ['open'],
      lastSeen: now, eventId: 'monitor-announcement',
    })
    core.ingest.observations([coreParse(event)!])
    core.computeAll()
    const relay = core.query.relays.getState('ws://relay.fips:7777')
    expect(relay?.network?.value).toBe('fips')
    expect(core.query.relays.byNetwork().fips).toContain(relay?.relayUrl)
    expect(core.query.relays.byNetwork().clearnet ?? []).toEqual([])
  })

  it('validates FIPS tool schemas and returns the same filtered REST/CVM results', async () => {
    const core = initStateCore({ aggregation: { quorum: 0.5 } })
    core.ingest.monitor({ pubkey: event.pubkey, frequency: 600, timeout: {}, checks: ['open'], lastSeen: now, eventId: 'monitor' })
    core.ingest.observations([
      coreParse(event)!,
      coreParse({ ...event, id: 'clearnet', tags: [['d', 'wss://relay.example.org'], ['n', 'clearnet'], ['rtt-open', '64']] })!,
    ])
    core.computeAll()
    const search = createRelaysSearchDetailedTool({ core })
    const groups = createRelaysByNetworkTool({ core })
    const ajv = new Ajv({ strict: false })
    expect(ajv.compile(search.inputSchema)({ network: 'fips' })).toBe(true)
    const grouped = await groups.handler({})
    expect(ajv.compile(groups.outputSchema!)(grouped)).toBe(true)
    expect(grouped.groups.find((group: any) => group.network === 'fips')?.count).toBe(1)
    const security = new SecurityService(new RateLimiterService(), {
      allowedPubkeys: [], queryShape: DEFAULT_QUERY_SHAPE, enableRateLimiting: false, enableAuth: false,
    })
    const rest = new RestServer({
      host: '127.0.0.1', port: 0, corsOrigins: '*', enableSwagger: false, allowPolicyUpdate: false,
      rateLimit: { enabled: false, requestsPerSecond: 10, maxBurst: 100 },
    }, {
      core, security, metrics: new MetricsService(), allowPolicyUpdate: false,
      getUptime: () => 0, getRelayCount: () => ({ transport: 1, ingestion: 1 }),
      getMetricsSnapshot: () => ({}), getReady: () => true,
    })
    try {
      const response = await rest.getApp().inject({ method: 'POST', url: '/relays/search/detailed', payload: { network: 'fips' } })
      expect(response.statusCode).toBe(200)
      const toolResult = await search.handler({ network: 'fips' })
      expect(response.json().relays.map((relay: any) => relay.relayUrl)).toEqual(toolResult.relays.map((relay: any) => relay.relayUrl))
      expect(toolResult.relays).toHaveLength(1)
      expect(toolResult.relays[0].network.value).toBe('fips')
    } finally {
      await rest.getApp().close()
    }
  })
})
