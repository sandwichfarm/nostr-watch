import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RestServer } from '../src/rest/server.js'
import { initStateCore } from '../src/core/index.js'
import { MetricsService } from '../src/services/metrics.js'
import { SecurityService } from '../src/services/security.js'
import { RateLimiterService } from '../src/services/rate-limiter.js'
import { QueryCache } from '../src/services/cache.js'
import { DEFAULT_QUERY_SHAPE } from '../src/utils/validation.js'

describe('OpenAPI 402 documentation', () => {
  let server: RestServer
  let app: any

  beforeAll(async () => {
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
        enableSwagger: true,
        allowPolicyUpdate: false,
        rateLimit: { enabled: false, requestsPerSecond: 10, maxBurst: 100 },
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

    // Wait for routes and swagger to be ready
    await (server as any).routesReady

    app = server.getApp()

    // Call ready() to finalize all routes for swagger introspection
    await app.ready()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('includes 402 responses and headers for paid endpoints', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' })
    expect(res.statusCode).toBe(200)
    const spec = JSON.parse(res.body)

    // /relays/compare
    const compare = spec.paths['/relays/compare']?.post
    expect(compare).toBeDefined()
    expect(compare.responses['402']).toBeDefined()
    const compareHeaders = compare.responses['402'].headers || {}
    expect(compareHeaders['WWW-Authenticate'] || compareHeaders['X-Cashu']).toBeDefined()

    // /relays/search
    const search = spec.paths['/relays/search']?.post
    expect(search).toBeDefined()
    expect(search.responses['402']).toBeDefined()

    // /monitors/analytics
    const analytics = spec.paths['/monitors/analytics']?.get
    expect(analytics).toBeDefined()
    expect(analytics.responses['402']).toBeDefined()
  })
})

