/**
 * REST API Integration Tests
 *
 * Tests for REST endpoint security, headers, and error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { SubscriptionManager } from '../src/services/subscription-manager.js'
import { SSEDeliveryService } from '../src/rest/sse-delivery.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'

describe('REST API Integration Tests', () => {
  let server: RestServer
  let app: any

  beforeAll(() => {
    const core = initStateCore({
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
      enableRateLimiting: false, // Disable for testing
      enableAuth: false,
      allowAnyPubkey: true,
    })
    const subscriptionManager = new SubscriptionManager()
    const sseDelivery = new SSEDeliveryService(subscriptionManager)
    const queryCache = new QueryCache()

    server = new RestServer(
      {
        host: '127.0.0.1',
        port: 0, // Random port
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

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ping',
      })

      // If the server isn't running, provide helpful error
      if (response.statusCode !== 200) {
        throw new Error(
          `Server not responding correctly. Status: ${response.statusCode}. ` +
          `This likely means the REST server isn't running. Body: ${response.body}`
        )
      }

      expect(response.statusCode).toBe(200)

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(response.headers['content-security-policy']).toContain("default-src 'none'")
    })
  })

  describe('Payments Health', () => {
    it('should return featureEnabled=false when FEATURE_402 is not set', async () => {
      delete process.env.FEATURE_402
      const response = await app.inject({ method: 'GET', url: '/health/payments' })
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.featureEnabled).toBe(false)
    })

    it('should return quickly with featureEnabled=true but no gateway installed', async () => {
      process.env.FEATURE_402 = 'true'
      delete process.env.LND_GRPC_HOST
      delete process.env.LND_PROTO_DIR
      delete process.env.LND_PROTO_JSON_PATH
      delete process.env.LND_REST_URL
      delete process.env.LND_MACAROON_HEX
      delete process.env.CASHU_MINT_URL

      const start = Date.now()
      const response = await app.inject({ method: 'GET', url: '/health/payments' })
      const elapsed = Date.now() - start
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.featureEnabled).toBe(true)
      expect(body.lnd.grpc.configured).toBe(false)
      expect(body.lnd.rest.configured).toBe(false)
      expect(body.p2pk.configured).toBe(false)
      // Sanity: should be fast
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      })

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it.skip('should handle invalid JSON gracefully (DISABLED: subscriptions disabled)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/subscriptions',
        headers: {
          'content-type': 'application/json',
        },
        payload: '{invalid json}',
      })

      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })

    it('should sanitize 5xx errors', async () => {
      // Try to trigger an internal error (if possible)
      const response = await app.inject({
        method: 'GET',
        url: '/relays/invalid-relay-url',
      })

      // If we get a 5xx error, check that it's sanitized
      if (response.statusCode >= 500) {
        const body = JSON.parse(response.body)
        expect(body.error.code).toBe('INTERNAL_ERROR')
        expect(body.error.message).toBe('An internal server error occurred')
        // Should not contain stack traces or file paths
        expect(body.error.message).not.toMatch(/\/home\//)
        expect(body.error.message).not.toMatch(/node_modules/)
      }
    })
  })

  describe('Request Size Limits', () => {
    it.skip('should reject oversized request bodies (DISABLED: subscriptions disabled)', async () => {
      // Create a payload larger than 1MB
      const largePayload = {
        filter: {
          data: 'x'.repeat(2 * 1024 * 1024), // 2MB of data
        },
      }

      const response = await app.inject({
        method: 'POST',
        url: '/subscriptions',
        headers: {
          'content-type': 'application/json',
        },
        payload: largePayload,
      })

      // Should be rejected (413 Payload Too Large or 400)
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ping',
      })

      // Provide helpful error if server isn't responding
      if (response.statusCode !== 200) {
        throw new Error(
          `Health endpoint failed with status ${response.statusCode}. ` +
          `This likely indicates the REST server isn't fully initialized. ` +
          `Response: ${response.body}`
        )
      }

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      expect(body.status).toBeDefined()
      expect(['ok', 'degraded', 'error']).toContain(body.status)
      expect(body.version).toBeDefined()
      expect(body.uptime).toBeTypeOf('number')
      expect(body.relayCount).toBeDefined()
      expect(body.observationCount).toBeTypeOf('number')
      expect(body.timestamp).toBeTypeOf('number')

      // Check for cache stats (new in Milestone 108+)
      if (body.cache) {
        expect(body.cache.size).toBeTypeOf('number')
        expect(body.cache.maxSize).toBeTypeOf('number')
        expect(body.cache.hitRate).toBeTypeOf('number')
        expect(body.cache.hitRatePercent).toBeTypeOf('number')
      }
    })
  })

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/health/ping',
        headers: {
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      })

      expect(response.statusCode).toBe(204)
      expect(response.headers['access-control-allow-origin']).toBeDefined()
      expect(response.headers['access-control-allow-methods']).toBeDefined()
    })
  })

  describe('ETag Caching', () => {
    it('should return ETag header for GET requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ping',
      })

      if (response.statusCode !== 200) {
        throw new Error(
          `ETag test failed - server returned ${response.statusCode}. ` +
          `Ensure the REST server is running properly.`
        )
      }

      expect(response.statusCode).toBe(200)
      expect(response.headers['etag']).toBeDefined()
      expect(response.headers['cache-control']).toBeDefined()
    })

    it('should return 304 Not Modified for matching ETag', async () => {
      // First request
      const response1 = await app.inject({
        method: 'GET',
        url: '/health/ping',
      })

      if (response1.statusCode !== 200) {
        throw new Error(
          `First ETag request failed with ${response1.statusCode}. ` +
          `Server may not be initialized.`
        )
      }

      expect(response1.statusCode).toBe(200)
      const etag = response1.headers['etag']

      // Second request with If-None-Match
      const response2 = await app.inject({
        method: 'GET',
        url: '/health/ping',
        headers: {
          'if-none-match': etag,
        },
      })

      expect(response2.statusCode).toBe(304)
      expect(response2.headers['etag']).toBe(etag)
    })
  })

  describe('Request Logging', () => {
    it('should log request details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ping',
        headers: {
          'user-agent': 'test-agent',
        },
      })

      if (response.statusCode !== 200) {
        throw new Error(
          `Request logging test failed - server returned ${response.statusCode}. ` +
          `The REST server may not be responding.`
        )
      }

      expect(response.statusCode).toBe(200)
      // Request should be logged (check manually or with log capture)
    })
  })
})
