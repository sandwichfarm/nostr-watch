/**
 * CVM Server
 *
 * Manages the Nostr Server Transport and tool registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { NostrServerTransport, ApplesauceRelayPool, PrivateKeySigner, EncryptionMode } from '@contextvm/sdk'
import { RelayPoolAdapter } from './sdk-adapters.js'
import type { Config } from './config.js'
import { getLogger } from './utils/logger.js'
import { ToolRegistry, registerToolset, type TransportContext } from './mcp/tool-adapter.js'
import { createHealthTool } from './tools/health.js'
import { initStateCore, type StateCore } from './core/index.js'
import { IngestionService } from './services/ingestion.js'
import { RestServer } from './rest/index.js'
import { SSEDeliveryService } from './rest/sse-delivery.js'
import { SubscriptionManager } from './services/subscription-manager.js'
import { NotificationDeliveryService } from './services/notification-delivery.js'
import { RateLimiterService } from './services/rate-limiter.js'
import { SecurityService } from './services/security.js'
import { MetricsService } from './services/metrics.js'
import { QueryCache } from './services/cache.js'
import { DEFAULT_QUERY_SHAPE } from './utils/validation.js'
import { verifyCriticalSchemas } from './utils/startup-checks.js'
import {
  createRelaysListTool,
  createRelaysGetStateTool,
  createRelaysSearchTool,
  createRelaysNearbyTool,
  createRelaysBboxTool,
  createRelaysGetLabelsTool,
  createRelaysListLabelsTool,
  createRelaysByLabelTool,
  createRelaysBySoftwareTool,
  createRelaysByNetworkTool,
  createRelaysByNipTool,
  createRelaysByCountryTool,
  createRelaysCompareTool,
  createRelaysOnlineTool,
  createRelaysOfflineTool,
  createRelaysDeadTool,
} from './tools/relays.js'
import { createMonitorsGetTool, createMonitorsListTool } from './tools/monitors.js'
import { createPolicyGetTool, createPolicySetTool } from './tools/policy.js'
import {
  createRelaysSubscribeStateTool,
  createRelaysUnsubscribeTool,
} from './tools/subscriptions.js'

const logger = getLogger().child({ module: 'server' })

export class CVMServer {
  // CVM transport components (optional - only if CVM enabled)
  private mcpServer?: Server
  private transport?: NostrServerTransport
  private transportPool?: ApplesauceRelayPool
  private signer?: PrivateKeySigner
  private toolRegistry?: ToolRegistry
  private transportContext?: TransportContext
  private notificationDelivery?: NotificationDeliveryService

  // Core components (always required)
  private ingestionPool: RelayPoolAdapter
  private startTime: number = Date.now()

  // Core services
  private core: StateCore

  // Shared services
  private ingestionService: IngestionService
  private subscriptionManager: SubscriptionManager
  private rateLimiter: RateLimiterService
  private security: SecurityService
  private metrics: MetricsService
  private queryCache: QueryCache

  // REST API
  private restServer?: RestServer

  // Timers
  private aggregationTimer?: ReturnType<typeof setInterval>

  constructor(private config: Config) {
    logger.info('Initializing RelayVM server')

    // Initialize ingestion pool (always required)
    this.ingestionPool = new RelayPoolAdapter(new ApplesauceRelayPool(config.ingestRelays))

    // Initialize State Core (transport-agnostic)
    this.core = initStateCore({
      aggregation: config.aggregation,
    })

    // Create shared services (transport-agnostic)
    this.rateLimiter = new RateLimiterService()
    this.metrics = new MetricsService()
    this.queryCache = new QueryCache(config.cache.ttlSeconds, config.cache.maxSize)
    this.security = new SecurityService(this.rateLimiter, {
      allowedPubkeys: config.cvm?.allowedPubkeys || [],
      queryShape: DEFAULT_QUERY_SHAPE,
      enableRateLimiting: true,
      enableAuth: config.cvm?.auth.enabled ?? false,
      allowAnyPubkey: config.cvm?.auth.allowAny || false,
    })
    this.ingestionService = new IngestionService(
      this.ingestionPool,
      this.core,
      24 * 3600,  // 24 hour historical window
      this.metrics  // Pass metrics for event recording
    )
    this.subscriptionManager = new SubscriptionManager()

    // Initialize CVM transport if enabled
    if (config.cvm?.enabled) {
      this.initializeCVMTransport(config.cvm)
    }

    // Initialize REST server if enabled
    if (config.rest.enabled) {
      this.initializeRESTServer()
    }

    logger.info({
      cvmEnabled: !!config.cvm?.enabled,
      restEnabled: config.rest.enabled,
      ingestionRelays: config.ingestRelays.length,
    }, 'RelayVM server initialized')
  }

  /**
   * Initialize CVM transport and MCP server
   */
  private initializeCVMTransport(cvmConfig: NonNullable<Config['cvm']>): void {
    logger.info('Initializing CVM transport')

    // Create CVM relay pool and signer
    this.transportPool = new ApplesauceRelayPool(cvmConfig.cvmRelays)
    this.signer = new PrivateKeySigner(cvmConfig.serverKey)

    // Create tool registry first (before transport context)
    this.toolRegistry = new ToolRegistry({
      security: this.security,
      queryCache: this.queryCache,
      metrics: this.metrics,
      transport: {
        getClientPubkey: () => this.toolRegistry!.getCurrentClientPubkey(),
      },
    })

    // Store transport context reference for subscription tools
    this.transportContext = {
      getClientPubkey: () => this.toolRegistry!.getCurrentClientPubkey(),
    }

    // Create MCP Server instance
    this.mcpServer = new Server(
      {
        name: 'RelayVM',
        version: process.env.npm_package_version || '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    // Create Nostr transport
    this.transport = new NostrServerTransport({
      signer: this.signer,
      relayHandler: this.transportPool,
      encryptionMode: this.getEncryptionMode(cvmConfig.encryptionMode),
      serverInfo: {
        name: 'RelayVM',
        about: 'ContextVM server that aggregates NIP-66 relay intelligence and exposes it via MCP over Nostr. Service provided by nostr.watch',
      },
      isPublicServer: cvmConfig.allowedPubkeys.length === 0,
      allowedPublicKeys: cvmConfig.allowedPubkeys.length > 0 ? cvmConfig.allowedPubkeys : undefined,
    })

    // Create notification delivery service
    this.notificationDelivery = new NotificationDeliveryService(
      this.subscriptionManager,
      this.transport
    )

    // Register tools
    verifyCriticalSchemas()
    this.registerTools()

    logger.info({
      transportRelays: cvmConfig.cvmRelays.length,
      encryptionMode: cvmConfig.encryptionMode,
    }, 'CVM transport initialized')
  }

  /**
   * Initialize REST server
   */
  private initializeRESTServer(): void {
    logger.info('Initializing REST server')

    // Create SSE delivery service for REST subscriptions
    const sseDelivery = new SSEDeliveryService(this.subscriptionManager)

    this.restServer = new RestServer(
      {
        host: this.config.rest.host,
        port: this.config.rest.port,
        corsOrigins: this.config.rest.corsOrigins,
        enableSwagger: this.config.rest.enableSwagger,
        allowPolicyUpdate: this.config.rest.allowPolicyUpdate,
        rateLimit: this.config.rest.rateLimit,
      },
      {
        core: this.core,
        metrics: this.metrics,
        security: this.security,
        subscriptionManager: this.subscriptionManager,
        sseDelivery,
        queryCache: this.queryCache,
        allowPolicyUpdate: this.config.rest.allowPolicyUpdate,
        getUptime: () => this.getUptime(),
        getRelayCount: () => this.getRelayCount(),
        getMetricsSnapshot: () => this.getMetricsSnapshot(),
        getReady: () => this.getReady(),
      }
    )

    logger.info('REST server initialized')
  }

  /**
   * Convert string encryption mode to enum
   */
  private getEncryptionMode(mode: string): EncryptionMode {
    switch (mode) {
      case 'REQUIRED':
        return EncryptionMode.REQUIRED
      case 'DISABLED':
        return EncryptionMode.DISABLED
      default:
        return EncryptionMode.OPTIONAL
    }
  }

  /**
   * Register all MCP tools via the adapter
   * Note: Only called from initializeCVMTransport(), so toolRegistry is guaranteed to be defined
   */
  private registerTools(): void {
    logger.debug('Registering MCP tools via adapter')

    // toolRegistry is guaranteed to be defined when this method is called
    const registry = this.toolRegistry!

    const toolsContext = {
      core: this.core,
    }

    // Handshake probe tool - minimal tool for testing MCP pipeline
    registry.registerTool(
      {
        name: 'handshake/ping',
        description: 'Minimal handshake probe to verify MCP pipeline is operational',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            timestamp: { type: 'number' },
            message: { type: 'string' },
          },
          required: ['success', 'timestamp', 'message'],
        },
        handler: async (): Promise<{ success: boolean; timestamp: number; message: string }> => {
          logger.debug('Handshake ping received')
          return {
            success: true,
            timestamp: Date.now(),
            message: 'MCP handshake successful',
          }
        },
      },
      { enabled: false }
    )

    // Health tool (no caching, always fresh)
    registry.registerTool(
      createHealthTool({
        getRelayCount: () => this.getRelayCount(),
        getObservationCount: () => this.core.stats.get().observations.count,
        getUptime: () => this.getUptime(),
        getReady: () => this.getReady(),
        metrics: this.metrics,
        getMetricsSnapshot: () => this.getMetricsSnapshot(),
        queryCache: this.queryCache,
      }),
      { enabled: false }
    )

    // Relay tools (cached)
    registry.registerTool(
      createRelaysListTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:list:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}` }
    )
    registry.registerTool(
      createRelaysGetStateTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:state:${p.relayUrl}` }
    )
    registry.registerTool(
      createRelaysSearchTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:search:${JSON.stringify(p)}` }
    )
    registry.registerTool(
      createRelaysNearbyTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `nearby:${p.lat}:${p.lon}:${p.radius || 100}` }
    )
    registry.registerTool(
      createRelaysBboxTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `bbox:${p.sw.lat}:${p.sw.lon}:${p.ne.lat}:${p.ne.lon}` }
    )
    registry.registerTool(
      createRelaysGetLabelsTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `labels:${p.relayUrl}:${p.namespace || 'all'}` }
    )
    registry.registerTool(
      createRelaysListLabelsTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `list-labels:${p.namespace || 'all'}` }
    )
    registry.registerTool(
      createRelaysByLabelTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:group:label:${p.namespace}:${p.value}` }
    )
    registry.registerTool(
      createRelaysBySoftwareTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:group:software${p.family ? ':' + p.family : ''}` }
    )
    registry.registerTool(
      createRelaysByNetworkTool(toolsContext),
      { enabled: true, cacheKeyFn: () => `relays:group:network` }
    )
    registry.registerTool(
      createRelaysByNipTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:group:nip${p.nip ? ':' + p.nip : ''}` }
    )
    registry.registerTool(
      createRelaysByCountryTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `relays:group:country${p.countryCode ? ':' + p.countryCode : ''}` }
    )
    registry.registerTool(
      createRelaysCompareTool(toolsContext),
      { enabled: true, cacheKeyFn: (p) => `compare:${p.relayUrls.sort().join(',')}` }
    )

    // Availability tools (short TTL caching)
    const availabilityTtl = 30 // seconds
    const filterHash = (filters: any) => (filters ? JSON.stringify(filters) : 'none')
    const defaultLookback = this.core.query.policy.get().lookbackSeconds
    registry.registerTool(
      createRelaysOnlineTool(toolsContext),
      { enabled: true, cacheKeyFn: (p: any) => `availability:online:${p.onlineWindowSeconds || defaultLookback}:${filterHash(p.filters)}`, ttlSeconds: availabilityTtl }
    )
    registry.registerTool(
      createRelaysOfflineTool(toolsContext),
      { enabled: true, cacheKeyFn: (p: any) => `availability:offline:${p.offlineSeenSeconds || 86400}:${p.offlineThresholdSeconds || 3600}:${filterHash(p.filters)}`, ttlSeconds: availabilityTtl }
    )
    registry.registerTool(
      createRelaysDeadTool(toolsContext),
      { enabled: true, cacheKeyFn: (p: any) => `availability:dead:${p.deadThresholdSeconds || 604800}:${filterHash(p.filters)}`, ttlSeconds: availabilityTtl }
    )

    // Monitor tools (cached)
    registry.registerTool(
      createMonitorsGetTool({ core: this.core }),
      { enabled: true, cacheKeyFn: (p) => `monitor:${p.pubkey}` }
    )
    registry.registerTool(
      createMonitorsListTool({ core: this.core }),
      { enabled: true, cacheKeyFn: (p) => `monitors:${p.limit || 100}:${p.offset || 0}` }
    )

    // Policy tools (no caching, requires auth)
    registry.registerTool(
      createPolicyGetTool({
        core: this.core,
        allowedPubkeys: this.config.cvm?.allowedPubkeys || [],
      }),
      { enabled: false }
    )
    registry.registerTool(
      createPolicySetTool({
        core: this.core,
        allowedPubkeys: this.config.cvm?.allowedPubkeys || [],
      }),
      { enabled: false }
    )

    // Subscription tools (no caching, stateful operations)
    registry.registerTool(
      createRelaysSubscribeStateTool({
        subscriptionManager: this.subscriptionManager,
        getClientPubkey: () => this.transportContext!.getClientPubkey(),
        requireAuth: ((): boolean => {
          const env = process.env.CVM_SUBS_REQUIRE_AUTH
          if (env !== undefined) {
            const v = env.toLowerCase()
            return !(v === 'false' || v === '0' || v === 'off')
          }
          return this.config.cvm?.auth.enabled ?? false
        })(),
      }),
      { enabled: false }
    )
    registry.registerTool(
      createRelaysUnsubscribeTool({
        subscriptionManager: this.subscriptionManager,
        getClientPubkey: () => this.transportContext!.getClientPubkey(),
      }),
      { enabled: false }
    )

    // Register MCP handlers (tools/list and tools/call)
    registerToolset(this.mcpServer!, registry)

    logger.info({ toolCount: registry.getAllTools().length }, 'MCP tools registered via adapter')
  }


  /**
   * Start the server
   */
  async start(): Promise<void> {
    logger.info('Starting RelayVM server')

    try {
      // Start CVM transport if enabled
      if (this.transport && this.mcpServer && this.signer) {
        const pubkey = await this.signer.getPublicKey()
        logger.info({
          serverPubkey: pubkey,
          transportRelays: this.config.cvm?.cvmRelays,
          encryptionMode: this.config.cvm?.encryptionMode,
          isPublicServer: (this.config.cvm?.allowedPubkeys.length || 0) === 0,
          allowedPubkeys: this.config.cvm?.allowedPubkeys,
          authEnabled: this.config.cvm?.auth.enabled,
          allowAnyPubkey: this.config.cvm?.auth.allowAny,
          toolCount: this.toolRegistry?.getAllTools().length || 0,
        }, 'CVM transport configuration')

        logger.info('Starting CVM transport...')
        const transportStartTime = Date.now()
        await this.transport.start()
        logger.info({ durationMs: Date.now() - transportStartTime }, 'CVM transport started')

        logger.info('Connecting MCP server to transport...')
        const connectStartTime = Date.now()
        await this.mcpServer.connect(this.transport)
        logger.info({ durationMs: Date.now() - connectStartTime }, 'MCP server connected to transport')

        // Start notification delivery (CVM-specific)
        this.notificationDelivery?.start()
        logger.info('CVM notification delivery started')
      }

      // Start ingestion (always required)
      await this.ingestionService.start()
      logger.info('Ingestion started')

      // Start periodic aggregation (always required)
      this.startAggregationTimer()

      // Start REST server if enabled
      if (this.restServer) {
        await this.restServer.start()
        logger.info('REST API started')
      }

      logger.info({
        cvmEnabled: !!this.transport,
        restEnabled: !!this.restServer,
        ingestRelays: this.config.ingestRelays.length,
      }, 'RelayVM server started successfully')
    } catch (err) {
      logger.error({ err }, 'Failed to start RelayVM server')
      throw err
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping RelayVM server')

    try {
      // Stop aggregation timer
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer)
        this.aggregationTimer = undefined
      }

      // Stop CVM notification delivery if running
      if (this.notificationDelivery) {
        this.notificationDelivery.stop()
        logger.info('CVM notification delivery stopped')
      }

      // Stop ingestion (always running)
      await this.ingestionService.stop()

      // Stop REST server if running
      if (this.restServer) {
        await this.restServer.stop()
        logger.info('REST API stopped')
      }

      // Close CVM transport if running
      if (this.mcpServer) {
        await this.mcpServer.close()
        logger.info('MCP server closed')
      }

      if (this.transport) {
        await this.transport.close()
        logger.info('CVM transport closed')
      }

      logger.info('RelayVM server stopped')
    } catch (err) {
      logger.error({ err }, 'Error stopping RelayVM server')
      throw err
    }
  }

  /**
   * Start periodic aggregation timer
   */
  private startAggregationTimer(): void {
    const intervalMs = 30 * 1000 // 30 seconds

    // Compute initial state
    const startTime = Date.now()
    this.core.computeAll()
    this.metrics.recordAggregation(Date.now() - startTime)
    this.ready = true

    // Set up periodic recomputation
    this.aggregationTimer = setInterval(() => {
      try {
        // Compute new states
        const aggStart = Date.now()
        this.core.computeAll()
        this.metrics.recordAggregation(Date.now() - aggStart)

        // Evict stale rate limit buckets
        this.security.evictStaleRateLimits()

        // Evict expired cache entries
        const evicted = this.queryCache.evictExpired()
        if (evicted > 0) {
          logger.debug({ evicted }, 'Expired cache entries evicted')
        }

        // Process state changes for subscriptions
        const allStates = this.core.query.relays.getAll()
        for (const state of allStates) {
          this.subscriptionManager.processStateChange(state)
        }
      } catch (err) {
        logger.error({ err }, 'Error during periodic aggregation')
      }
    }, intervalMs)

    logger.info({ intervalMs }, 'Aggregation timer started')
  }

  /**
   * Get relay connection counts
   */
  private getRelayCount(): { transport: number; ingestion: number } {
    return {
      transport: this.config.cvm?.cvmRelays?.length ?? 0,
      ingestion: this.config.ingestRelays?.length ?? 0,
    }
  }

  /**
   * Get server uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }

  /**
   * Get metrics snapshot
   */
  private getMetricsSnapshot(): any {
    const coreStats = this.core.stats.get()
    return this.metrics.getSnapshot(
      this.ingestionService.getStats(),
      coreStats as any,
      { getRelayCount: () => this.core.query.relays.getAll().length },
      this.subscriptionManager.getStats(),
      this.core.query.monitors.getScores() as any,
      coreStats as any,
      this.security.getRateLimitStats()
    )
  }

  /** Get server readiness (first compute complete) */
  private getReady(): boolean { return this.ready }

  // Readiness flag (true after first computeAll completes)
  private ready: boolean = false
}
