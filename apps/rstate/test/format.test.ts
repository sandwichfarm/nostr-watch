/**
 * Response Format Tests
 *
 * Comprehensive test suite for all response format options:
 * - full: Complete RelayState with contributor attribution
 * - detailed: CompactRelayState without attribution (default)
 * - simple: String array of relay URLs only
 *
 * Tests both ContextVM tools and REST endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import { createRelaysListTool, createRelaysGetStateTool, createRelaysSearchTool } from '../src/tools/relays.js'

describe('Response Format Comprehensive Tests', () => {
  let server: RestServer
  let app: any
  let core: ReturnType<typeof initStateCore>

  const baseTime = Math.floor(Date.now() / 1000) - 3600

  beforeAll(async () => {
    core = initStateCore({
      aggregation: {
        windowStrategy: 'global',
        lookbackSeconds: 21600,
        quorum: 0.5,
        labelQuorum: 0.3,
        madScale: 3,
        weights: { recency: 1, reliability: 1 },
        nipSourceOrder: ['vote'],
        geoPrefs: { preferHigherPrecision: true },
      },
    })

    const metrics = new MetricsService()
    const rateLimiter = new RateLimiterService()
    const security = new SecurityService(rateLimiter, {
      allowedPubkeys: [],
      queryShape: DEFAULT_QUERY_SHAPE,
      enableRateLimiting: false,
      enableAuth: false,
      allowAnyPubkey: true,
    })
    const queryCache = new QueryCache()

    server = new RestServer(
      {
        host: '127.0.0.1',
        port: 0,
        corsOrigins: '*',
        enableSwagger: false,
        allowPolicyUpdate: false,
        rateLimit: {
          enabled: false,
          requestsPerSecond: 10,
          maxBurst: 100,
        },
      },
      {
        core,
        metrics,
        security,
        queryCache,
        allowPolicyUpdate: false,
        getUptime: () => 100,
        getRelayCount: () => ({ transport: 3, ingestion: 3 }),
        getMetricsSnapshot: () => ({}),
        getReady: () => true,
      }
    )

    app = server.getApp()

    // Inject test data with attribution
    const monitors: MonitorAnnouncement[] = [
      {
        pubkey: 'monitor1pubkey',
        frequency: 600,
        timeout: { open: 5000, read: 5000, write: 5000 },
        checks: ['open', 'read', 'write', 'nips'],
        lastSeen: baseTime,
        eventId: 'monitor1-event',
      },
      {
        pubkey: 'monitor2pubkey',
        frequency: 300,
        timeout: { open: 5000, read: 5000, write: 5000 },
        checks: ['open', 'read', 'write', 'nips'],
        lastSeen: baseTime,
        eventId: 'monitor2-event',
      },
    ]

    const observations: RelayObservation[] = [
      {
        id: 'obs1',
        author: 'monitor1pubkey',
        relayUrl: 'wss://relay1.example.com',
        network: 'clearnet',
        created_at: baseTime + 60,
        rtt: { open: 150, read: 50, write: 75 },
        nips: [1, 2, 11, 50],
        software: { family: 'strfry', version: '0.9.6' },
      },
      {
        id: 'obs2',
        author: 'monitor2pubkey',
        relayUrl: 'wss://relay1.example.com',
        network: 'clearnet',
        created_at: baseTime + 120,
        rtt: { open: 160, read: 55, write: 80 },
        nips: [1, 2, 11, 50],
        software: { family: 'strfry', version: '0.9.6' },
      },
      {
        id: 'obs3',
        author: 'monitor1pubkey',
        relayUrl: 'wss://relay2.example.com',
        network: 'clearnet',
        created_at: baseTime + 180,
        rtt: { open: 200 },
        nips: [1, 11],
      },
      {
        id: 'obs4',
        author: 'monitor2pubkey',
        relayUrl: 'wss://relay3.example.com',
        network: 'tor',
        created_at: baseTime + 240,
        rtt: { open: 500 },
        nips: [1],
      },
    ]

    for (const monitor of monitors) {
      core.ingest.monitor(monitor)
    }
    core.ingest.observations(observations)
    core.computeAll()
  })

  afterAll(async () => {
    if (server) {
      await server.stop()
    }
  })

  describe('REST API: GET /relays', () => {
    it('format=full should include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=full&limit=1',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.relays).toBeInstanceOf(Array)
      expect(body.relays.length).toBeGreaterThan(0)

      const relay = body.relays[0]
      expect(relay.network?.contributingAuthors).toBeDefined()
      expect(Array.isArray(relay.network?.contributingAuthors)).toBe(true)
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=detailed&limit=1',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.relays).toBeInstanceOf(Array)
      expect(body.relays.length).toBeGreaterThan(0)

      const relay = body.relays[0]
      expect(relay.network?.contributingAuthors).toBeUndefined()
      expect(relay.network?.value).toBeDefined()
      expect(relay.relayUrl).toBeDefined()
    })

    it('format=simple should return string array of URLs only', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=simple&limit=3',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.relays).toBeInstanceOf(Array)
      expect(body.relays.length).toBeGreaterThan(0)

      // All elements should be strings
      for (const item of body.relays) {
        expect(typeof item).toBe('string')
        expect(item).toMatch(/^wss:\/\//)
      }
    })


    it('no format parameter should default to detailed', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=1',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      const relay = body.relays[0]

      expect(relay.network?.contributingAuthors).toBeUndefined()
      expect(relay.relayUrl).toBeDefined()
    })
  })

  describe('REST API: GET /relays/state', () => {
    it('format=full should include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/state?relayUrl=wss://relay1.example.com&format=full',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.relay.network?.contributingAuthors).toBeDefined()
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/state?relayUrl=wss://relay1.example.com&format=detailed',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.relay.network?.contributingAuthors).toBeUndefined()
      expect(body.relay.network?.value).toBeDefined()
    })

    it('format=simple should return object (not string) for single relay', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/state?relayUrl=wss://relay1.example.com&format=simple',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(typeof body.relay).toBe('object')
      expect(body.relay.relayUrl).toBeDefined()
      expect(body.relay.network?.contributingAuthors).toBeUndefined()
    })

  })

  describe('REST API: POST /relays/search', () => {
    it('format=full should include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: { format: 'full', limit: 1 },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      if (body.relays.length > 0) {
        expect(body.relays[0].network?.contributingAuthors).toBeDefined()
      }
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: { format: 'detailed', limit: 1 },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      if (body.relays.length > 0) {
        expect(body.relays[0].network?.contributingAuthors).toBeUndefined()
      }
    })

    it('format=simple should return string array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: { format: 'simple', limit: 3 },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      if (body.relays.length > 0) {
        expect(typeof body.relays[0]).toBe('string')
      }
    })

  })

  describe('ContextVM Tools: relays/list', () => {
    let listTool: ReturnType<typeof createRelaysListTool>

    beforeAll(() => {
      listTool = createRelaysListTool({ core })
    })

    it('format=full should include contributingAuthors', async () => {
      const result = await listTool.handler({ format: 'full', limit: 1 } as any)
      if (result.relays.length > 0) {
        expect(result.relays[0].network?.contributingAuthors).toBeDefined()
      }
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const result = await listTool.handler({ format: 'detailed', limit: 1 } as any)
      if (result.relays.length > 0) {
        expect(result.relays[0].network?.contributingAuthors).toBeUndefined()
        expect(result.relays[0].relayUrl).toBeDefined()
      }
    })

    it('format=simple should return string array', async () => {
      const result = await listTool.handler({ format: 'simple', limit: 3 } as any)
      if (result.relays.length > 0) {
        expect(typeof result.relays[0]).toBe('string')
      }
    })


    it('no format parameter should default to detailed', async () => {
      const result = await listTool.handler({ limit: 1 } as any)
      if (result.relays.length > 0) {
        expect(result.relays[0].network?.contributingAuthors).toBeUndefined()
        expect(result.relays[0].relayUrl).toBeDefined()
      }
    })
  })

  describe('ContextVM Tools: relays/state', () => {
    let getStateTool: ReturnType<typeof createRelaysGetStateTool>

    beforeAll(() => {
      getStateTool = createRelaysGetStateTool({ core })
    })

    it('format=full should include contributingAuthors', async () => {
      const result = await getStateTool.handler({
        relayUrl: 'wss://relay1.example.com',
        format: 'full',
      } as any)
      expect(result.relay.network?.contributingAuthors).toBeDefined()
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const result = await getStateTool.handler({
        relayUrl: 'wss://relay1.example.com',
        format: 'detailed',
      } as any)
      expect(result.relay.network?.contributingAuthors).toBeUndefined()
      expect(result.relay.network?.value).toBeDefined()
    })

    it('format=simple should return object for single relay', async () => {
      const result = await getStateTool.handler({
        relayUrl: 'wss://relay1.example.com',
        format: 'simple',
      } as any)
      expect(typeof result.relay).toBe('object')
      expect(result.relay.relayUrl).toBeDefined()
      expect(result.relay.network?.contributingAuthors).toBeUndefined()
    })

  })

  describe('ContextVM Tools: relays/search', () => {
    let searchTool: ReturnType<typeof createRelaysSearchTool>

    beforeAll(() => {
      searchTool = createRelaysSearchTool({ core })
    })

    it('format=full should include contributingAuthors', async () => {
      const result = await searchTool.handler({ format: 'full', limit: 1 } as any)
      if (result.relays.length > 0) {
        expect(result.relays[0].network?.contributingAuthors).toBeDefined()
      }
    })

    it('format=detailed should NOT include contributingAuthors', async () => {
      const result = await searchTool.handler({ format: 'detailed', limit: 1 } as any)
      if (result.relays.length > 0) {
        expect(result.relays[0].network?.contributingAuthors).toBeUndefined()
      }
    })

    it('format=simple should return string array', async () => {
      const result = await searchTool.handler({ format: 'simple', limit: 3 } as any)
      if (result.relays.length > 0) {
        expect(typeof result.relays[0]).toBe('string')
      }
    })

  })
})
