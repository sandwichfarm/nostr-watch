/**
 * REST API Server
 *
 * Provides HTTP REST interface to StateCore
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
// scalar API reference loaded via CDN in HTML template, not imported directly
import type { StateCore } from '../core/index.js'
import type { MetricsService } from '../services/metrics.js'
import type { SecurityService } from '../services/security.js'
// DISABLED: Subscription system (kept for later re-enabling)
// import type { SubscriptionManager } from '../services/subscription-manager.js'
import { RateLimiterService } from '../services/rate-limiter.js'
// import { SSEDeliveryService } from './sse-delivery.js'
import { getLogger } from '../utils/logger.js'
import { registerRelayRoutes } from './routes/relays.js'
import { registerMonitorRoutes } from './routes/monitors.js'
// import { registerPolicyRoutes } from './routes/policy.js'
// import { registerSubscriptionRoutes } from './routes/subscriptions.js'
// import { registerMetricsRoutes } from './routes/metrics.js'
import { registerPaymentsHealthRoutes } from './routes/payments-health.js'
import { getPaymentsPreHandler, NAME_TO_ROUTE } from './payments.js'
import { loadPricing, type PricingEntry } from '../payments/pricing-loader.js'
import { schemas } from './schemas.js'
import { generateETag, etagMatches } from './etag.js'

const logger = getLogger().child({ module: 'rest-server' })

/**
 * REST server configuration
 */
export interface RestServerConfig {
  host: string
  port: number
  apiBaseUrl?: string  // Base URL for OpenAPI spec (e.g., https://api.nostr.watch)
  corsOrigins: string[] | '*'
  enableSwagger: boolean
  allowPolicyUpdate: boolean
  rateLimit: {
    enabled: boolean
    requestsPerSecond: number
    maxBurst: number
  }
}

/**
 * REST server context passed to routes
 */
export interface RestContext {
  core: StateCore
  metrics: MetricsService
  security: SecurityService
  // DISABLED: Subscription system
  // subscriptionManager: SubscriptionManager
  // sseDelivery: SSEDeliveryService
  queryCache: import('../services/cache.js').QueryCache
  allowPolicyUpdate: boolean
  getUptime: () => number
  getRelayCount: () => { transport: number; ingestion: number }
  getMetricsSnapshot: () => any
  getReady: () => boolean
  cvmEnabled?: boolean
}

/**
 * REST API Server
 */
export class RestServer {
  private app: FastifyInstance
  private context: RestContext
  private rateLimiter?: RateLimiterService
  private routesReady: Promise<void>
  private paidRoutePaths: Set<string> = new Set()

  constructor(
    private config: RestServerConfig,
    context: RestContext
  ) {
    this.context = context
    this.app = Fastify({
      logger: false, // Use our structured logger instead
      requestIdLogLabel: 'reqId',
      disableRequestLogging: false,
      trustProxy: '127.0.0.1',
      bodyLimit: 1048576, // 1MB max request body size
      connectionTimeout: 30000, // 30 second connection timeout
      keepAliveTimeout: 65000, // 65 seconds (longer than typical load balancers)
      ajv: {
        customOptions: {
          coerceTypes: true, // Enable type coercion for query params (string "true" -> boolean true)
        },
      },
    })

    // Initialize rate limiter if enabled
    if (config.rateLimit.enabled) {
      this.rateLimiter = new RateLimiterService({
        tokensPerSecond: config.rateLimit.requestsPerSecond,
        maxTokens: config.rateLimit.maxBurst,
        costPerRequest: 1,
      })
      logger.info({ config: config.rateLimit }, 'REST rate limiting enabled')
    }

    this.setupCorePlugins()
    this.setupSecurityHeaders()
    this.setupRateLimiting()
    this.setupRequestLogging()
    this.setupCaching()
    this.setupErrorHandling()

    // Setup routes asynchronously - must complete before Swagger can generate spec
    // Register swagger FIRST so routes can be documented as they're added
    this.routesReady = this.setupSwaggerPlugin().then(() => this.setupRoutes()).then(() => this.setupSwaggerRoutes())
  }

  /**
   * Setup core Fastify plugins (CORS, etc.)
   * Called during construction before routes are registered
   */
  private setupCorePlugins(): void {
    // CORS
    this.app.register(cors, {
      origin: this.config.corsOrigins === '*' ? '*' : this.config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Cashu'],
      exposedHeaders: ['WWW-Authenticate', 'X-Cashu', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      credentials: this.config.corsOrigins !== '*',
    })

    logger.info('Core plugins registered')
  }

  /**
   * Setup OpenAPI plugin (via @fastify/swagger)
   * Must be called BEFORE routes are registered so it can introspect them
   */
  private async setupSwaggerPlugin(): Promise<void> {
    if (!this.config.enableSwagger) {
      return
    }

    // Determine server URL - use apiBaseUrl if provided, otherwise construct from host:port
    const serverUrl = this.config.apiBaseUrl || `http://${this.config.host}:${this.config.port}`
    const serverDescription = this.config.apiBaseUrl
      ? (process.env.NODE_ENV === 'production' ? 'Production API' : 'API Server')
      : 'Development server'

    // Load pricing entries for OpenAPI documentation
    let paidEntries: PricingEntry[] = []
    const routePriceMap = new Map<string, PricingEntry>()
    const basePath = process.env.PRICING_YAML
    if (basePath) {
      try {
        const entries = loadPricing(basePath, process.env.REST_PRICING_YAML)
        paidEntries = entries.filter(e => e.amount > 0)
        for (const e of paidEntries) {
          const route = NAME_TO_ROUTE[e.name] ?? `/${e.name}`
          routePriceMap.set(route, e)
          this.paidRoutePaths.add(route)
        }
        logger.info({ paidRoutes: paidEntries.length }, 'Loaded pricing for OpenAPI documentation')
      } catch (err) {
        logger.warn({ err }, 'Failed to load pricing for OpenAPI documentation, skipping 402 schemas')
      }
    }

    const swaggerOpts: any = {
      openapi: {
        info: {
          title: 'nostr.watch API',
          description: 'HTTP REST interface to relay state aggregation',
          version: process.env.npm_package_version || '0.1.0',
        },
        servers: [
          {
            url: serverUrl,
            description: serverDescription,
          },
        ],
        tags: [
          { name: 'health', description: 'Health check endpoints' },
          { name: 'relays', description: 'Relay state queries' },
          { name: 'monitors', description: 'Monitor information' },
          // DISABLED: Policy routes
          // { name: 'policy', description: 'Policy management' },
          // DISABLED: Subscription system
          // { name: 'subscriptions', description: 'Relay state subscriptions' },
        ],
      },
    }

    // Add pricing metadata and security schemes when paid routes exist
    if (paidEntries.length > 0) {
      swaggerOpts.openapi.info['x-pricing'] = {
        currency: 'sats',
        methods: ['L402', 'X-Cashu'],
        endpoints: paidEntries.map(e => ({
          path: NAME_TO_ROUTE[e.name] ?? `/${e.name}`,
          amount: e.amount,
          unit: e.currencyUnit,
          description: e.description,
        })),
      }
      swaggerOpts.openapi.components = {
        securitySchemes: {
          L402: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'L402 macaroon:preimage authentication. Format: L402 <macaroon>:<preimage>',
          },
          'X-Cashu': {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'Cashu token payment. Format: Cashu <base64-token>',
          },
        },
      }
    }

    await this.app.register(swagger, swaggerOpts)

    // Inject 402 response schemas into paid routes via onRoute hook
    if (routePriceMap.size > 0) {
      const payment402Response = {
        description: 'Payment Required',
        content: {
          'application/json': {
            schema: {
              type: 'object' as const,
              properties: {
                error: { type: 'string' as const, example: 'Payment Required' },
              },
            },
          },
        },
        headers: {
          'WWW-Authenticate': {
            schema: { type: 'string' as const },
            description: 'L402 challenge: L402 macaroon="<macaroon>", invoice="<bolt11>"',
          },
          'X-Cashu': {
            schema: { type: 'string' as const },
            description: 'Base64-encoded Cashu payment request with mint URL, amount, and P2PK pubkey',
          },
        },
      }

      this.app.addHook('onRoute', (routeOptions) => {
        const entry = routePriceMap.get(routeOptions.url)
        if (!entry) return

        if (!routeOptions.schema) routeOptions.schema = {};
        if (!(routeOptions.schema as any).response) (routeOptions.schema as any).response = {};

        ((routeOptions.schema as any).response as Record<number, any>)[402] = {
          ...payment402Response,
          description: `Payment Required — ${entry.amount} ${entry.currencyUnit}. ${entry.description}`,
        }
      })

      logger.info({ routes: Array.from(routePriceMap.keys()) }, '402 response schemas will be injected into paid routes')
    }

    logger.info('OpenAPI plugin registered')
  }

  /**
   * Setup OpenAPI documentation routes (Scalar UI + JSON/YAML endpoints)
   * Must be called AFTER both OpenAPI plugin and API routes are registered
   */
  private setupSwaggerRoutes(): void {
    if (!this.config.enableSwagger) {
      return
    }

    // Expose full OpenAPI JSON spec at /openapi.json
    this.app.get('/openapi.json', async () => {
      return this.app.swagger()
    })

    // Expose payable-only OpenAPI spec at /openapi.payable.json
    this.app.get('/openapi.payable.json', async () => {
      const full = this.app.swagger() as any
      const filtered: any = {
        ...full,
        paths: {},
      }
      // Only include paths that have a paid route
      for (const [path, methods] of Object.entries(full.paths || {})) {
        if (this.paidRoutePaths.has(path)) {
          filtered.paths[path] = methods
        }
      }
      return filtered
    })

    // Register Scalar UI at root path /
    this.app.get('/', async (_request, reply) => {
      // Use relative URL (without leading slash) so it works behind reverse proxy
      // When served at /v2/, this will resolve to /v2/openapi.json
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>nostr.watch API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script
    id="api-reference"
    data-url="./openapi.json"
    data-configuration='${JSON.stringify({
      theme: 'default',
    })}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`
      return reply.type('text/html').send(html)
    })

    logger.info('OpenAPI documentation routes registered')
  }

  /**
   * Setup security headers
   */
  private setupSecurityHeaders(): void {
    this.app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      // Prevent MIME type sniffing
      reply.header('X-Content-Type-Options', 'nosniff')

      // Prevent clickjacking
      reply.header('X-Frame-Options', 'DENY')

      // Enable XSS protection (legacy browsers)
      reply.header('X-XSS-Protection', '1; mode=block')

      // Referrer policy
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')

      // Content Security Policy
      // Relaxed CSP for API docs at root, strict for API endpoints
      const isDocsRoute = request.url === '/' || request.url === '/openapi.json' || request.url === '/openapi.payable.json'
      if (isDocsRoute && this.config.enableSwagger) {
        // Allow Scalar API docs to load all required resources
        reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net https://fonts.scalar.com; connect-src 'self'; frame-ancestors 'none'")
      } else {
        // Strict CSP for API endpoints
        reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
      }

      // HSTS - Force HTTPS for 2 years (only if request is via HTTPS)
      // Check if request is via HTTPS (either directly or via proxy)
      const isHttps = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https'
      if (isHttps) {
        reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
      }

      return payload
    })

    logger.info('Security headers configured')
  }

  /**
   * Get rate limit cost for a route
   */
  private getRouteCost(path: string, method: string): number {
    // GET requests have lower costs
    if (method === 'GET') {
      // Expensive query operations
      if (path.includes('/relays/compare')) return 5
      if (path.includes('/relays/search')) return 3
      if (path.includes('/monitors/analytics')) return 2

      // Standard queries
      return 1
    }

    // POST/PUT/DELETE have higher costs
    if (method === 'POST' || method === 'PUT') {
      // DISABLED: Subscription system
      // if (path.includes('/subscriptions')) return 2 // Subscription creation
      return 2
    }

    if (method === 'DELETE') {
      return 2
    }

    return 1 // Default cost
  }

  /**
   * Setup rate limiting preHandler
   */
  private setupRateLimiting(): void {
    if (!this.rateLimiter) return

    this.app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      // DISABLED: Subscription system
      // if (request.url.startsWith('/subscriptions/events')) {
      //   return
      // }

      // Extract client IP (trust proxy headers)
      const clientIp = request.ip || request.socket.remoteAddress || 'unknown'
      const key = `ip:${clientIp}`

      // Determine cost based on route
      const cost = this.getRouteCost(request.url, request.method)

      // Check rate limit with cost
      const allowed = this.rateLimiter!.checkLimit(key, cost)

      if (!allowed) {
        // Calculate retry-after (seconds until tokens refill)
        const tokensPerSecond = this.config.rateLimit.requestsPerSecond
        const retryAfter = Math.ceil(1 / tokensPerSecond)

        reply.header('Retry-After', retryAfter.toString())
        reply.header('X-RateLimit-Limit', this.config.rateLimit.maxBurst.toString())
        reply.header('X-RateLimit-Remaining', '0')

        return reply.status(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          },
        })
      }

      // Add rate limit headers
      const remaining = Math.floor(this.rateLimiter!.getRemainingTokens(key))
      reply.header('X-RateLimit-Limit', this.config.rateLimit.maxBurst.toString())
      reply.header('X-RateLimit-Remaining', remaining.toString())
    })

    logger.info('Rate limiting preHandler registered')
  }

  /**
   * Setup request logging onResponse hook
   */
  private setupRequestLogging(): void {
    this.app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const latency = (reply as any).getResponseTime?.() ?? reply.elapsedTime ?? 0
      const clientIp = request.ip || request.socket.remoteAddress || 'unknown'
      const userAgent = request.headers['user-agent'] || 'unknown'

      logger.info({
        method: request.method,
        path: request.url,
        status: reply.statusCode,
        latency: Math.round(latency * 100) / 100, // Round to 2 decimals
        clientIp,
        userAgent,
        reqId: request.id,
      }, 'REST request completed')
    })

    logger.info('Request logging onResponse hook registered')
  }

  /**
   * Setup ETag and Cache-Control headers for cacheable endpoints
   */
  private setupCaching(): void {
    this.app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      // Only cache GET requests
      if (request.method !== 'GET') return payload

      // Skip if already sent a status other than 200
      if (reply.statusCode !== 200) return payload

      // Skip if payload is null or undefined
      if (payload == null) return payload

      // Generate ETag from payload
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
      const etag = generateETag(body)

      // Check If-None-Match
      const ifNoneMatch = request.headers['if-none-match']
      if (etagMatches(etag, ifNoneMatch)) {
        // Return 304 Not Modified
        reply.code(304)
        reply.header('ETag', etag)
        reply.header('Cache-Control', 'private, max-age=30')
        return '' // Empty body for 304
      }

      // Set caching headers
      reply.header('ETag', etag)
      reply.header('Cache-Control', 'private, max-age=30')

      return payload
    })

    logger.info('ETag and Cache-Control headers enabled')
  }

  /**
   * Setup routes
   */
  private async setupRoutes(): Promise<void> {
    // Health check handler (shared by GET and POST)
    const healthPingHandler = async (_request: any, _reply: any) => {
      const stats = this.context.core.stats.get()
      const relayCount = this.context.getRelayCount()
      this.context.getMetricsSnapshot()
      this.context.queryCache.getStats()

      // Determine health status based on relay connectivity
      // Only consider transport relays when CVM is enabled
      let status: 'ok' | 'degraded' | 'error'
      const transportOk = !this.context.cvmEnabled || relayCount.transport > 0
      const ingestionOk = relayCount.ingestion > 0
      if (!transportOk && !ingestionOk) {
        status = 'error'
      } else if (!transportOk || !ingestionOk) {
        status = 'degraded'
      } else {
        status = 'ok'
      }

      return {
        status,
        version: process.env.npm_package_version || '0.1.0',
        uptime: this.context.getUptime(),
        relayCount,
        observationCount: stats.observations.count,
        timestamp: Date.now(),
        ready: this.context.getReady(),
      }
    }

    const healthPingSchema = {
      tags: ['health'],
      description: 'Health check with system metrics',
      response: {
        200: schemas.health.ping,
      },
    }

    // Health check - GET
    this.app.get('/health/ping', { schema: healthPingSchema }, healthPingHandler)

    // Health check - POST (for monitoring tools that use POST)
    this.app.post('/health/ping', { schema: healthPingSchema }, healthPingHandler)

    // Apply payments pre-handler globally (pricing.yaml controls which routes are paid)
    const paymentsPreHandler = await getPaymentsPreHandler()
    if (paymentsPreHandler) {
      this.app.addHook('preHandler', paymentsPreHandler)
    }

    // Register route modules
    await registerRelayRoutes(this.app, this.context)
    await registerMonitorRoutes(this.app, this.context)
    // DISABLED: Policy routes
    // registerPolicyRoutes(this.app, this.context)
    // DISABLED: Subscription routes
    // registerSubscriptionRoutes(this.app, this.context)
    await registerPaymentsHealthRoutes(this.app, this.context)
    // DISABLED: Metrics routes
    // await registerMetricsRoutes(this.app, this.context)

    logger.info('All routes registered')
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    this.app.setErrorHandler((error: any, request, reply) => {
      logger.error({
        err: error,
        method: request.method,
        url: request.url,
        reqId: request.id,
      }, 'Request error')

      // Validation errors
      if (error.validation) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
          },
        })
      }

      // Determine status code
      const statusCode = error.statusCode || 500

      // For 5xx errors, don't expose internal error details in production
      if (statusCode >= 500) {
        return reply.status(statusCode).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
          },
        })
      }

      // For 4xx errors, provide user-friendly messages
      return reply.status(statusCode).send({
        error: {
          code: error.code || 'REQUEST_ERROR',
          message: error.message || 'Request could not be processed',
        },
      })
    })

    // 404 handler
    this.app.setNotFoundHandler((_request, reply) => {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
        },
      })
    })
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Wait for routes and swagger to be ready (both set up in constructor)
      await this.routesReady
      logger.info('Routes and API documentation ready')

      // DISABLED: Subscription system
      // this.context.sseDelivery.start()

      await this.app.listen({
        host: this.config.host,
        port: this.config.port,
      })

      logger.info({
        host: this.config.host,
        port: this.config.port,
        swagger: this.config.enableSwagger,
      }, 'REST server started')

      if (this.config.enableSwagger) {
        logger.info(`API docs available at http://${this.config.host}:${this.config.port}/`)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to start REST server')
      throw err
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      // DISABLED: Subscription system
      // this.context.sseDelivery.stop()

      this.rateLimiter?.dispose()
      await this.app.close()
      logger.info('REST server stopped')
    } catch (err) {
      logger.error({ err }, 'Error stopping REST server')
      throw err
    }
  }

  /**
   * Get the Fastify instance (for testing)
   */
  getApp(): FastifyInstance {
    return this.app
  }
}
