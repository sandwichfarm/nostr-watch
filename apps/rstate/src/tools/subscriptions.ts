/**
 * Subscription MCP Tools
 *
 * Provides subscription management for state change notifications
 */

import type { CVMTool } from '../mcp/tool-adapter.js'
import type {
  RelaysSubscribeStateInput,
  RelaysSubscribeStateOutput,
  RelaysUnsubscribeInput,
  RelaysUnsubscribeOutput,
} from '../types/tool-schemas.js'
import type { SubscriptionManager } from '../services/subscription-manager.js'
import { getLogger } from '../utils/logger.js'
import { loadSchema } from '../utils/schema-loader.js'

const logger = getLogger().child({ module: 'tools-subscriptions' })

// Schemas are loaded lazily via loadSchema() utility

interface SubscriptionToolsContext {
  subscriptionManager: SubscriptionManager
  getClientPubkey: () => string | undefined
  requireAuth?: boolean
}

/**
 * Create relays/subscribe_state tool
 */
export function createRelaysSubscribeStateTool(ctx: SubscriptionToolsContext): CVMTool {
  return {
    name: 'relays/subscribe_state',
    description: 'Subscribe to relay state change notifications',
    inputSchema: {
      type: 'object',
      properties: {
        relayUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific relay URLs (optional)',
        },
        network: {
          type: 'string',
          enum: ['clearnet', 'tor', 'i2p', 'hybrid'],
          description: 'Filter by network type (optional)',
        },
        nips: {
          type: 'array',
          items: { type: 'number' },
          description: 'Filter by NIPs that must be supported (optional)',
        },
        software: {
          type: 'object',
          properties: {
            family: { type: 'string' },
            version: { type: 'string' },
          },
          description: 'Filter by software family/version (optional)',
        },
        labels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              namespace: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['namespace', 'value'],
          },
          description: 'Filter by labels (optional)',
        },
        geo: {
          type: 'object',
          properties: {
            center: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lon: { type: 'number' },
              },
              required: ['lat', 'lon'],
            },
            radius: { type: 'number' },
          },
          required: ['center', 'radius'],
          description: 'Filter by geographic area (optional)',
        },
        thresholds: {
          type: 'object',
          properties: {
            rttDeltaMs: { type: 'number', description: 'Notify if RTT changes by this amount (ms)' },
            supportDelta: { type: 'number', description: 'Notify if support ratio changes by this amount' },
          },
          description: 'Change thresholds for notifications (optional)',
        },
      },
    },
    outputSchema: loadSchema('relays-subscribe-state-output.json'),
    handler: async (params: RelaysSubscribeStateInput): Promise<RelaysSubscribeStateOutput> => {
      const clientPubkey = ctx.getClientPubkey()
      if ((ctx.requireAuth ?? true) && !clientPubkey) {
        throw new Error('Client authentication required for subscriptions')
      }

      const subscriptionId = ctx.subscriptionManager.subscribe(clientPubkey || 'public', 'MCP', params)

      const displayKey = clientPubkey ? clientPubkey.slice(0, 8) : 'public'
      logger.info({ subscriptionId, clientPubkey: displayKey, filter: params }, 'Subscription created')

      return {
        subscriptionId,
        message: `Subscribed successfully. You will receive notifications for matching state changes.`,
      }
    },
  }
}

/**
 * Create relays/unsubscribe tool
 */
export function createRelaysUnsubscribeTool(ctx: SubscriptionToolsContext): CVMTool {
  return {
    name: 'relays/unsubscribe',
    description: 'Unsubscribe from relay state change notifications',
    inputSchema: {
      type: 'object',
      properties: {
        subscriptionId: {
          type: 'string',
          description: 'The subscription ID to cancel',
        },
      },
      required: ['subscriptionId'],
    },
    outputSchema: loadSchema('relays-unsubscribe-output.json'),
    handler: async (params: RelaysUnsubscribeInput): Promise<RelaysUnsubscribeOutput> => {
      const success = ctx.subscriptionManager.unsubscribe(params.subscriptionId)

      if (success) {
        logger.info({ subscriptionId: params.subscriptionId }, 'Subscription cancelled')
        return {
          success: true,
          message: 'Unsubscribed successfully',
        }
      } else {
        logger.warn({ subscriptionId: params.subscriptionId }, 'Subscription not found')
        return {
          success: false,
          message: 'Subscription not found',
        }
      }
    },
  }
}
