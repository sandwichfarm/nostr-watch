/**
 * Policy MCP Tools
 *
 * Provides access to aggregation policy configuration
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type {
  PolicyGetInput,
  PolicyGetOutput,
  PolicySetInput,
  PolicySetOutput,
} from '../types/tool-schemas.js'
import type { StateCore } from '../core/index.js'
import { getLogger } from '../utils/logger.js'
import { loadSchema } from '../utils/schema-loader.js'

const logger = getLogger().child({ module: 'tools-policy' })

// Schemas are loaded lazily via loadSchema() utility

interface PolicyToolsContext {
  core: StateCore
  allowedPubkeys: string[]
  clientPubkey?: string
}

/**
 * Create policy/get tool
 */
export function createPolicyGetTool(ctx: PolicyToolsContext): CVMTool {
  return {
    name: 'policy/get',
    description: 'Get current aggregation policy configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: loadSchema('policy-get-output.json'),
    handler: async (_params: PolicyGetInput): Promise<PolicyGetOutput> => {
      const policy = ctx.core.query.policy.get()
      logger.info('Policy requested')
      return { policy }
    },
  }
}

/**
 * Create policy/set tool (requires authorization)
 */
export function createPolicySetTool(ctx: PolicyToolsContext): CVMTool {
  return {
    name: 'policy/set',
    description: 'Update aggregation policy configuration (requires authorization)',
    inputSchema: {
      type: 'object',
      properties: {
        policy: {
          type: 'object',
          properties: {
            windowStrategy: { type: 'string', enum: ['global', 'per-author'] },
            quorum: { type: 'number' },
            labelQuorum: { type: 'number' },
            madScale: { type: 'number' },
            weights: {
              type: 'object',
              properties: {
                recency: { type: 'number' },
                reliability: { type: 'number' },
              },
            },
          },
        },
      },
      required: ['policy'],
    },
    outputSchema: loadSchema('policy-set-output.json'),
    handler: async (params: PolicySetInput): Promise<PolicySetOutput> => {
      // Check authorization
      if (ctx.allowedPubkeys.length > 0) {
        if (!ctx.clientPubkey) {
          logger.warn('Policy set attempted without client pubkey')
          return {
            success: false,
            policy: ctx.core.query.policy.get(),
            message: 'Authorization required',
          }
        }

        if (!ctx.allowedPubkeys.includes(ctx.clientPubkey)) {
          logger.warn({ clientPubkey: ctx.clientPubkey }, 'Unauthorized policy set attempt')
          return {
            success: false,
            policy: ctx.core.query.policy.get(),
            message: 'Not authorized to modify policy',
          }
        }
      }

      // Validate and apply policy changes
      try {
        ctx.core.query.policy.set(params.policy)
        const updatedPolicy = ctx.core.query.policy.get()

        logger.info({ changes: params.policy }, 'Policy updated')

        return {
          success: true,
          policy: updatedPolicy,
          message: 'Policy updated successfully',
        }
      } catch (err: any) {
        logger.error({ err, changes: params.policy }, 'Failed to update policy')
        return {
          success: false,
          policy: ctx.core.query.policy.get(),
          message: `Failed to update policy: ${err.message}`,
        }
      }
    },
  }
}
