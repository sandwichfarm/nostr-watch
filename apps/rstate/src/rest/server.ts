/**
 * REST API Server
 *
 * Provides HTTP REST interface to StateCore
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import apiReference from '@scalar/fastify-api-reference'
import type { StateCore } from '../core/index.js'
import type { MetricsService } from '../services/metrics.js'
import type { SecurityService } from '../services/security.js'
import type { SubscriptionManager } from '../services/subscription-manager.js'
import { RateLimiterService } from '../services/rate-limiter.js'
import { SSEDeliveryService } from './sse-delivery.js'
import { getLogger } from '../utils/logger.js'
import { registerRelayRoutes } from './routes/relays.js'
import { registerMonitorRoutes } from './routes/monitors.js'
import { registerPolicyRoutes } from './routes/policy.js'
import { registerSubscriptionRoutes } from './routes/subscriptions.js'
import { registerMetricsRoutes } from './routes/metrics.js'
import { registerPaymentsHealthRoutes } from './routes/payments-health.js'
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
  subscriptionManager: SubscriptionManager
  sseDelivery: SSEDeliveryService
  queryCache: import('../services/cache.js').QueryCache
  allowPolicyUpdate: boolean
  getUptime: () => number
  getRelayCount: () => { transport: number; ingestion: number }
  getMetricsSnapshot: () => any
  getReady: () => boolean
}

/**
 * REST API Server
 */
export class RestServer {
  private app: FastifyInstance
  private context: RestContext
  private rateLimiter?: RateLimiterService
  private routesReady: Promise<void>

  constructor(
    private config: RestServerConfig,
    context: RestContext
  ) {
    this.context = context
    this.app = Fastify({
      logger: false, // Use our structured logger instead
      requestIdLogLabel: 'reqId',
      disableRequestLogging: false,
      trustProxy: true,
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
      credentials: true,
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

    await this.app.register(swagger, {
      openapi: {
        info: {
          title: 'RelayVM REST API',
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
          { name: 'policy', description: 'Policy management' },
          { name: 'subscriptions', description: 'Relay state subscriptions' },
        ],
      },
    })

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

    // Expose OpenAPI JSON spec at /openapi.json
    this.app.get('/openapi.json', async () => {
      return this.app.swagger()
    })

    // Expose OpenAPI YAML spec at /openapi.yaml
    this.app.get('/openapi.yaml', async () => {
      return this.app.swagger({ yaml: true })
    })

    // Register Scalar UI at root path /
    this.app.get('/', async (request, reply) => {
      // Generate Scalar HTML that loads the spec from /openapi.json
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>RelayVM API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script
    id="api-reference"
    data-url="/openapi.json"
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
      const isDocsRoute = request.url === '/' || request.url === '/openapi.json' || request.url === '/openapi.yaml'
      if (isDocsRoute && this.config.enableSwagger) {
        // Allow Scalar API docs to load scripts from CDN
        reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self' https://cdn.jsdelivr.net; frame-ancestors 'none'")
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
      if (path.includes('/policy')) return 10 // Policy changes are expensive
      if (path.includes('/subscriptions')) return 2 // Subscription creation
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
      // Skip rate limiting for SSE event stream (long-lived connection with keepalive pings)
      if (request.url.startsWith('/subscriptions/events')) {
        return
      }

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
      const latency = reply.getResponseTime()
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
      const metricsSnapshot = this.context.getMetricsSnapshot()
      const cacheStats = this.context.queryCache.getStats()

      // Determine health status based on relay connectivity
      let status: 'ok' | 'degraded' | 'error'
      const totalRelays = relayCount.transport + relayCount.ingestion
      if (totalRelays === 0) {
        status = 'error' // No relays connected
      } else if (relayCount.transport === 0 || relayCount.ingestion === 0) {
        status = 'degraded' // Missing transport or ingestion relays
      } else {
        status = 'ok' // All systems operational
      }

      return {
        status,
        version: process.env.npm_package_version || '0.1.0',
        uptime: this.context.getUptime(),
        relayCount,
        observationCount: stats.observations.count,
        timestamp: Date.now(),
        metrics: metricsSnapshot,
        ready: this.context.getReady(),
        cache: {
          ...cacheStats,
          hitRatePercent: Math.round(cacheStats.hitRate * 100 * 100) / 100, // Round to 2 decimals
        },
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

    // Register route modules
    await registerRelayRoutes(this.app, this.context)
    await registerMonitorRoutes(this.app, this.context)
    registerPolicyRoutes(this.app, this.context)
    // DISABLED: Subscription routes
    // registerSubscriptionRoutes(this.app, this.context)
    await registerPaymentsHealthRoutes(this.app, this.context)
    await registerMetricsRoutes(this.app, this.context)

    logger.info('All routes registered')
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    this.app.setErrorHandler((error, request, reply) => {
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
            details: error.validation,
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
    this.app.setNotFoundHandler((request, reply) => {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
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

      // Start SSE delivery service
      this.context.sseDelivery.start()

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
      // Stop SSE delivery service
      this.context.sseDelivery.stop()

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
