/**
 * Subscription Manager
 *
 * Manages subscriptions and detects state changes for notifications
 */

import type {
  Subscription,
  SubscriptionFilter,
  RelayStateSnapshot,
  StateChangeNotification,
  QueuedNotification,
  SubscriptionChannel,
} from '../types/subscription.js'
import { ChangeType } from '../types/subscription.js'
import type { RelayState } from '../types/aggregation.js'
import { getLogger } from '../utils/logger.js'
import { haversineDistance } from '../utils/haversine.js'

const logger = getLogger().child({ module: 'subscription-manager' })

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map()
  private notificationQueue: QueuedNotification[] = []
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  // Track timer keys per subscription for proper cleanup
  private subscriptionTimerKeys: Map<string, Set<string>> = new Map()

  private readonly maxQueueSize = 10000
  private readonly debounceMs = 2000  // 2 seconds
  private readonly maxNotificationsPerClient = 1000

  constructor() {
    logger.info('Subscription manager initialized')
  }

  /**
   * Create a new subscription
   */
  subscribe(
    clientPubkey: string,
    channel: SubscriptionChannel,
    filter: SubscriptionFilter
  ): string {
    const id = this.generateSubscriptionId()

    const subscription: Subscription = {
      id,
      clientPubkey,
      channel,
      filter,
      createdAt: Date.now(),
      lastNotified: Date.now(),
      lastSnapshots: new Map(),
    }

    this.subscriptions.set(id, subscription)
    this.subscriptionTimerKeys.set(id, new Set())

    logger.info({
      id,
      clientPubkey: clientPubkey.slice(0, 8),
      channel,
      filter,
    }, 'Subscription created')

    return id
  }

  /**
   * Remove a subscription
   */
  unsubscribe(id: string): boolean {
    const existed = this.subscriptions.delete(id)

    // Clear ALL pending debounce timers for this subscription
    const timerKeys = this.subscriptionTimerKeys.get(id)
    if (timerKeys) {
      for (const key of timerKeys) {
        const timer = this.debounceTimers.get(key)
        if (timer) {
          clearTimeout(timer)
          this.debounceTimers.delete(key)
        }
      }
      this.subscriptionTimerKeys.delete(id)
    }

    if (existed) {
      logger.info({ id }, 'Subscription removed')
    }

    return existed
  }

  /**
   * Get subscription by ID
   */
  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id)
  }

  /**
   * Get all subscriptions for a client
   */
  getClientSubscriptions(clientPubkey: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.clientPubkey === clientPubkey)
  }

  /**
   * Check if relay matches subscription filter
   */
  private matchesFilter(state: RelayState, filter: SubscriptionFilter): boolean {
    // Filter by relay URLs
    if (filter.relayUrls && !filter.relayUrls.includes(state.relayUrl)) {
      return false
    }

    // Filter by network
    if (filter.network && state.network?.value !== filter.network) {
      return false
    }

    // Filter by NIPs
    if (filter.nips && state.nips) {
      const hasAllNips = filter.nips.every(nip => state.nips!.list.includes(nip))
      if (!hasAllNips) return false
    }

    // Filter by software
    if (filter.software) {
      if (filter.software.family && state.software?.family?.value !== filter.software.family) {
        return false
      }
      if (filter.software.version && state.software?.version?.value !== filter.software.version) {
        return false
      }
    }

    // Filter by labels
    if (filter.labels && state.labels) {
      const hasAllLabels = filter.labels.every(label => {
        const values = state.labels![label.namespace]
        return values && values.includes(label.value)
      })
      if (!hasAllLabels) return false
    }

    // Filter by geo
    if (filter.geo?.center && filter.geo?.radius && state.geo) {
      const distance = haversineDistance(
        filter.geo.center.lat,
        filter.geo.center.lon,
        state.geo.lat,
        state.geo.lon
      )
      if (distance > filter.geo.radius) {
        return false
      }
    }

    return true
  }

  /**
   * Detect changes between old and new state
   */
  private detectChanges(
    oldSnapshot: RelayStateSnapshot | undefined,
    newState: RelayState,
    thresholds?: SubscriptionFilter['thresholds']
  ): StateChangeNotification['changes'] {
    const changes: StateChangeNotification['changes'] = []

    if (!oldSnapshot) {
      // No previous snapshot, this is initial state
      return changes
    }

    // Network change
    if (oldSnapshot.network !== newState.network?.value) {
      changes.push({
        type: ChangeType.NETWORK_CHANGE,
        field: 'network',
        oldValue: oldSnapshot.network,
        newValue: newState.network?.value,
      })
    }

    // Software change
    if (oldSnapshot.software?.family !== newState.software?.family?.value) {
      changes.push({
        type: ChangeType.SOFTWARE_CHANGE,
        field: 'software.family',
        oldValue: oldSnapshot.software?.family,
        newValue: newState.software?.family?.value,
      })
    }

    if (oldSnapshot.software?.version !== newState.software?.version?.value) {
      changes.push({
        type: ChangeType.SOFTWARE_CHANGE,
        field: 'software.version',
        oldValue: oldSnapshot.software?.version,
        newValue: newState.software?.version?.value,
      })
    }

    // RTT changes
    const rttThreshold = thresholds?.rttDeltaMs || 100  // default 100ms
    for (const key of ['open', 'read', 'write'] as const) {
      const oldRtt = oldSnapshot.rtt?.[key]
      const newRtt = newState.rtt?.[key]?.value

      if (oldRtt !== undefined && newRtt !== undefined) {
        const delta = Math.abs(newRtt - oldRtt)
        if (delta >= rttThreshold) {
          changes.push({
            type: ChangeType.RTT_CHANGE,
            field: `rtt.${key}`,
            oldValue: oldRtt,
            newValue: newRtt,
            delta,
          })
        }
      } else if (oldRtt === undefined && newRtt !== undefined) {
        // Status flip: became available
        changes.push({
          type: ChangeType.STATUS_FLIP,
          field: `rtt.${key}`,
          oldValue: null,
          newValue: newRtt,
        })
      } else if (oldRtt !== undefined && newRtt === undefined) {
        // Status flip: became unavailable
        changes.push({
          type: ChangeType.STATUS_FLIP,
          field: `rtt.${key}`,
          oldValue: oldRtt,
          newValue: null,
        })
      }
    }

    // NIP changes - apply supportDelta threshold
    const oldNips = new Set(oldSnapshot.nips || [])
    const newNips = new Set(newState.nips?.list || [])

    // Calculate set difference size
    const added = [...newNips].filter(n => !oldNips.has(n))
    const removed = [...oldNips].filter(n => !newNips.has(n))
    const totalChanges = added.length + removed.length
    const totalSize = Math.max(oldNips.size, newNips.size, 1) // Avoid division by zero

    // Only notify if change exceeds supportDelta threshold (proportion of set changed)
    const changeProportion = totalChanges / totalSize
    const supportDelta = thresholds?.supportDelta ?? 0.1 // Default 10%

    if (changeProportion >= supportDelta) {
      for (const nip of added) {
        changes.push({
          type: ChangeType.NIP_ADDED,
          field: 'nips',
          newValue: nip,
        })
      }

      for (const nip of removed) {
        changes.push({
          type: ChangeType.NIP_REMOVED,
          field: 'nips',
          oldValue: nip,
        })
      }
    }

    // Requirement changes
    if (oldSnapshot.requirements && newState.requirements) {
      for (const [key, oldVal] of Object.entries(oldSnapshot.requirements)) {
        const newVal = newState.requirements[key]?.value
        if (newVal !== undefined && oldVal !== newVal) {
          changes.push({
            type: ChangeType.REQUIREMENT_CHANGE,
            field: `requirements.${key}`,
            oldValue: oldVal,
            newValue: newVal,
          })
        }
      }
    }

    // Label changes - apply supportDelta threshold
    const oldLabels = oldSnapshot.labels || {}
    const newLabels = newState.labels || {}

    // Calculate label value differences across all namespaces
    const allNamespaces = new Set([...Object.keys(oldLabels), ...Object.keys(newLabels)])
    let labelChanges = 0
    let totalLabelValues = 0

    for (const namespace of allNamespaces) {
      const oldValues = new Set(oldLabels[namespace] || [])
      const newValues = new Set(newLabels[namespace] || [])

      const addedValues = [...newValues].filter(v => !oldValues.has(v))
      const removedValues = [...oldValues].filter(v => !newValues.has(v))

      labelChanges += addedValues.length + removedValues.length
      totalLabelValues += Math.max(oldValues.size, newValues.size, 1)
    }

    // Only notify if change exceeds supportDelta threshold
    const labelChangeProportion = totalLabelValues > 0 ? labelChanges / totalLabelValues : 0
    if (labelChangeProportion >= supportDelta) {
      changes.push({
        type: ChangeType.LABEL_CHANGE,
        field: 'labels',
        oldValue: oldLabels,
        newValue: newLabels,
        delta: labelChangeProportion,
      })
    }

    // Geo changes
    if (oldSnapshot.geo && newState.geo) {
      const distance = haversineDistance(
        oldSnapshot.geo.lat,
        oldSnapshot.geo.lon,
        newState.geo.lat,
        newState.geo.lon
      )
      // Notify if moved > 10km
      if (distance > 10) {
        changes.push({
          type: ChangeType.GEO_CHANGE,
          field: 'geo',
          oldValue: oldSnapshot.geo,
          newValue: { lat: newState.geo.lat, lon: newState.geo.lon },
          delta: distance,
        })
      }
    }

    return changes
  }

  /**
   * Create snapshot from relay state
   */
  private createSnapshot(state: RelayState): RelayStateSnapshot {
    return {
      relayUrl: state.relayUrl,
      network: state.network?.value,
      software: state.software?.family ? {
        family: state.software.family.value,
        version: state.software.version?.value,
      } : undefined,
      rtt: state.rtt ? {
        open: state.rtt.open?.value,
        read: state.rtt.read?.value,
        write: state.rtt.write?.value,
      } : undefined,
      nips: state.nips?.list,
      requirements: state.requirements ?
        Object.fromEntries(
          Object.entries(state.requirements).map(([k, v]) => [k, v.value])
        ) : undefined,
      labels: state.labels,
      geo: state.geo ? { lat: state.geo.lat, lon: state.geo.lon } : undefined,
      timestamp: Date.now(),
    }
  }

  /**
   * Process state change and queue notifications
   */
  processStateChange(newState: RelayState): void {
    for (const subscription of this.subscriptions.values()) {
      // Check if relay matches filter
      if (!this.matchesFilter(newState, subscription.filter)) {
        continue
      }

      // Get last snapshot
      const oldSnapshot = subscription.lastSnapshots.get(newState.relayUrl)

      // Detect changes
      const changes = this.detectChanges(
        oldSnapshot,
        newState,
        subscription.filter.thresholds
      )

      // If no material changes, skip
      if (changes.length === 0) {
        continue
      }

      // Update snapshot
      subscription.lastSnapshots.set(newState.relayUrl, this.createSnapshot(newState))

      // Create notification
      const notification: StateChangeNotification = {
        type: 'state_change',
        relayUrl: newState.relayUrl,
        changes,
        newState,
        timestamp: Date.now(),
      }

      // Queue with debouncing
      this.queueNotification(subscription, notification)
    }
  }

  /**
   * Queue notification with debouncing
   */
  private queueNotification(
    subscription: Subscription,
    notification: StateChangeNotification
  ): void {
    const key = `${subscription.id}:${notification.relayUrl}`

    // Track this timer key for the subscription
    const timerKeys = this.subscriptionTimerKeys.get(subscription.id)
    if (timerKeys) {
      timerKeys.add(key)
    }

    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)
      // Remove from tracking set
      const keys = this.subscriptionTimerKeys.get(subscription.id)
      if (keys) {
        keys.delete(key)
      }
      this.addToQueue(subscription, notification)
    }, this.debounceMs)

    this.debounceTimers.set(key, timer)
  }

  /**
   * Add notification to queue
   */
  private addToQueue(
    subscription: Subscription,
    notification: StateChangeNotification
  ): void {
    // Check queue size limits
    if (this.notificationQueue.length >= this.maxQueueSize) {
      // Drop oldest
      this.notificationQueue.shift()
      logger.warn('Notification queue full, dropping oldest')
    }

    // Check per-client limits
    const clientQueue = this.notificationQueue.filter(
      q => q.clientPubkey === subscription.clientPubkey
    )
    if (clientQueue.length >= this.maxNotificationsPerClient) {
      logger.warn({
        clientPubkey: subscription.clientPubkey.slice(0, 8),
      }, 'Client notification limit reached, dropping')
      return
    }

    this.notificationQueue.push({
      subscriptionId: subscription.id,
      clientPubkey: subscription.clientPubkey,
      channel: subscription.channel,
      notification,
      queuedAt: Date.now(),
      attempts: 0,
    })

    // Update lastNotified timestamp
    subscription.lastNotified = Date.now()

    logger.debug({
      subscriptionId: subscription.id,
      relayUrl: notification.relayUrl,
      changeCount: notification.changes.length,
    }, 'Notification queued')
  }

  /**
   * Get pending notifications (for delivery)
   * Filters by channel to prevent cross-channel consumption
   */
  getPendingNotifications(limit: number = 100, channel?: SubscriptionChannel): QueuedNotification[] {
    if (!channel) {
      // Backward compatibility: return all if no channel specified
      return this.notificationQueue.splice(0, limit)
    }

    // Filter and extract notifications for the specified channel
    const channelNotifications: QueuedNotification[] = []
    const remainingNotifications: QueuedNotification[] = []

    for (const notification of this.notificationQueue) {
      if (notification.channel === channel && channelNotifications.length < limit) {
        channelNotifications.push(notification)
      } else {
        remainingNotifications.push(notification)
      }
    }

    // Replace queue with remaining notifications
    this.notificationQueue = remainingNotifications

    return channelNotifications
  }

  /**
   * Requeue failed notification
   */
  requeueNotification(notification: QueuedNotification): void {
    notification.attempts++
    if (notification.attempts < 3) {
      this.notificationQueue.push(notification)
    } else {
      logger.warn({
        subscriptionId: notification.subscriptionId,
        attempts: notification.attempts,
      }, 'Notification dropped after max attempts')
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    subscriptionCount: number
    queueSize: number
    debounceTimerCount: number
  } {
    return {
      subscriptionCount: this.subscriptions.size,
      queueSize: this.notificationQueue.length,
      debounceTimerCount: this.debounceTimers.size,
    }
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }
}
