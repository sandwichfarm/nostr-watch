/**
 * CVM Server
 *
 * Manages the Nostr Server Transport and tool registration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { NostrServerTransport, PrivateKeySigner, EncryptionMode, withServerPayments, LnBolt11NwcPaymentProcessor } from '@contextvm/sdk'
import { loadPricedCapabilities } from './payments/cvm-pricing.js'
import { ResilientRelayPool } from './resilient-relay-pool.js'
import type { Config } from './config.js'
import { getLogger } from './utils/logger.js'
import { ToolRegistry, registerToolset } from './mcp/tool-adapter.js'
import { createHealthTool } from './tools/health.js'
import { initStateCore, type StateCore } from './core/index.js'
import { IngestionService } from './services/ingestion.js'
import { RestServer } from './rest/index.js'
// DISABLED: Subscription system (kept for later re-enabling)
// import { SSEDeliveryService } from './rest/sse-delivery.js'
// import { SubscriptionManager } from './services/subscription-manager.js'
// import { NotificationDeliveryService } from './services/notification-delivery.js'
import { RateLimiterService } from './services/rate-limiter.js'
import { SecurityService } from './services/security.js'
import { MetricsService } from './services/metrics.js'
import { QueryCache } from './services/cache.js'
import { EventPublisherService } from './services/event-publisher.js'
import { DEFAULT_QUERY_SHAPE } from './utils/validation.js'
import { getCacheConfig } from './tool-cache-config.js'
import { verifyCriticalSchemas } from './utils/startup-checks.js'
import {
  createRelaysListTool,
  createRelaysListDetailedTool,
  createRelaysListFullTool,
  createRelaysGetStateTool,
  createRelaysSearchTool,
  createRelaysSearchDetailedTool,
  createRelaysSearchFullTool,
  createRelaysNearbyTool,
  createRelaysNearbyDetailedTool,
  createRelaysNearbyFullTool,
  createRelaysBboxTool,
  createRelaysBboxDetailedTool,
  createRelaysBboxFullTool,
  createRelaysGetLabelsTool,
  createRelaysListLabelsTool,
  createRelaysByLabelTool,
  createRelaysByLabelDetailedTool,
  createRelaysByLabelFullTool,
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
// DISABLED: Subscription tools (kept for later re-enabling)
// import {
//   createRelaysSubscribeStateTool,
//   createRelaysUnsubscribeTool,
// } from './tools/subscriptions.js'

const logger = getLogger().child({ module: 'server' })

export class CVMServer {
  // CVM transport components (optional - only if CVM enabled)
  private mcpServer?: Server
  private transport?: NostrServerTransport
  private transportPool?: ResilientRelayPool
  private signer?: PrivateKeySigner
  private toolRegistry?: ToolRegistry
  // DISABLED: Subscription system
  // private notificationDelivery?: NotificationDeliveryService

  // Core components (always required)
  private ingestionPool: ResilientRelayPool
  private startTime: number = Date.now()

  // Core services
  private core: StateCore

  // Shared services
  private ingestionService: IngestionService
  // DISABLED: Subscription system
  // private subscriptionManager: SubscriptionManager
  private rateLimiter: RateLimiterService
  private security: SecurityService
  private metrics: MetricsService
  private queryCache: QueryCache

  // Event Publishing
  private eventPublisher?: EventPublisherService

  // REST API
  private restServer?: RestServer

  // Timers
  private aggregationTimer?: ReturnType<typeof setInterval>

  constructor(private config: Config) {
    logger.info('Initializing RelayVM server')

    // Initialize ingestion pool (always required)
    this.ingestionPool = new ResilientRelayPool(config.ingestRelays)

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
    // DISABLED: Subscription system
    // this.subscriptionManager = new SubscriptionManager()

    // Initialize CVM transport if enabled
    if (config.cvm?.enabled) {
      this.initializeCVMTransport(config.cvm)
    }

    // Initialize REST server if enabled
    if (config.rest.enabled) {
      this.initializeRESTServer()
    }

    // Initialize event publisher if enabled
    if (config.publishing?.enabled) {
      this.eventPublisher = new EventPublisherService(this.core, config.publishing)
    }

    logger.info({
      cvmEnabled: !!config.cvm?.enabled,
      restEnabled: config.rest.enabled,
      publishingEnabled: !!config.publishing?.enabled,
      ingestionRelays: config.ingestRelays.length,
    }, 'RelayVM server initialized')
  }

  /**
   * Initialize CVM transport and MCP server
   */
  private initializeCVMTransport(cvmConfig: NonNullable<Config['cvm']>): void {
    logger.info('Initializing CVM transport')

    // Create CVM relay pool and signer
    if (!cvmConfig.serverKey) {
      throw new Error('CVM_SERVER_NSEC is required but was empty — refusing to start with a random key')
    }
    this.transportPool = new ResilientRelayPool(cvmConfig.cvmRelays)
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
      relayHandler: this.transportPool.toRelayHandler(),
      encryptionMode: this.getEncryptionMode(cvmConfig.encryptionMode),
      serverInfo: {
        name: 'RelayVM',
        about: 'ContextVM server that aggregates NIP-66 relay intelligence and exposes it via MCP over Nostr. Service provided by nostr.watch',
      },
      isPublicServer: cvmConfig.allowedPubkeys.length === 0,
      allowedPublicKeys: cvmConfig.allowedPubkeys.length > 0 ? cvmConfig.allowedPubkeys : undefined,
    })

    // Wrap transport with CEP-8 payment gating if enabled
    if (process.env.CVM_PAYMENTS_ENABLED === 'true') {
      const nwcConnectionString = process.env.CVM_NWC_CONNECTION_STRING
      if (!nwcConnectionString) {
        throw new Error('CVM_PAYMENTS_ENABLED=true but CVM_NWC_CONNECTION_STRING is not set')
      }

      const nwcProcessor = new LnBolt11NwcPaymentProcessor({
        nwcConnectionString,
        relayHandler: this.transportPool!.toRelayHandler(),
      })

      const pricedCapabilities = loadPricedCapabilities()

      this.transport = withServerPayments(this.transport, {
        processors: [nwcProcessor],
        pricedCapabilities,
      })

      logger.info({ pricedTools: pricedCapabilities.length }, 'CVM payment gating enabled (CEP-8)')
    }

    // DISABLED: Subscription system
    // this.notificationDelivery = new NotificationDeliveryService(
    //   this.subscriptionManager,
    //   this.transport
    // )

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

    // DISABLED: Subscription system
    // const sseDelivery = new SSEDeliveryService(this.subscriptionManager)

    this.restServer = new RestServer(
      {
        host: this.config.rest.host,
        port: this.config.rest.port,
        apiBaseUrl: this.config.rest.apiBaseUrl,
        corsOrigins: this.config.rest.corsOrigins,
        enableSwagger: this.config.rest.enableSwagger,
        allowPolicyUpdate: this.config.rest.allowPolicyUpdate,
        rateLimit: this.config.rest.rateLimit,
      },
      {
        core: this.core,
        metrics: this.metrics,
        security: this.security,
        queryCache: this.queryCache,
        allowPolicyUpdate: this.config.rest.allowPolicyUpdate,
        getUptime: () => this.getUptime(),
        getRelayCount: () => this.getRelayCount(),
        getMetricsSnapshot: () => this.getMetricsSnapshot(),
        getReady: () => this.getReady(),
        cvmEnabled: !!this.config.cvm,
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
        cvmEnabled: true,
      }),
      { enabled: false }
    )

    // Relay tools (cached via tool-cache-config.ts)
    registry.registerTool(createRelaysListTool(toolsContext), getCacheConfig('relays/list'))
    registry.registerTool(createRelaysListDetailedTool(toolsContext), getCacheConfig('relays/list/detailed'))
    registry.registerTool(createRelaysListFullTool(toolsContext), getCacheConfig('relays/list/full'))
    registry.registerTool(createRelaysGetStateTool(toolsContext), getCacheConfig('relays/state'))
    registry.registerTool(createRelaysSearchTool(toolsContext), getCacheConfig('relays/search'))
    registry.registerTool(createRelaysSearchDetailedTool(toolsContext), getCacheConfig('relays/search/detailed'))
    registry.registerTool(createRelaysSearchFullTool(toolsContext), getCacheConfig('relays/search/full'))
    registry.registerTool(createRelaysNearbyTool(toolsContext), getCacheConfig('relays/nearby'))
    registry.registerTool(createRelaysNearbyDetailedTool(toolsContext), getCacheConfig('relays/nearby/detailed'))
    registry.registerTool(createRelaysNearbyFullTool(toolsContext), getCacheConfig('relays/nearby/full'))
    registry.registerTool(createRelaysBboxTool(toolsContext), getCacheConfig('relays/bbox'))
    registry.registerTool(createRelaysBboxDetailedTool(toolsContext), getCacheConfig('relays/bbox/detailed'))
    registry.registerTool(createRelaysBboxFullTool(toolsContext), getCacheConfig('relays/bbox/full'))
    registry.registerTool(createRelaysGetLabelsTool(toolsContext), getCacheConfig('relays/labels'))
    registry.registerTool(createRelaysListLabelsTool(toolsContext), getCacheConfig('relays/labels/list'))
    registry.registerTool(createRelaysByLabelTool(toolsContext), getCacheConfig('relays/by/label'))
    registry.registerTool(createRelaysByLabelDetailedTool(toolsContext), getCacheConfig('relays/by/label/detailed'))
    registry.registerTool(createRelaysByLabelFullTool(toolsContext), getCacheConfig('relays/by/label/full'))
    registry.registerTool(createRelaysBySoftwareTool(toolsContext), getCacheConfig('relays/by/software'))
    registry.registerTool(createRelaysByNetworkTool(toolsContext), getCacheConfig('relays/by/network'))
    registry.registerTool(createRelaysByNipTool(toolsContext), getCacheConfig('relays/by/nip'))
    registry.registerTool(createRelaysByCountryTool(toolsContext), getCacheConfig('relays/by/country'))
    registry.registerTool(createRelaysCompareTool(toolsContext), getCacheConfig('relays/compare'))

    // Availability tools (short TTL caching — TTL set in tool-cache-config.ts)
    registry.registerTool(createRelaysOnlineTool(toolsContext), getCacheConfig('relays/online'))
    registry.registerTool(createRelaysOfflineTool(toolsContext), getCacheConfig('relays/offline'))
    registry.registerTool(createRelaysDeadTool(toolsContext), getCacheConfig('relays/dead'))

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

    // DISABLED: Subscription tools (kept for later re-enabling)
    // registry.registerTool(
    //   createRelaysSubscribeStateTool({
    //     subscriptionManager: this.subscriptionManager,
    //     getClientPubkey: () => this.transportContext!.getClientPubkey(),
    //     requireAuth: ((): boolean => {
    //       const env = process.env.CVM_SUBS_REQUIRE_AUTH
    //       if (env !== undefined) {
    //         const v = env.toLowerCase()
    //         return !(v === 'false' || v === '0' || v === 'off')
    //       }
    //       return this.config.cvm?.auth.enabled ?? false
    //     })(),
    //   }),
    //   { enabled: false }
    // )
    // registry.registerTool(
    //   createRelaysUnsubscribeTool({
    //     subscriptionManager: this.subscriptionManager,
    //     getClientPubkey: () => this.transportContext!.getClientPubkey(),
    //   }),
    //   { enabled: false }
    // )

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

        // DISABLED: Subscription system
        // this.notificationDelivery?.start()
        // logger.info('CVM notification delivery started')
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

      // Start event publisher if enabled
      if (this.eventPublisher) {
        await this.eventPublisher.start()
        logger.info('Event publisher started')
      }

      logger.info({
        cvmEnabled: !!this.transport,
        restEnabled: !!this.restServer,
        publishingEnabled: !!this.eventPublisher,
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

      // DISABLED: Subscription system
      // if (this.notificationDelivery) {
      //   this.notificationDelivery.stop()
      //   logger.info('CVM notification delivery stopped')
      // }

      // Stop ingestion (always running)
      await this.ingestionService.stop()

      // Stop event publisher if running
      if (this.eventPublisher) {
        await this.eventPublisher.stop()
        logger.info('Event publisher stopped')
      }

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

      // Disconnect relay pools
      await this.ingestionPool.disconnect()
      if (this.transportPool) {
        await this.transportPool.disconnect()
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

        // Publish events after aggregation
        if (this.eventPublisher) {
          const changedRelays = this.core.getChangedRelays()
          this.eventPublisher.onAggregationComplete(changedRelays).catch(err =>
            logger.error({ err }, 'Error publishing events')
          )
        }

        // DISABLED: Subscription system
        // const allStates = this.core.query.relays.getAll()
        // for (const state of allStates) {
        //   this.subscriptionManager.processStateChange(state)
        // }
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
      null, // DISABLED: subscriptionManager.getStats()
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
