/**
 * Compact Mode Tests
 *
 * Validates that the compact parameter correctly removes contributingAuthors
 * and authors fields while preserving all other relay state data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { SubscriptionManager } from '../src/services/subscription-manager.js'
import { SSEDeliveryService } from '../src/rest/sse-delivery.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'

describe('Compact Mode Tests', () => {
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
    const subscriptionManager = new SubscriptionManager()
    const sseDelivery = new SSEDeliveryService(subscriptionManager)
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
        subscriptionManager,
        sseDelivery,
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

  describe('GET /relays with compact parameter', () => {
    it('should return full response without compact parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Full response may contain contributingAuthors
      // (depending on aggregation implementation)
    })

    it('should remove contributor fields when compact=true', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10&compact=true',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Verify no contributingAuthors or authors anywhere
      expect(hasContributorFields(body.relays)).toBe(false)
    })

    it('should preserve essential relay data in compact mode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10&compact=true',
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

  describe('POST /relays/search with compact parameter', () => {
    it('should return full response without compact parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
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

    it('should remove contributor fields when compact=true in POST body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          network: 'clearnet',
          limit: 100,
          compact: true,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      expect(body.relays.length).toBeGreaterThan(0)

      // Verify no contributingAuthors or authors anywhere
      expect(hasContributorFields(body.relays)).toBe(false)
    })

    it('should handle complex filters with compact mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          nips: [1, 11],
          software: { family: 'strfry' },
          compact: true,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(hasContributorFields(body.relays)).toBe(false)
    })
  })

  describe('GET /relays/nearby with compact parameter', () => {
    it('should support compact mode for nearby search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/nearby?lat=37.7749&lon=-122.4194&radius=100&compact=true',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()

      if (body.relays.length > 0) {
        expect(hasContributorFields(body.relays)).toBe(false)
      }
    })
  })

  describe('GET /relays/bbox with compact parameter', () => {
    it('should support compact mode for bbox search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/bbox?sw.lat=32&sw.lon=-125&ne.lat=42&ne.lon=-120&compact=true',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()

      if (body.relays.length > 0) {
        expect(hasContributorFields(body.relays)).toBe(false)
      }
    })
  })

  describe('GET /relays/by/label with compact parameter', () => {
    it('should support compact mode for label-based search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays/by/label?namespace=nip32.geo&value=US&compact=true',
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
    it('should recursively remove contributor fields from nested objects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10&compact=true',
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

    it('should not affect non-contributor fields', async () => {
      // Get same relay with and without compact
      const fullResponse = await app.inject({
        method: 'GET',
        url: '/relays?limit=1&compact=false',
      })

      const compactResponse = await app.inject({
        method: 'GET',
        url: '/relays?limit=1&compact=true',
      })

      expect(fullResponse.statusCode).toBe(200)
      expect(compactResponse.statusCode).toBe(200)

      const fullRelay = JSON.parse(fullResponse.body).relays[0]
      const compactRelay = JSON.parse(compactResponse.body).relays[0]

      // Essential fields should match
      expect(compactRelay.relayUrl).toBe(fullRelay.relayUrl)
      expect(compactRelay.observationCount).toBe(fullRelay.observationCount)

      if (fullRelay.network) {
        expect(compactRelay.network.value).toBe(fullRelay.network.value)
        expect(compactRelay.network.support).toBe(fullRelay.network.support)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty result sets with compact mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/relays/search',
        payload: {
          nips: [99999], // Non-existent NIP
          compact: true,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toEqual([])
      expect(body.total).toBe(0)
    })

    it('should handle compact=false explicitly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10&compact=false',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.relays).toBeDefined()
      // compact=false should return full data
    })

    it('should handle invalid compact values gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?limit=10&compact=invalid',
      })

      // Should still return valid response (treating as false or true)
      expect(response.statusCode).toBe(200)
    })
  })
})
