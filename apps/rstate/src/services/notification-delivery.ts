/**
 * Notification Delivery Service
 *
 * Delivers queued notifications to subscribers via Nostr transport
 */

import type { SubscriptionManager } from './subscription-manager.js'
import type { NostrServerTransport } from '@contextvm/sdk'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'notification-delivery' })

export class NotificationDeliveryService {
  private deliveryInterval?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor(
    private subscriptionManager: SubscriptionManager,
    private transport: NostrServerTransport
  ) {
    logger.info('Notification delivery service initialized')
  }

  /**
   * Start the delivery service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Notification delivery already running')
      return
    }

    this.isRunning = true

    // Process notifications every second
    this.deliveryInterval = setInterval(() => {
      this.processNotifications()
    }, 1000)

    logger.info('Notification delivery started')
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

    logger.info('Notification delivery stopped')
  }

  /**
   * Process pending notifications
   */
  private async processNotifications(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Fetch only MCP channel notifications
      const pending = this.subscriptionManager.getPendingNotifications(50, 'MCP')

      if (pending.length === 0) return

      logger.debug({ count: pending.length, channel: 'MCP' }, 'Processing notifications')

      for (const queued of pending) {
        try {
          await this.deliverNotification(queued)
        } catch (err) {
          logger.error({
            err,
            subscriptionId: queued.subscriptionId,
            relayUrl: queued.notification.relayUrl,
          }, 'Failed to deliver notification')

          // Requeue on failure
          this.subscriptionManager.requeueNotification(queued)
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in notification processing loop')
    }
  }

  /**
   * Deliver a single notification via Nostr transport
   */
  private async deliverNotification(queued: any): Promise<void> {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/relay_state_changed',
      params: {
        subscriptionId: queued.subscriptionId,
        relayUrl: queued.notification.relayUrl,
        changes: queued.notification.changes,
        timestamp: queued.notification.timestamp,
      },
    }

    try {
      // Send notification to specific client via Nostr transport
      await this.transport.sendNotification(queued.clientPubkey, notification)

      logger.debug({
        subscriptionId: queued.subscriptionId,
        clientPubkey: queued.clientPubkey.slice(0, 8),
        relayUrl: queued.notification.relayUrl,
        changeCount: queued.notification.changes.length,
      }, 'Notification delivered via Nostr')
    } catch (err) {
      logger.error({
        err,
        subscriptionId: queued.subscriptionId,
        clientPubkey: queued.clientPubkey.slice(0, 8),
      }, 'Failed to send notification via transport')
      throw err
    }
  }

  /**
   * Get delivery statistics
   */
  getStats(): {
    isRunning: boolean
    subscriptionStats: ReturnType<SubscriptionManager['getStats']>
  } {
    return {
      isRunning: this.isRunning,
      subscriptionStats: this.subscriptionManager.getStats(),
    }
  }
}
