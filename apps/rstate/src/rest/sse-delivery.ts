/**
 * SSE Notification Delivery
 *
 * Delivers subscription notifications via Server-Sent Events
 */

import type { FastifyReply } from 'fastify'
import type { SubscriptionManager } from '../services/subscription-manager.js'
import type { StateChangeNotification } from '../types/subscription.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'sse-delivery' })

interface SSEClient {
  sessionId: string
  reply: FastifyReply
  connectedAt: number
  lastPing: number
}

export class SSEDeliveryService {
  private clients: Map<string, SSEClient> = new Map()
  private deliveryInterval?: NodeJS.Timeout
  private pingInterval?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor(
    private subscriptionManager: SubscriptionManager
  ) {
    logger.info('SSE delivery service initialized')
  }

  /**
   * Start the delivery service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('SSE delivery already running')
      return
    }

    this.isRunning = true

    // Process notifications every second
    this.deliveryInterval = setInterval(() => {
      this.processNotifications()
    }, 1000)

    // Send keepalive pings every 30 seconds
    this.pingInterval = setInterval(() => {
      this.sendPings()
    }, 30000)

    logger.info('SSE delivery started')
  }

  /**
   * Stop the delivery service
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.deliveryInterval) {
      clearInterval(this.deliveryInterval)
      this.deliveryInterval = undefined
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = undefined
    }

    // Close all connections
    for (const client of this.clients.values()) {
      this.closeClient(client)
    }

    logger.info('SSE delivery stopped')
  }

  /**
   * Register a new SSE client
   */
  registerClient(sessionId: string, reply: FastifyReply): void {
    // Close existing connection if any
    const existing = this.clients.get(sessionId)
    if (existing) {
      this.closeClient(existing)
    }

    // Setup SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    const client: SSEClient = {
      sessionId,
      reply,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    }

    this.clients.set(sessionId, client)

    // Send initial connection event
    this.sendEvent(client, 'connected', {
      sessionId,
      timestamp: Date.now(),
    })

    // Handle client disconnect
    reply.raw.on('close', () => {
      this.clients.delete(sessionId)
      logger.info({ sessionId }, 'SSE client disconnected')
    })

    logger.info({ sessionId }, 'SSE client connected')
  }

  /**
   * Process pending notifications and deliver to SSE clients
   */
  private async processNotifications(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Fetch only REST channel notifications
      const pending = this.subscriptionManager.getPendingNotifications(50, 'REST')

      if (pending.length === 0) return

      logger.debug({ count: pending.length, channel: 'REST' }, 'Processing SSE notifications')

      for (const queued of pending) {
        try {
          await this.deliverNotification(queued)
        } catch (err) {
          logger.error({
            err,
            subscriptionId: queued.subscriptionId,
            relayUrl: queued.notification.relayUrl,
          }, 'Failed to deliver SSE notification')

          // Requeue on failure
          this.subscriptionManager.requeueNotification(queued)
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in SSE notification processing loop')
    }
  }

  /**
   * Deliver a single notification to SSE client
   */
  private async deliverNotification(queued: any): Promise<void> {
    // Find client by sessionId (clientPubkey is used as sessionId for REST)
    const client = this.clients.get(queued.clientPubkey)

    if (!client) {
      // Requeue if client not connected yet and attempts < 3
      // This handles the case where subscription is created before SSE stream opens
      if (queued.attempts < 3) {
        logger.debug({
          sessionId: queued.clientPubkey,
          subscriptionId: queued.subscriptionId,
          attempts: queued.attempts,
        }, 'SSE client not connected yet, requeueing notification')
        this.subscriptionManager.requeueNotification(queued)
      } else {
        logger.debug({
          sessionId: queued.clientPubkey,
          subscriptionId: queued.subscriptionId,
          attempts: queued.attempts,
        }, 'SSE client not connected after retries, dropping notification')
      }
      return
    }

    const notification: StateChangeNotification = queued.notification

    // Send as SSE event
    this.sendEvent(client, 'notification', {
      subscriptionId: queued.subscriptionId,
      relayUrl: notification.relayUrl,
      changes: notification.changes,
      timestamp: notification.timestamp,
    })

    logger.debug({
      sessionId: client.sessionId,
      subscriptionId: queued.subscriptionId,
      relayUrl: notification.relayUrl,
      changeCount: notification.changes.length,
    }, 'SSE notification delivered')
  }

  /**
   * Send keepalive pings to all clients
   */
  private sendPings(): void {
    const now = Date.now()

    for (const client of this.clients.values()) {
      try {
        this.sendEvent(client, 'ping', { timestamp: now })
        client.lastPing = now
      } catch (err) {
        logger.error({
          err,
          sessionId: client.sessionId,
        }, 'Failed to send ping, closing connection')
        this.closeClient(client)
        this.clients.delete(client.sessionId)
      }
    }
  }

  /**
   * Send an SSE event to a client
   */
  private sendEvent(client: SSEClient, event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

    if (!client.reply.raw.write(payload)) {
      throw new Error('Failed to write to SSE stream')
    }
  }

  /**
   * Close an SSE client connection
   */
  private closeClient(client: SSEClient): void {
    try {
      client.reply.raw.end()
    } catch (err) {
      logger.error({
        err,
        sessionId: client.sessionId,
      }, 'Error closing SSE client')
    }
  }

  /**
   * Get delivery statistics
   */
  getStats(): {
    isRunning: boolean
    clientCount: number
    subscriptionStats: ReturnType<SubscriptionManager['getStats']>
  } {
    return {
      isRunning: this.isRunning,
      clientCount: this.clients.size,
      subscriptionStats: this.subscriptionManager.getStats(),
    }
  }
}
