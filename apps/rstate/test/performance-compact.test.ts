/**
 * Performance Tests for Compact Mode
 *
 * Benchmarks response size and processing time differences between
 * compact and full response modes.
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

describe('Compact Mode Performance Tests', () => {
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
    it('should produce smaller response size in compact mode', async () => {
      const fullResponse = await app.inject({
        method: 'GET',
        url: '/relays?limit=50&compact=false',
      })

      const compactResponse = await app.inject({
        method: 'GET',
        url: '/relays?limit=50&compact=true',
      })

      expect(fullResponse.statusCode).toBe(200)
      expect(compactResponse.statusCode).toBe(200)

      const fullSize = Buffer.byteLength(fullResponse.body, 'utf8')
      const compactSize = Buffer.byteLength(compactResponse.body, 'utf8')

      console.log(`Full response: ${fullSize} bytes`)
      console.log(`Compact response: ${compactSize} bytes`)
      console.log(`Size reduction: ${((1 - compactSize / fullSize) * 100).toFixed(2)}%`)

      // Compact should be smaller (or equal if no contributor data exists)
      expect(compactSize).toBeLessThanOrEqual(fullSize)
    })

    it('should measure size difference for search endpoint', async () => {
      const fullResponse = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          network: 'clearnet',
          limit: 100,
          compact: false,
        },
      })

      const compactResponse = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          network: 'clearnet',
          limit: 100,
          compact: true,
        },
      })

      const fullSize = Buffer.byteLength(fullResponse.body, 'utf8')
      const compactSize = Buffer.byteLength(compactResponse.body, 'utf8')

      console.log(`Search full: ${fullSize} bytes, compact: ${compactSize} bytes`)

      expect(compactSize).toBeLessThanOrEqual(fullSize)
    })
  })

  describe('Processing Time Comparison', () => {
    it('should measure response time for full vs compact mode', async () => {
      // Warmup
      await app.inject({ method: 'GET', url: '/relays?limit=50&compact=false' })
      await app.inject({ method: 'GET', url: '/relays?limit=50&compact=true' })

      // Measure full mode
      const fullStart = Date.now()
      await app.inject({ method: 'GET', url: '/relays?limit=50&compact=false' })
      const fullTime = Date.now() - fullStart

      // Measure compact mode
      const compactStart = Date.now()
      await app.inject({ method: 'GET', url: '/relays?limit=50&compact=true' })
      const compactTime = Date.now() - compactStart

      console.log(`Full mode: ${fullTime}ms, Compact mode: ${compactTime}ms`)

      // Both should be reasonably fast (under 1 second)
      expect(fullTime).toBeLessThan(1000)
      expect(compactTime).toBeLessThan(1000)
    })

    it('should benchmark search with filters', async () => {
      const iterations = 10
      const fullTimes: number[] = []
      const compactTimes: number[] = []

      for (let i = 0; i < iterations; i++) {
        const fullStart = Date.now()
        await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: { nips: [1, 11], limit: 100, compact: false },
        })
        fullTimes.push(Date.now() - fullStart)

        const compactStart = Date.now()
        await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: { nips: [1, 11], limit: 100, compact: true },
        })
        compactTimes.push(Date.now() - compactStart)
      }

      const avgFull = fullTimes.reduce((a, b) => a + b, 0) / iterations
      const avgCompact = compactTimes.reduce((a, b) => a + b, 0) / iterations

      console.log(`Search benchmark (${iterations} iterations):`)
      console.log(`  Full mode avg: ${avgFull.toFixed(2)}ms`)
      console.log(`  Compact mode avg: ${avgCompact.toFixed(2)}ms`)

      // Both should be consistently fast
      expect(avgFull).toBeLessThan(500)
      expect(avgCompact).toBeLessThan(500)
    })
  })

  describe('Bandwidth Savings Analysis', () => {
    it('should calculate bandwidth savings for typical queries', async () => {
      const queries = [
        { url: '/relays?limit=10', name: 'List 10' },
        { url: '/relays?limit=50', name: 'List 50' },
        { url: '/relays?limit=100', name: 'List 100' },
      ]

      for (const query of queries) {
        const fullResp = await app.inject({
          method: 'GET',
          url: `${query.url}&compact=false`,
        })

        const compactResp = await app.inject({
          method: 'GET',
          url: `${query.url}&compact=true`,
        })

        const fullSize = Buffer.byteLength(fullResp.body, 'utf8')
        const compactSize = Buffer.byteLength(compactResp.body, 'utf8')
        const savings = fullSize - compactSize
        const savingsPercent = ((savings / fullSize) * 100).toFixed(2)

        console.log(`${query.name}: ${fullSize} → ${compactSize} bytes (${savingsPercent}% reduction)`)

        expect(compactSize).toBeLessThanOrEqual(fullSize)
      }
    })
  })

  describe('Scalability Testing', () => {
    it('should handle large result sets efficiently in compact mode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=200&compact=true',
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.relays).toBeDefined()

      // Should complete in reasonable time even with many results
      // (actual timing checked in previous tests)
    })

    it('should maintain performance with complex filters in compact mode', async () => {
      const start = Date.now()

      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          nips: [1, 11, 42],
          software: { family: 'strfry' },
          labels: [{ namespace: 'nip32.geo', value: 'US' }],
          maxLatency: { open: 200 },
          limit: 100,
          compact: true,
        },
      })

      const duration = Date.now() - start

      expect(response.statusCode).toBe(200)
      expect(duration).toBeLessThan(500)

      console.log(`Complex search with compact mode: ${duration}ms`)
    })
  })
})
