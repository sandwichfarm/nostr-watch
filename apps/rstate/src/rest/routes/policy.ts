/**
 * Policy Routes
 *
 * HTTP endpoints for policy management
 */

import type { FastifyInstance } from 'fastify'
import type { RestContext } from '../server.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'rest-policy' })

/**
 * Register policy routes
 */
export function registerPolicyRoutes(app: FastifyInstance, context: RestContext): void {
  const { core, allowPolicyUpdate } = context

  // GET /policy - Get current policy
  app.get('/policy', {
    schema: {
      tags: ['policy'],
      description: 'Get current aggregation policy',
    },
  }, async (_request, _reply) => {
    const policy = core.query.policy.get()
    return { policy }
  })

  // POST /policy - Update policy (requires auth)
  app.post<{
    Body: {
      quorum?: number
      labelQuorum?: number
      madScale?: number
    }
  }>('/policy', {
    schema: {
      tags: ['policy'],
      description: 'Update aggregation policy (requires authentication)',
      body: {
        type: 'object',
        properties: {
          quorum: { type: 'number', minimum: 0, maximum: 1 },
          labelQuorum: { type: 'number', minimum: 0, maximum: 1 },
          madScale: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    // Check if policy updates are allowed
    if (!allowPolicyUpdate) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Policy updates are disabled. Set REST_ALLOW_POLICY_UPDATE=true to enable.',
        },
      })
    }

    const updates = request.body

    // Validate at least one field is provided
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({
        error: {
          code: 'NO_UPDATES',
          message: 'At least one policy field must be provided',
        },
      })
    }

    try {
      core.query.policy.set(updates)
      const newPolicy = core.query.policy.get()

      logger.info({ updates, newPolicy }, 'Policy updated via REST')

      return {
        policy: newPolicy,
        message: 'Policy updated successfully',
      }
    } catch (err: any) {
      logger.error({ err, updates }, 'Failed to update policy')
      return reply.status(500).send({
        error: {
          code: 'POLICY_UPDATE_FAILED',
          message: err.message || 'Failed to update policy',
        },
      })
    }
  })

  logger.info('Policy routes registered')
}
