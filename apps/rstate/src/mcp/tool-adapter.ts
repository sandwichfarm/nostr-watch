/**
 * MCP Tool Adapter
 *
 * Bridges CVM's tool format to MCP's tools/list + tools/call pattern
 * Preserves security, caching, and metrics wrappers
 */

import type { Server } from '@contextvm/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@contextvm/sdk/types.js'
import type { SecurityService } from '../services/security.js'
import type { QueryCache } from '../services/cache.js'
import type { MetricsService } from '../services/metrics.js'
import { getLogger } from '../utils/logger.js'
import { validateOutput } from '../utils/schema-validator.js'

const logger = getLogger().child({ module: 'tool-adapter' })

// Feature flags for structured outputs
const STRUCTURED_CONTENT_ENABLED = process.env.CVM_STRUCTURED_CONTENT === 'true'
const EXPOSE_TOOL_SCHEMAS = process.env.CVM_EXPOSE_TOOL_SCHEMAS === 'true'
// Max size (in bytes/characters) for the text content we embed in MCP replies.
// Many transports (including some Nostr relays) enforce event content limits around ~100KB.
// Default to 100_000 and allow override via env.
const MAX_TEXT_RESPONSE_BYTES = (() => {
  const raw = process.env.CVM_MAX_TEXT_RESPONSE_BYTES
  const n = raw ? Number(raw) : 100_000
  return Number.isFinite(n) && n > 0 ? n : 100_000
})()

/**
 * CVM Tool definition (original format)
 */
export interface CVMTool {
  name: string
  description: string
  inputSchema: Record<string, any>
  outputSchema?: Record<string, any>
  handler: (params: any) => Promise<any>
}

/**
 * Transport context for extracting client information
 */
export interface TransportContext {
  getClientPubkey: () => string | undefined
}

/**
 * Wrapper context for security/caching/metrics
 */
export interface WrapperContext {
  security: SecurityService
  queryCache?: QueryCache  // Optional: core has its own internal cache
  metrics: MetricsService
  transport: TransportContext
}

/**
 * Cache configuration for a tool
 */
export interface CacheConfig {
  enabled: boolean
  cacheKeyFn?: (params: any) => string
  ttlSeconds?: number
}

/**
 * Tool registry that manages CVM tools and MCP handlers
 */
export class ToolRegistry {
  private tools: Map<string, CVMTool> = new Map()
  private cacheConfigs: Map<string, CacheConfig> = new Map()
  private currentClientPubkey?: string

  constructor(
    private wrapperContext: WrapperContext
  ) {}

  /**
   * Set the current client pubkey for the active request
   * This should be called at the start of each request and cleared after
   */
  setCurrentClientPubkey(pubkey: string | undefined): void {
    this.currentClientPubkey = pubkey
  }

  /**
   * Get the current client pubkey
   */
  getCurrentClientPubkey(): string | undefined {
    return this.currentClientPubkey
  }

  /**
   * Register a tool with optional caching
   */
  registerTool(tool: CVMTool, cacheConfig?: CacheConfig): void {
    this.tools.set(tool.name, tool)
    if (cacheConfig) {
      this.cacheConfigs.set(tool.name, cacheConfig)
    }
    logger.debug({ tool: tool.name }, 'Tool registered')
  }

  /**
   * Get all registered tools
   */
  getAllTools(): CVMTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tool metadata including schema information
   */
  getToolMetadata(name: string): {
    name: string
    description: string
    inputSchema: Record<string, any>
    outputSchema?: Record<string, any>
  } | undefined {
    const tool = this.tools.get(name)
    if (!tool) return undefined

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }
  }

  /**
   * Execute a tool with full wrapper pipeline
   */
  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }

    const startTime = Date.now()
    const clientPubkey = this.currentClientPubkey

    try {
      // Security check
      const authResult = this.wrapperContext.security.authorize(
        clientPubkey,
        name,
        params
      )

      if (!authResult.allowed) {
        logger.warn({
          tool: name,
          clientPubkey: clientPubkey?.slice(0, 8),
          reason: authResult.reason,
        }, 'Tool access denied')

        throw new Error(authResult.reason || 'Access denied')
      }

      // Use shaped parameters (validated and bounded)
      const shapedParams = authResult.shaped || params

      // Try cache if enabled
      const cacheConfig = this.cacheConfigs.get(name)
      if (cacheConfig?.enabled && cacheConfig.cacheKeyFn && this.wrapperContext.queryCache) {
        const cacheKey = cacheConfig.cacheKeyFn(shapedParams)
        const cached = this.wrapperContext.queryCache.get(cacheKey)

        if (cached !== undefined) {
          const latency = Date.now() - startTime
          this.wrapperContext.metrics.recordLatency(name, latency)

          logger.debug({
            tool: name,
            latency,
            cacheHit: true,
          }, 'Tool call (cached)')

          return cached
        }
      }

      // Execute tool handler
      const result = await tool.handler(shapedParams)

      // Store in cache if enabled
      if (cacheConfig?.enabled && cacheConfig.cacheKeyFn && this.wrapperContext.queryCache) {
        const cacheKey = cacheConfig.cacheKeyFn(shapedParams)
        this.wrapperContext.queryCache.set(cacheKey, result, cacheConfig.ttlSeconds)
      }

      // Record success metrics
      const latency = Date.now() - startTime
      this.wrapperContext.metrics.recordLatency(name, latency)

      logger.debug({
        tool: name,
        latency,
        cacheHit: false,
        clientPubkey: clientPubkey?.slice(0, 8),
      }, 'Tool call succeeded')

      return result
    } catch (err: any) {
      // Record failure metrics
      const latency = Date.now() - startTime
      this.wrapperContext.metrics.recordLatency(name, latency)

      logger.error({
        tool: name,
        latency,
        clientPubkey: clientPubkey?.slice(0, 8),
        error: err.message,
      }, 'Tool call failed')

      throw err
    }
  }
}

/**
 * Register MCP handlers for tools/list and tools/call
 */
export function registerToolset(
  mcpServer: Server,
  registry: ToolRegistry
): void {
  // Handle tools/list - returns all registered tools
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = registry.getAllTools()

    return {
      tools: tools.map(tool => {
        const toolMetadata: any = {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }

        // Optionally expose output schema when flag is enabled
        if (EXPOSE_TOOL_SCHEMAS && tool.outputSchema) {
          toolMetadata.xOutputSchema = tool.outputSchema
        }

        return toolMetadata
      }),
    }
  })

  // Handle tools/call - executes a specific tool
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params

    try {
      // Extract client pubkey from sessionId (set by NostrServerTransport)
      const clientPubkey = extra.sessionId

      // Set client pubkey in transport context for this request
      registry.setCurrentClientPubkey(clientPubkey)

      const result = await registry.executeTool(name, args || {})

      // Get tool metadata to check for output schema
      const toolMetadata = registry.getToolMetadata(name)

      // Validate output if schema is present
      if (toolMetadata?.outputSchema) {
        const validation = validateOutput(toolMetadata.outputSchema, result)

        if (!validation.valid) {
          // Clear client pubkey
          registry.setCurrentClientPubkey(undefined)

          // Log validation failure
          logger.error({
            tool: name,
            clientPubkey: clientPubkey?.slice(0, 8),
            validationErrors: validation.errors,
          }, 'Output validation failed')

          // Return validation error
          const errorPayload = {
            error: 'Output validation failed',
            tool: name,
            validationErrors: validation.errors,
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(errorPayload, null, 2),
              },
            ],
            isError: true,
          }
        }
      }

      // Clear client pubkey after request
      registry.setCurrentClientPubkey(undefined)

      // Serialize result to text (compact to reduce size)
      const textPayload = JSON.stringify(result)

      // Guard against oversized responses that can fail to deliver via transport
      if (textPayload.length > MAX_TEXT_RESPONSE_BYTES) {
        const errorPayload = {
          error: 'Response too large to deliver as text',
          tool: name,
          size: textPayload.length,
          maxBytes: MAX_TEXT_RESPONSE_BYTES,
          hint: 'Reduce limit or set compact: true',
        }

        logger.warn({
          tool: name,
          clientPubkey: clientPubkey?.slice(0, 8),
          size: textPayload.length,
          maxBytes: MAX_TEXT_RESPONSE_BYTES,
        }, 'Reply exceeds max text size; returning error hint')

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorPayload),
            },
          ],
          isError: true,
        }
      }

      // Build response
      const response: any = {
        content: [
          {
            type: 'text',
            text: textPayload,
          },
        ],
      }

      // Optionally include structured content for type-safe clients
      if (STRUCTURED_CONTENT_ENABLED) {
        response.structuredContent = result
      }

      return response
    } catch (err: any) {
      // Clear client pubkey on error too
      registry.setCurrentClientPubkey(undefined)

      // Normalize error message for any thrown value
      const errorMessage = (err && typeof err === 'object' && 'message' in err)
        ? String(err.message)
        : String(err)

      // Return MCP-style error
      const errorPayload = { error: errorMessage, tool: name }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorPayload, null, 2),
          },
        ],
        isError: true,
      }
    }
  })

  logger.info({ toolCount: registry.getAllTools().length }, 'MCP toolset registered')
}
