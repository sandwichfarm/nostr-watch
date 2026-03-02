// @ts-nocheck — Subscription system is DISABLED; routes are never registered.
// This file will be type-checked once re-enabled.
/**
 * Subscription Routes
 *
 * HTTP endpoints for managing relay state subscriptions
 */

import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'
import type { SubscriptionFilter } from '../../types/subscription.js'
import { getLogger } from '../../utils/logger.js'
import { schemas } from '../schemas.js'

const logger = getLogger().child({ module: 'rest-subscriptions' })

/**
 * Generate a session ID for REST clients
 */
function generateSessionId(): string {
  return `rest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Register subscription routes
 */
export function registerSubscriptionRoutes(app: FastifyInstance, context: RestContext): void {
  const { subscriptionManager, sseDelivery } = context

  // POST /subscriptions - Create a new subscription
  app.post<{
    Body: {
      sessionId?: string
      filter?: SubscriptionFilter
    }
  }>('/subscriptions', {
    schema: {
      tags: ['subscriptions'],
      description: 'Create a new relay state subscription',
      body: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Optional session ID (will be generated if not provided)' },
          filter: {
            type: 'object',
            description: 'Optional filter criteria',
            properties: {
              relayUrls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by specific relay URLs',
              },
              network: {
                type: 'string',
                enum: ['clearnet', 'tor', 'i2p', 'hybrid'],
                description: 'Filter by network type',
              },
              nips: {
                type: 'array',
                items: { type: 'number' },
                description: 'Filter by NIPs',
              },
              software: {
                type: 'object',
                properties: {
                  family: { type: 'string' },
                  version: { type: 'string' },
                },
                description: 'Filter by software',
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
                description: 'Filter by labels',
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
                  radius: { type: 'number', description: 'Radius in kilometers' },
                },
                description: 'Geographic filter',
              },
              thresholds: {
                type: 'object',
                properties: {
                  rttDeltaMs: { type: 'number', description: 'Notify if RTT changes by more than this (ms)' },
                  supportDelta: { type: 'number', description: 'Notify if support ratio changes by more than this' },
                },
                description: 'Change detection thresholds',
              },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
            sessionId: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['subscriptionId', 'sessionId', 'message'],
        },
      },
    },
  }, async (request, reply) => {
    const { sessionId: providedSessionId, filter = {} } = request.body

    // Use provided sessionId or generate a new one
    const sessionId = providedSessionId || generateSessionId()

    // Create subscription (use sessionId as clientPubkey for REST)
    const subscriptionId = subscriptionManager.subscribe(sessionId, 'REST', filter)

    logger.info({
      subscriptionId,
      sessionId,
      filter,
    }, 'Subscription created via REST')

    return {
      subscriptionId,
      sessionId,
      message: `Subscription created. Connect to /subscriptions/events?sessionId=${sessionId} to receive notifications.`,
    }
  })

  // DELETE /subscriptions/:id - Delete a subscription
  app.delete<{
    Params: { id: string }
  }>('/subscriptions/:id', {
    schema: {
      tags: ['subscriptions'],
      description: 'Delete a subscription',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: schemas.subscriptions.unsubscribe,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params

    const success = subscriptionManager.unsubscribe(id)

    if (!success) {
      return reply.status(404).send({
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: `Subscription ${id} not found`,
        },
      })
    }

    logger.info({ subscriptionId: id }, 'Subscription deleted via REST')

    return {
      success: true,
      message: 'Subscription deleted successfully',
    }
  })

  // GET /subscriptions - List subscriptions for a session
  app.get<{
    Querystring: {
      sessionId: string
    }
  }>('/subscriptions', {
    schema: {
      tags: ['subscriptions'],
      description: 'List all subscriptions for a session',
      querystring: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  filter: { type: 'object' },
                  createdAt: { type: 'number' },
                  lastNotified: { type: 'number' },
                },
              },
            },
            total: { type: 'number' },
          },
          required: ['subscriptions', 'total'],
        },
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.query

    const subs = subscriptionManager.getClientSubscriptions(sessionId)

    const subscriptions = subs.map(sub => ({
      id: sub.id,
      filter: sub.filter,
      createdAt: sub.createdAt,
      lastNotified: sub.lastNotified,
    }))

    return {
      subscriptions,
      total: subscriptions.length,
    }
  })

  // GET /subscriptions/events - SSE endpoint for receiving notifications
  app.get<{
    Querystring: {
      sessionId: string
    }
  }>('/subscriptions/events', {
    schema: {
      tags: ['subscriptions'],
      description: 'Server-Sent Events stream for subscription notifications',
      querystring: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.query

    if (!sessionId) {
      return reply.status(400).send({
        error: {
          code: 'MISSING_SESSION_ID',
          message: 'sessionId query parameter is required',
        },
      })
    }

    // Check if session has any subscriptions
    const subs = subscriptionManager.getClientSubscriptions(sessionId)
    if (subs.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'NO_SUBSCRIPTIONS',
          message: `No subscriptions found for session ${sessionId}`,
        },
      })
    }

    logger.info({
      sessionId,
      subscriptionCount: subs.length,
    }, 'SSE connection established')

    // Register SSE client
    sseDelivery.registerClient(sessionId, reply)

    // Return empty response - SSE will handle the rest
    return reply
  })

  logger.info('Subscription routes registered')
}
