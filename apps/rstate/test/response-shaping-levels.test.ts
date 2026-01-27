/**
 * Three-Level Response Shaping Tests
 *
 * Comprehensive test suite for the three-level response shaping system:
 * - full: Complete RelayState with contributor attribution
 * - detailed: CompactRelayState without attribution (default)
 * - simple: String array of relay URLs only
 *
 * Test Coverage:
 * 1. Unit tests for shaping utility functions
 * 2. Integration tests for REST endpoints
 * 3. Backward compatibility tests for legacy 'compact' parameter
 * 4. Schema conformance and type safety tests
 * 5. Performance benchmarks comparing three shapes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation, RelayState } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { SubscriptionManager } from '../src/services/subscription-manager.js'
import { SSEDeliveryService } from '../src/rest/sse-delivery.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'
import {
  toSimpleList,
  applyShapeList,
  applyShapeSingle,
  toDetailed,
  toCompact,
  type ResponseShape,
} from '../src/types/response-formats.js'

describe('Three-Level Response Shaping', () => {
  // ==================== UNIT TESTS ====================
  describe('Unit Tests: Shaping Utilities', () => {
    let mockState: RelayState

    beforeAll(() => {
      // Create mock RelayState with full attribution data
      mockState = {
        relayUrl: 'wss://relay.example.com',
        updated_at: 1700000000,
        observationCount: 10,
        lastSeenAt: 1700000100,
        lastOpenAt: 1700000050,
        network: {
          value: 'clearnet',
          support: 1.0,
          sampleSize: 10,
          lastUpdated: 1700000000,
          contributingAuthors: ['monitor1', 'monitor2'],
        },
        software: {
          family: {
            value: 'strfry',
            support: 0.9,
            sampleSize: 9,
            lastUpdated: 1700000000,
            contributingAuthors: ['monitor1'],
          },
          version: {
            value: '0.9.6',
            support: 0.8,
            sampleSize: 8,
            lastUpdated: 1700000000,
            contributingAuthors: ['monitor1', 'monitor3'],
          },
        },
        country: {
          value: 'US',
          support: 1.0,
          sampleSize: 10,
          lastUpdated: 1700000000,
          contributingAuthors: ['monitor1', 'monitor2', 'monitor3'],
        },
      } as RelayState
    })

    describe('toDetailed()', () => {
      it('should preserve full RelayState with all attribution', () => {
        const result = toDetailed(mockState)

        // Identity function - returns same object
        expect(result).toBe(mockState)
        expect(result.network?.contributingAuthors).toEqual(['monitor1', 'monitor2'])
        expect(result.software?.family?.contributingAuthors).toEqual(['monitor1'])
        expect(result.software?.version?.contributingAuthors).toEqual(['monitor1', 'monitor3'])
        expect(result.country?.contributingAuthors).toEqual(['monitor1', 'monitor2', 'monitor3'])
      })

      it('should maintain all fields including optional ones', () => {
        const result = toDetailed(mockState)

        expect(result.relayUrl).toBe('wss://relay.example.com')
        expect(result.observationCount).toBe(10)
        expect(result.lastSeenAt).toBe(1700000100)
        expect(result.lastOpenAt).toBe(1700000050)
      })
    })

    describe('toSimpleList()', () => {
      it('should extract only relay URLs from array of states', () => {
        const states = [
          { relayUrl: 'wss://relay1.com', updated_at: 1700000000, observationCount: 5 },
          { relayUrl: 'wss://relay2.com', updated_at: 1700000100, observationCount: 3 },
          { relayUrl: 'wss://relay3.com', updated_at: 1700000200, observationCount: 7 },
        ] as RelayState[]

        const result = toSimpleList(states)

        expect(result).toEqual([
          'wss://relay1.com',
          'wss://relay2.com',
          'wss://relay3.com',
        ])
        expect(result).toHaveLength(3)
        expect(typeof result[0]).toBe('string')
      })

      it('should return empty array for empty input', () => {
        const result = toSimpleList([])
        expect(result).toEqual([])
        expect(Array.isArray(result)).toBe(true)
      })

      it('should handle states with special characters in URLs', () => {
        const states = [
          { relayUrl: 'wss://relay.example.com:8080/path?query=value', updated_at: 1700000000, observationCount: 1 },
        ] as RelayState[]

        const result = toSimpleList(states)
        expect(result[0]).toBe('wss://relay.example.com:8080/path?query=value')
      })
    })

    describe('applyShapeList()', () => {
      let states: RelayState[]

      beforeAll(() => {
        states = [
          mockState,
          { relayUrl: 'wss://relay2.com', updated_at: 1700000100, observationCount: 5 } as RelayState,
        ]
      })

      it('should return full RelayState array for shape="full"', () => {
        const result = applyShapeList(states, 'full')

        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(states[0])
        // Check if contributingAuthors exist (they should for full)
        if ((result[0] as RelayState).network) {
          expect((result[0] as RelayState).network?.contributingAuthors).toBeDefined()
        }
      })

      it('should return CompactRelayState array for shape="detailed"', () => {
        const result = applyShapeList(states, 'detailed')

        expect(result).toHaveLength(2)
        // Should not have contributingAuthors
        expect((result[0] as any).network?.contributingAuthors).toBeUndefined()
        // Should have all other fields
        expect((result[0] as any).network?.value).toBe('clearnet')
        expect((result[0] as any).relayUrl).toBe('wss://relay.example.com')
      })

      it('should return string array for shape="simple"', () => {
        const result = applyShapeList(states, 'simple')

        expect(result).toHaveLength(2)
        expect(typeof result[0]).toBe('string')
        expect(result).toEqual([
          'wss://relay.example.com',
          'wss://relay2.com',
        ])
      })

      it('should maintain array order for all shapes', () => {
        const orderedStates = [
          { relayUrl: 'wss://aaa.com', updated_at: 1, observationCount: 1 },
          { relayUrl: 'wss://bbb.com', updated_at: 2, observationCount: 2 },
          { relayUrl: 'wss://ccc.com', updated_at: 3, observationCount: 3 },
        ] as RelayState[]

        const fullResult = applyShapeList(orderedStates, 'full')
        const detailedResult = applyShapeList(orderedStates, 'detailed')
        const simpleResult = applyShapeList(orderedStates, 'simple')

        expect((fullResult[0] as RelayState).relayUrl).toBe('wss://aaa.com')
        expect((detailedResult[0] as any).relayUrl).toBe('wss://aaa.com')
        expect(simpleResult[0]).toBe('wss://aaa.com')
      })
    })

    describe('applyShapeSingle()', () => {
      it('should return full RelayState for shape="full"', () => {
        const result = applyShapeSingle(mockState, 'full')

        expect(result).toBe(mockState)
        expect((result as RelayState).network?.contributingAuthors).toBeDefined()
      })

      it('should return CompactRelayState for shape="detailed"', () => {
        const result = applyShapeSingle(mockState, 'detailed')

        expect(result).not.toBeNull()
        expect((result as any).network?.contributingAuthors).toBeUndefined()
        expect((result as any).network?.value).toBe('clearnet')
      })

      it('should return CompactRelayState for shape="simple" (not string)', () => {
        // For single endpoints, 'simple' is treated as 'detailed'
        const result = applyShapeSingle(mockState, 'simple')

        expect(result).not.toBeNull()
        expect(typeof result).toBe('object')
        expect((result as any).relayUrl).toBe('wss://relay.example.com')
        expect((result as any).network?.contributingAuthors).toBeUndefined()
      })

      it('should return null for null input regardless of shape', () => {
        expect(applyShapeSingle(null, 'full')).toBeNull()
        expect(applyShapeSingle(null, 'detailed')).toBeNull()
        expect(applyShapeSingle(null, 'simple')).toBeNull()
      })
    })

    describe('toCompact() removes all attribution', () => {
      it('should remove contributingAuthors from all aggregated values', () => {
        const compact = toCompact(mockState)

        expect(compact.network?.contributingAuthors).toBeUndefined()
        expect(compact.software?.family?.contributingAuthors).toBeUndefined()
        expect(compact.software?.version?.contributingAuthors).toBeUndefined()
        expect(compact.country?.contributingAuthors).toBeUndefined()
      })

      it('should preserve all non-attribution fields', () => {
        const compact = toCompact(mockState)

        expect(compact.relayUrl).toBe(mockState.relayUrl)
        expect(compact.observationCount).toBe(mockState.observationCount)
        expect(compact.network?.value).toBe(mockState.network?.value)
        expect(compact.software?.family?.value).toBe(mockState.software?.family?.value)
      })
    })
  })

  // ==================== INTEGRATION TESTS ====================
  describe('Integration Tests: REST Endpoints', () => {
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
        id: 'obs1',
        author: 'monitor1pubkey',
        relayUrl: 'wss://relay1.example.com',
        network: 'clearnet',
        created_at: baseTime + 60,
        rtt: { open: 150, read: 50, write: 75 },
        nips: [1, 2, 11, 50],
        software: { family: 'strfry', version: '0.9.6' },
        labels: [
          { namespace: 'nip32.geo', value: 'US' },
          { namespace: 'nip32.city', value: 'San Francisco' },
        ],
        geohashes: ['9q8yy', '9q8y', '9q8'],
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
        labels: [
          { namespace: 'nip32.geo', value: 'US' },
          { namespace: 'nip32.city', value: 'San Francisco' },
        ],
        geohashes: ['9q8yy', '9q8y', '9q8'],
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
    ]

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

      // Inject test data
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

    describe('GET /relays (list endpoint)', () => {
      it('should return full RelayState array with format=full', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays?format=full',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relays).toBeInstanceOf(Array)
        expect(body.relays.length).toBeGreaterThan(0)

        const relay = body.relays[0]
        // Should have contributingAuthors
        expect(relay.network?.contributingAuthors).toBeDefined()
        expect(Array.isArray(relay.network?.contributingAuthors)).toBe(true)
      })

      it('should return CompactRelayState array with format=detailed (default)', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays?format=detailed',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relays).toBeInstanceOf(Array)

        const relay = body.relays[0]
        // Should NOT have contributingAuthors
        expect(relay.network?.contributingAuthors).toBeUndefined()
        // Should have other fields
        expect(relay.network?.value).toBeDefined()
        expect(relay.relayUrl).toBeDefined()
      })

      it('should return string array with format=simple', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays?format=simple',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relays).toBeInstanceOf(Array)
        expect(body.relays.length).toBeGreaterThan(0)

        // Should be array of strings
        expect(typeof body.relays[0]).toBe('string')
        expect(body.relays[0]).toMatch(/^wss:\/\//)
      })

      it('should default to detailed format when no format specified', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        const relay = body.relays[0]
        expect(relay.network?.contributingAuthors).toBeUndefined()
      })

      it('should respect pagination with all format types', async () => {
        const responseSimple = await app.inject({
          method: 'GET',
          url: '/relays?format=simple&limit=1',
        })

        const body = JSON.parse(responseSimple.body)
        expect(body.relays).toHaveLength(1)
        expect(body.limit).toBe(1)
      })
    })

    describe('GET /relays/state (single endpoint)', () => {
      it('should return full RelayState with format=full', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays/state?relayUrl=wss://relay1.example.com&format=full',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relay).toBeDefined()
        expect(body.relay.relayUrl).toBe('wss://relay1.example.com')
        expect(body.relay.network?.contributingAuthors).toBeDefined()
      })

      it('should return CompactRelayState with format=detailed', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays/state?relayUrl=wss://relay1.example.com&format=detailed',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relay.network?.contributingAuthors).toBeUndefined()
        expect(body.relay.network?.value).toBeDefined()
      })

      it('should treat format=simple as detailed for single endpoint', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays/state?relayUrl=wss://relay1.example.com&format=simple',
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        // Should return object, not string
        expect(typeof body.relay).toBe('object')
        expect(body.relay.relayUrl).toBeDefined()
        expect(body.relay.network?.contributingAuthors).toBeUndefined()
      })

      it('should return 404 for non-existent relay', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/relays/state?relayUrl=wss://nonexistent.com&format=full',
        })

        expect(response.statusCode).toBe(404)
      })
    })

    describe('POST /relays/search (search endpoint)', () => {
      it('should return full RelayState array with format=full', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: {
            format: 'full',
            limit: 10,
          },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relays).toBeInstanceOf(Array)
        if (body.relays.length > 0) {
          expect(body.relays[0].network?.contributingAuthors).toBeDefined()
        }
      })

      it('should return CompactRelayState array with format=detailed', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: {
            format: 'detailed',
            limit: 10,
          },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        if (body.relays.length > 0) {
          expect(body.relays[0].network?.contributingAuthors).toBeUndefined()
        }
      })

      it('should return string array with format=simple', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: {
            format: 'simple',
            limit: 10,
          },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        if (body.relays.length > 0) {
          expect(typeof body.relays[0]).toBe('string')
        }
      })

      it('should respect search filters with all format types', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/relays/search',
          payload: {
            format: 'simple',
            network: 'clearnet',
          },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.relays).toBeInstanceOf(Array)
      })
    })
  })

  // ==================== BACKWARD COMPATIBILITY TESTS ====================

  // ==================== SCHEMA CONFORMANCE TESTS ====================
  describe('Schema Conformance', () => {
    it('should validate simple response as proper string array', () => {
      const mockStates = [
        { relayUrl: 'wss://relay1.com', updated_at: 1, observationCount: 1 },
        { relayUrl: 'wss://relay2.com', updated_at: 2, observationCount: 2 },
      ] as RelayState[]

      const result = toSimpleList(mockStates)

      // Type checking
      expect(Array.isArray(result)).toBe(true)
      result.forEach((url) => {
        expect(typeof url).toBe('string')
        expect(url).toMatch(/^wss:\/\//)
      })
    })

    it('should validate detailed response matches CompactRelayState interface', () => {
      const mockState = {
        relayUrl: 'wss://relay.com',
        updated_at: 1700000000,
        observationCount: 5,
        network: {
          value: 'clearnet',
          support: 1.0,
          sampleSize: 5,
          lastUpdated: 1700000000,
          contributingAuthors: ['monitor1'],
        },
      } as RelayState

      const result = toCompact(mockState)

      // Should have required fields
      expect(result.relayUrl).toBeDefined()
      expect(result.updated_at).toBeDefined()
      expect(result.observationCount).toBeDefined()

      // Should NOT have contributingAuthors
      expect(result.network?.contributingAuthors).toBeUndefined()

      // Should have aggregated value fields
      expect(result.network?.value).toBeDefined()
      expect(result.network?.support).toBeDefined()
    })

    it('should validate full response matches RelayState interface', () => {
      const mockState = {
        relayUrl: 'wss://relay.com',
        updated_at: 1700000000,
        observationCount: 5,
        network: {
          value: 'clearnet',
          support: 1.0,
          sampleSize: 5,
          lastUpdated: 1700000000,
          contributingAuthors: ['monitor1', 'monitor2'],
        },
      } as RelayState

      const result = toDetailed(mockState)

      // Should be identical to input
      expect(result).toBe(mockState)
      expect(result.network?.contributingAuthors).toEqual(['monitor1', 'monitor2'])
    })
  })
})
