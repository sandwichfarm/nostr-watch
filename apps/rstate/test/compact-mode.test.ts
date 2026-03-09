/**
 * Shape-specific Endpoint Tests
 *
 * Validates that the shape-specific endpoints (/detailed, /full, /simple)
 * correctly control whether contributingAuthors and authors fields are
 * included in the response while preserving all other relay state data.
 *
 * Migrated from the old compact query-parameter approach to path-based shapes:
 *   - /detailed  → no contributor attribution (was compact=true)
 *   - /full      → full contributor attribution (was compact=false / default)
 *   - /simple    → minimal URL-only output
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

describe('Shape-specific Endpoint Tests', () => {
  let server: RestServer
  let app: any
  let core: ReturnType<typeof initStateCore>

  const baseTime = Math.floor(Date.now() / 1000) - 3600

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
      id: 'obs1-monitor1',
      author: 'monitor1pubkey',
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
      author: 'monitor2pubkey',
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
  ]

  beforeAll(() => {
    core = initStateCore({ aggregation: DEFAULT_POLICY })

    // Seed data
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

  /**
   * Helper to recursively check for contributingAuthors/authors fields
   */
  function hasContributorFields(obj: any): boolean {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return false
    }

    if (Array.isArray(obj)) {
      return obj.some(item => hasContributorFields(item))
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'contributingAuthors' || key === 'authors') {
        return true
      }
      if (hasContributorFields(value)) {
        return true
      }
    }

    return false
  }

  describe('GET /relays/full and GET /relays/detailed', () => {
    it('should return full response with contributor data via /relays/full', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/full?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Full response may contain contributingAuthors
      // (depending on aggregation implementation)
    })

    it('should remove contributor fields via /relays/detailed', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Verify no contributingAuthors or authors anywhere
      expect(hasContributorFields(body.relays)).toBe(false)
    })

    it('should preserve essential relay data in detailed shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      const relay = body.relays[0]
      expect(relay.relayUrl).toBeDefined()
      expect(relay.updated_at).toBeDefined()
      expect(relay.observationCount).toBeDefined()

      // Check critical fields are preserved
      if (relay.network) {
        expect(relay.network.value).toBeDefined()
        expect(relay.network.support).toBeDefined()
      }

      if (relay.software?.family) {
        expect(relay.software.family.value).toBeDefined()
        expect(relay.software.family.support).toBeDefined()
      }

      if (relay.rtt?.open) {
        expect(relay.rtt.open.value).toBeDefined()
        expect(relay.rtt.open.mad).toBeDefined()
      }
    })
  })

  describe('POST /relays/search/full and POST /relays/search/detailed', () => {
    it('should return full response via /relays/search/full', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search/full',
        payload: {
          network: 'clearnet',
          limit: 100,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)
    })

    it('should remove contributor fields via /relays/search/detailed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search/detailed',
        payload: {
          network: 'clearnet',
          limit: 100,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Verify no contributingAuthors or authors anywhere
      expect(hasContributorFields(body.relays)).toBe(false)
    })

    it('should handle complex filters with detailed shape', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search/detailed',
        payload: {
          nips: [1, 11],
          software: { family: 'strfry' },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(hasContributorFields(body.relays)).toBe(false)
    })
  })

  describe('GET /relays/nearby/detailed', () => {
    it('should support detailed shape for nearby search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/nearby/detailed?lat=37.7749&lon=-122.4194&radius=100',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()

      if (body.relays.length > 0) {
        expect(hasContributorFields(body.relays)).toBe(false)
      }
    })
  })

  describe('GET /relays/bbox/detailed', () => {
    it('should support detailed shape for bbox search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/bbox/detailed?sw.lat=32&sw.lon=-125&ne.lat=42&ne.lon=-120',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()

      if (body.relays.length > 0) {
        expect(hasContributorFields(body.relays)).toBe(false)
      }
    })
  })

  describe('GET /relays/by/label/detailed', () => {
    it('should support detailed shape for label-based search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/by/label/detailed?namespace=nip32.geo&value=US',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()

      if (body.relays.length > 0) {
        expect(hasContributorFields(body.relays)).toBe(false)

        // Verify essential data is present
        const relay = body.relays[0]
        expect(relay.relayUrl).toBeDefined()
        expect(relay.observationCount).toBeDefined()
      }
    })
  })

  describe('Defense-in-depth validation', () => {
    it('should recursively remove contributor fields from nested objects in detailed shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Deep inspection of nested structures
      for (const relay of body.relays) {
        if (relay.software) {
          expect(hasContributorFields(relay.software)).toBe(false)
        }
        if (relay.rtt) {
          expect(hasContributorFields(relay.rtt)).toBe(false)
        }
        if (relay.requirements) {
          expect(hasContributorFields(relay.requirements)).toBe(false)
        }
        if (relay.geo) {
          expect(hasContributorFields(relay.geo)).toBe(false)
        }
      }
    })

    it('should not affect non-contributor fields between full and detailed shapes', async () => {
      // Get same relay with full and detailed shapes
      const fullResponse = await app.inject({
        method: 'GET',
        url: '/relays/full?limit=1',
      })

      const detailedResponse = await app.inject({
        method: 'GET',
        url: '/relays/detailed?limit=1',
      })

      expect(fullResponse.statusCode).toBe(200)
      expect(detailedResponse.statusCode).toBe(200)

      const fullRelay = JSON.parse(fullResponse.body).relays[0]
      const detailedRelay = JSON.parse(detailedResponse.body).relays[0]

      // Essential fields should match
      expect(detailedRelay.relayUrl).toBe(fullRelay.relayUrl)
      expect(detailedRelay.observationCount).toBe(fullRelay.observationCount)

      if (fullRelay.network) {
        expect(detailedRelay.network.value).toBe(fullRelay.network.value)
        expect(detailedRelay.network.support).toBe(fullRelay.network.support)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty result sets with detailed shape', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search/detailed',
        payload: {
          nips: [99999], // Non-existent NIP
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toEqual([])
      expect(body.total).toBe(0)
    })

    it('should return full attribution data via /relays/full', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/full?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      // /full should return complete data with contributor attribution
    })

    it('should return simple format via /relays', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      // Simple format returns minimal URL-only output
    })
  })
})
