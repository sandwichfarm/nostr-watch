/**
 * Performance Tests for Detailed vs Full Response Shapes
 *
 * Benchmarks response size and processing time differences between
 * detailed and full response shape endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'

describe('Shape Endpoint Performance Tests', () => {
  let server: RestServer
  let app: any
  let core: ReturnType<typeof initStateCore>

  const baseTime = Math.floor(Date.now() / 1000) - 3600

  beforeAll(() => {
    core = initStateCore({ aggregation: DEFAULT_POLICY })

    // Seed with multiple relays for meaningful benchmarks
    const monitors: MonitorAnnouncement[] = []
    const observations: RelayObservation[] = []

    // Create 5 monitors
    for (let i = 0; i < 5; i++) {
      monitors.push({
        pubkey: `monitor${i}pubkey`,
        frequency: 300,
        timeout: { open: 5000, read: 5000, write: 5000 },
        checks: ['open', 'read', 'write', 'nips'],
        lastSeen: baseTime,
        eventId: `monitor${i}-event`,
      })
    }

    // Create observations for 20 relays from all monitors
    for (let relayIdx = 0; relayIdx < 20; relayIdx++) {
      for (let monIdx = 0; monIdx < 5; monIdx++) {
        observations.push({
          id: `obs-relay${relayIdx}-mon${monIdx}`,
          author: `monitor${monIdx}pubkey`,
          relayUrl: `wss://relay${relayIdx}.example.com`,
          network: relayIdx % 3 === 0 ? 'tor' : 'clearnet',
          created_at: baseTime + 100 + (relayIdx * 10) + monIdx,
          rtt: {
            open: 50 + (relayIdx * 5),
            read: 30 + (relayIdx * 2),
            write: 25 + (relayIdx * 2),
          },
          nips: [1, 11, 42, 50].slice(0, (relayIdx % 4) + 1),
          software: {
            family: relayIdx % 2 === 0 ? 'strfry' : 'nostr-rs-relay',
            version: '1.0.0'
          },
          labels: [
            { namespace: 'nip32.geo', value: relayIdx % 2 === 0 ? 'US' : 'EU' },
            { namespace: 'nip32.asn', value: `AS${13335 + relayIdx}` },
          ],
          geohashes: ['9q8yy', '9q8y', '9q8'],
        })
      }
    }

    for (const monitor of monitors) {
      core.ingest.monitor(monitor)
    }
    core.ingest.observations(observations)
    core.computeAll()

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
        getRelayCount: () => ({ transport: 2, ingestion: 2 }),
        getMetricsSnapshot: () => ({}),
        getReady: () => true,
      }
    )

    app = server.getApp()
  })

  afterAll(async () => {
    await server.stop()
  })

  describe('Response Size Comparison', () => {
    it('should produce smaller response size in detailed mode vs full mode', async () => {
      const fullResponse = await app.inject({
        method: 'GET',
        url: '/relays/full?limit=50',
      })

      const detailedResponse = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=50',
      })

      expect(fullResponse.statusCode).toBe(200)
      expect(detailedResponse.statusCode).toBe(200)

      const fullSize = Buffer.byteLength(fullResponse.body, 'utf8')
      const detailedSize = Buffer.byteLength(detailedResponse.body, 'utf8')

      console.log(`Full response: ${fullSize} bytes`)
      console.log(`Detailed response: ${detailedSize} bytes`)
      console.log(`Size reduction: ${((1 - detailedSize / fullSize) * 100).toFixed(2)}%`)

      // Detailed should be smaller (or equal if no contributor data exists)
      expect(detailedSize).toBeLessThanOrEqual(fullSize)
    })

    it('should measure size difference for search endpoint', async () => {
      const fullResponse = await app.inject({
        method: 'POST',
        url: '/relays/search/full',
        payload: {
          network: 'clearnet',
          limit: 100,
        },
      })

      const detailedResponse = await app.inject({
        method: 'POST',
        url: '/relays/search/detailed',
        payload: {
          network: 'clearnet',
          limit: 100,
        },
      })

      const fullSize = Buffer.byteLength(fullResponse.body, 'utf8')
      const detailedSize = Buffer.byteLength(detailedResponse.body, 'utf8')

      console.log(`Search full: ${fullSize} bytes, detailed: ${detailedSize} bytes`)

      expect(detailedSize).toBeLessThanOrEqual(fullSize)
    })
  })

  describe('Processing Time Comparison', () => {
    it('should measure response time for full vs detailed mode', async () => {
      // Warmup
      await app.inject({ method: 'GET', url: '/relays/full?limit=50' })
      await app.inject({ method: 'GET', url: '/relays/detailed?limit=50' })

      // Measure full mode
      const fullStart = Date.now()
      await app.inject({ method: 'GET', url: '/relays/full?limit=50' })
      const fullTime = Date.now() - fullStart

      // Measure detailed mode
      const detailedStart = Date.now()
      await app.inject({ method: 'GET', url: '/relays/detailed?limit=50' })
      const detailedTime = Date.now() - detailedStart

      console.log(`Full mode: ${fullTime}ms, Detailed mode: ${detailedTime}ms`)

      // Both should be reasonably fast (under 1 second)
      expect(fullTime).toBeLessThan(1000)
      expect(detailedTime).toBeLessThan(1000)
    })

    it('should benchmark search with filters', async () => {
      const iterations = 10
      const fullTimes: number[] = []
      const detailedTimes: number[] = []

      for (let i = 0; i < iterations; i++) {
        const fullStart = Date.now()
        await app.inject({
          method: 'POST',
          url: '/relays/search/full',
          payload: { nips: [1, 11], limit: 100 },
        })
        fullTimes.push(Date.now() - fullStart)

        const detailedStart = Date.now()
        await app.inject({
          method: 'POST',
          url: '/relays/search/detailed',
          payload: { nips: [1, 11], limit: 100 },
        })
        detailedTimes.push(Date.now() - detailedStart)
      }

      const avgFull = fullTimes.reduce((a, b) => a + b, 0) / iterations
      const avgDetailed = detailedTimes.reduce((a, b) => a + b, 0) / iterations

      console.log(`Search benchmark (${iterations} iterations):`)
      console.log(`  Full mode avg: ${avgFull.toFixed(2)}ms`)
      console.log(`  Detailed mode avg: ${avgDetailed.toFixed(2)}ms`)

      // Both should be consistently fast
      expect(avgFull).toBeLessThan(500)
      expect(avgDetailed).toBeLessThan(500)
    })
  })

  describe('Bandwidth Savings Analysis', () => {
    it('should calculate bandwidth savings for typical queries', async () => {
      const queries = [
        { limit: 10, name: 'List 10' },
        { limit: 50, name: 'List 50' },
        { limit: 100, name: 'List 100' },
      ]

      for (const query of queries) {
        const fullResp = await app.inject({
          method: 'GET',
          url: `/relays/full?limit=${query.limit}`,
        })

        const detailedResp = await app.inject({
          method: 'GET',
          url: `/relays/detailed?limit=${query.limit}`,
        })

        const fullSize = Buffer.byteLength(fullResp.body, 'utf8')
        const detailedSize = Buffer.byteLength(detailedResp.body, 'utf8')
        const savings = fullSize - detailedSize
        const savingsPercent = ((savings / fullSize) * 100).toFixed(2)

        console.log(`${query.name}: ${fullSize} → ${detailedSize} bytes (${savingsPercent}% reduction)`)

        expect(detailedSize).toBeLessThanOrEqual(fullSize)
      }
    })
  })

  describe('Scalability Testing', () => {
    it('should handle large result sets efficiently in detailed mode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=200',
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.relays).toBeDefined()

      // Should complete in reasonable time even with many results
      // (actual timing checked in previous tests)
    })

    it('should maintain performance with complex filters in detailed mode', async () => {
      const start = Date.now()

      const response = await app.inject({
        method: 'POST',
        url: '/relays/search/detailed',
        payload: {
          nips: [1, 11, 42],
          software: { family: 'strfry' },
          labels: [{ namespace: 'nip32.geo', value: 'US' }],
          maxLatency: { open: 200 },
          limit: 100,
        },
      })

      const duration = Date.now() - start

      expect(response.statusCode).toBe(200)
      expect(duration).toBeLessThan(500)

      console.log(`Complex search with detailed mode: ${duration}ms`)
    })
  })
})
