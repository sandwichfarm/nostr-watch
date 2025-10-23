import Logger from '@nostrwatch/logger'
import { SimplePool, nip19 } from 'nostr-tools'
import { normalizeURL } from 'nostr-tools/utils'

/**
 * IgnoreListSync - Manages synchronization of relay ignore lists across monitors
 *
 * Uses NIP-65 (inbox/outbox) pattern:
 * 1. Fetches kind 10002 for configured pubkeys from static relays
 * 2. Uses relays from their 10002 to fetch their kind 10006 (blocked relays)
 * 3. Merges all ignore lists for local deduplication
 * 4. Publishes this monitor's kind 10006 to configured relays
 */
export class IgnoreListSync {
  constructor(config, staticRelays) {
    this.log = new Logger('@nostrwatch/nocapd:ignorelist')
    this.config = config?.nocapd?.ignorelist || {}
    this.enabled = this.config.enabled || false
    this.publishRelays = this.config.relays || []
    this.syncPubkeys = this.config.pubkeys || []
    this.staticRelays = staticRelays // Where to find kind 10002 events
    this.pool = new SimplePool()
    this.ignoredRelays = new Set() // Merged ignore list from all monitors
    this.localIgnoredRelays = new Set() // This monitor's own ignore list
    this.localIgnoreListChanged = false // Track if local list has changed

    if (this.enabled) {
      this.log.info(`IgnoreListSync initialized with ${this.syncPubkeys.length} pubkeys`)
      this.log.info(`Publishing kind 10006 to: ${this.publishRelays.join(', ')}`)
    }
  }

  /**
   * Get relays to append to this monitor's kind 10002
   */
  getRelaysForKind10002() {
    return this.enabled ? this.publishRelays : []
  }

  /**
   * Add a relay to this monitor's local ignore list
   */
  addToIgnoreList(relayUrl) {
    const normalized = normalizeURL(relayUrl)
    const sizeBefore = this.localIgnoredRelays.size
    this.localIgnoredRelays.add(normalized)
    this.ignoredRelays.add(normalized)

    // Mark as changed if this is a new entry
    if (this.localIgnoredRelays.size > sizeBefore) {
      this.localIgnoreListChanged = true
      this.log.debug(`Added ${normalized} to local ignore list`)
    }
  }

  /**
   * Remove a relay from this monitor's local ignore list
   */
  removeFromIgnoreList(relayUrl) {
    const normalized = normalizeURL(relayUrl)
    this.localIgnoredRelays.delete(normalized)
    this.log.debug(`Removed ${normalized} from local ignore list`)
  }

  /**
   * Check if a relay is in the merged ignore list
   */
  isIgnored(relayUrl) {
    try {
      const normalized = normalizeURL(relayUrl)
      return this.ignoredRelays.has(normalized)
    } catch (e) {
      this.log.error(`Error checking if relay is ignored: ${e.message}`)
      return false
    }
  }

  /**
   * Fetch kind 10002 (relay list) for a pubkey from static relays
   */
  async fetchKind10002(pubkey) {
    try {
      this.log.debug(`Fetching kind 10002 for ${pubkey.slice(0, 8)}...`)

      const events = await this.pool.querySync(
        this.staticRelays,
        { kinds: [10002], authors: [pubkey], limit: 1 }
      )

      if (!events || events.length === 0) {
        this.log.warn(`No kind 10002 found for ${pubkey.slice(0, 8)}...`)
        return []
      }

      const event = events[0]
      const relays = event.tags
        .filter(tag => tag[0] === 'relay' || tag[0] === 'r')
        .map(tag => tag[1])
        .filter(Boolean)

      this.log.debug(`Found ${relays.length} relays in kind 10002 for ${pubkey.slice(0, 8)}...`)
      return relays
    } catch (e) {
      this.log.error(`Error fetching kind 10002 for ${pubkey.slice(0, 8)}...: ${e.message}`)
      return []
    }
  }

  /**
   * Fetch kind 10006 (blocked relays) for a pubkey from their relays
   */
  async fetchKind10006(pubkey, relays) {
    try {
      this.log.debug(`Fetching kind 10006 for ${pubkey.slice(0, 8)}... from ${relays.length} relays`)

      const events = await this.pool.querySync(
        relays,
        { kinds: [10006], authors: [pubkey], limit: 1 }
      )

      if (!events || events.length === 0) {
        this.log.debug(`No kind 10006 found for ${pubkey.slice(0, 8)}...`)
        return []
      }

      const event = events[0]
      const blockedRelays = event.tags
        .filter(tag => tag[0] === 'relay' || tag[0] === 'r')
        .map(tag => tag[1])
        .filter(Boolean)
        .map(url => normalizeURL(url))

      this.log.info(`Found ${blockedRelays.length} blocked relays from ${pubkey.slice(0, 8)}...`)
      return blockedRelays
    } catch (e) {
      this.log.error(`Error fetching kind 10006 for ${pubkey.slice(0, 8)}...: ${e.message}`)
      return []
    }
  }

  /**
   * Sync ignore lists from all configured pubkeys
   */
  async sync() {
    if (!this.enabled) {
      this.log.debug('IgnoreListSync is disabled, skipping sync')
      return
    }

    if (this.syncPubkeys.length === 0) {
      this.log.debug('No pubkeys configured for sync')
      return
    }

    this.log.info(`Starting ignore list sync from ${this.syncPubkeys.length} monitors...`)

    // Reset the synced portion of ignore list (keep local ones)
    this.ignoredRelays = new Set(this.localIgnoredRelays)

    for (const pubkey of this.syncPubkeys) {
      try {
        // Step 1: Fetch their kind 10002 from static relays
        const theirRelays = await this.fetchKind10002(pubkey)

        if (theirRelays.length === 0) {
          this.log.warn(`Skipping ${pubkey.slice(0, 8)}... - no relays found in kind 10002`)
          continue
        }

        // Step 2: Fetch their kind 10006 from their relays
        const blockedRelays = await this.fetchKind10006(pubkey, theirRelays)

        // Step 3: Merge into our ignore list
        blockedRelays.forEach(relay => this.ignoredRelays.add(relay))

      } catch (e) {
        this.log.error(`Error syncing from ${pubkey.slice(0, 8)}...: ${e.message}`)
      }
    }

    this.log.info(`Sync complete. Total ignored relays: ${this.ignoredRelays.size}`)
  }

  /**
   * Publish this monitor's kind 10006 (blocked relays) - ONLY if local list changed
   * Only publishes LOCAL ignores, not synced ones from other monitors
   */
  async publish(privkey) {
    if (!this.enabled) {
      this.log.debug('IgnoreListSync is disabled, skipping publish')
      return
    }

    if (!this.localIgnoreListChanged) {
      this.log.debug('Local ignore list has not changed, skipping publish')
      return
    }

    if (this.publishRelays.length === 0) {
      this.log.warn('No relays configured for publishing kind 10006')
      return
    }

    if (this.localIgnoredRelays.size === 0) {
      this.log.debug('No local ignored relays to publish')
      return
    }

    try {
      const { getPublicKey, finalizeEvent } = await import('nostr-tools')
      const pubkey = getPublicKey(privkey)

      // Build kind 10006 event - ONLY with LOCAL ignores, not synced ones
      const event = {
        kind: 10006,
        created_at: Math.floor(Date.now() / 1000),
        tags: Array.from(this.localIgnoredRelays).map(relay => ['relay', relay]),
        content: '',
        pubkey
      }

      const signedEvent = finalizeEvent(event, privkey)

      this.log.info(`Publishing kind 10006 with ${this.localIgnoredRelays.size} LOCAL blocked relays to ${this.publishRelays.length} relays`)

      // Publish to configured relays
      const publishPromises = this.publishRelays.map(relay =>
        this.pool.publish([relay], signedEvent).catch(e => {
          this.log.error(`Failed to publish to ${relay}: ${e.message}`)
          return null
        })
      )

      await Promise.allSettled(publishPromises)

      // Reset change flag after successful publish
      this.localIgnoreListChanged = false
      this.log.info('Kind 10006 published successfully')

    } catch (e) {
      this.log.error(`Error publishing kind 10006: ${e.message}`)
    }
  }

  /**
   * Close the pool connections
   */
  close() {
    this.pool.close(this.staticRelays)
    this.pool.close(this.publishRelays)
  }
}
