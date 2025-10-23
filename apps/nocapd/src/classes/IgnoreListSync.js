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
  constructor(config, metaRelays, rcache) {
    this.log = new Logger('@nostrwatch/nocapd:ignorelist')
    this.config = config?.nocapd?.ignorelist || {}
    this.enabled = this.config.enabled || false
    this.publishRelays = this.config?.relays || []
    this.syncPubkeys = this.config?.pubkeys || []
    this.metaRelays = metaRelays // Where to find kind 10002 events
    this.rcache = rcache // LMDB cache to read/write ignored relays
    this.pool = new SimplePool()
    this.ignoredRelays = new Set() // Merged ignore list from all monitors
    this.localIgnoredRelays = new Set() // This monitor's own ignore list
    this.localIgnoreListChanged = false // Track if local list has changed

    if (this.enabled) {
      this.log.info(`IgnoreListSync initialized with ${this.syncPubkeys.length} pubkeys`)
      this.log.info(`Publishing kind 10006 to: ${this.publishRelays.join(', ')}`)
      // Load existing ignored relays from LMDB
      this.loadLocalIgnoresFromCache()
    }
  }

  /**
   * Load local ignored relays from LMDB cache
   */
  async loadLocalIgnoresFromCache() {
    if (!this.rcache) {
      this.log.warn('No rcache provided, cannot load ignored relays from LMDB')
      return
    }

    try {
      const allRelays = await this.rcache.relay.get.all()
      const ignoredRelays = allRelays.filter(r => r.ignore === true)

      const previousSize = this.localIgnoredRelays.size

      // Clear and repopulate the sets
      this.localIgnoredRelays.clear()
      ignoredRelays.forEach(relay => {
        this.localIgnoredRelays.add(relay.url)
        this.ignoredRelays.add(relay.url)
      })

      // If size changed or this is first load, mark as changed
      if (this.localIgnoredRelays.size !== previousSize) {
        this.localIgnoreListChanged = true
      }

      this.log.info(`Loaded ${this.localIgnoredRelays.size} ignored relays from LMDB`)
    } catch (e) {
      this.log.error(`Error loading ignored relays from LMDB: ${e.message}`)
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
      this.log.info(`Added ${normalized} to local ignore list (total: ${this.localIgnoredRelays.size})`)
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
        this.metaRelays,
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
      this.log.info('IgnoreListSync is disabled, skipping sync')
      return
    }

    if (this.syncPubkeys.length === 0) {
      this.log.info('No pubkeys configured for sync, skipping')
      return
    }

    this.log.info(`Starting ignore list sync from ${this.syncPubkeys.length} monitors...`)

    // Reload local ignores from LMDB first
    await this.loadLocalIgnoresFromCache()

    // Reset the synced portion of ignore list (keep local ones)
    this.ignoredRelays = new Set(this.localIgnoredRelays)

    for (const pubkey of this.syncPubkeys) {
      try {
        // Step 1: Fetch their kind 10002 from static relays
        this.log.info(`Fetching kind 10002 for monitor ${pubkey.slice(0, 8)}...`)
        const theirRelays = await this.fetchKind10002(pubkey)

        if (theirRelays.length === 0) {
          this.log.warn(`Skipping ${pubkey.slice(0, 8)}... - no relays found in kind 10002`)
          continue
        }

        // Step 2: Fetch their kind 10006 from their relays
        this.log.info(`Fetching kind 10006 for monitor ${pubkey.slice(0, 8)}... from ${theirRelays.length} relays`)
        const blockedRelays = await this.fetchKind10006(pubkey, theirRelays)

        // Step 3: Merge into our ignore list
        blockedRelays.forEach(relay => this.ignoredRelays.add(relay))

      } catch (e) {
        this.log.error(`Error syncing from ${pubkey.slice(0, 8)}...: ${e.message}`)
      }
    }

    this.log.info(`Sync complete. Total ignored relays: ${this.ignoredRelays.size} (${this.localIgnoredRelays.size} local, ${this.ignoredRelays.size - this.localIgnoredRelays.size} synced)`)
  }

  /**
   * Publish this monitor's kind 10006 (blocked relays) - ONLY if local list changed
   * Only publishes LOCAL ignores, not synced ones from other monitors
   */
  async publish(privkey) {
    if (!this.enabled) {
      this.log.info('IgnoreListSync is disabled, skipping publish')
      return
    }

    if (!this.localIgnoreListChanged) {
      this.log.info(`Local ignore list has not changed (${this.localIgnoredRelays.size} total local ignores), skipping publish`)
      return
    }

    if (this.publishRelays.length === 0) {
      this.log.warn('No relays configured for publishing kind 10006')
      return
    }

    if (this.localIgnoredRelays.size === 0) {
      this.log.info('No local ignored relays to publish')
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

      // pool.publish() returns an array of Promises (one per relay)
      const publishPromises = this.pool.publish(this.publishRelays, signedEvent)

      // Wait for all relays to respond (or fail)
      const results = await Promise.allSettled(publishPromises)

      // Log results
      let successCount = 0
      results.forEach((result, index) => {
        const relay = this.publishRelays[index]
        if (result.status === 'fulfilled') {
          successCount++
          this.log.debug(`Published kind 10006 to ${relay}`)
        } else {
          this.log.error(`Failed to publish kind 10006 to ${relay}: ${result.reason}`)
        }
      })

      // Reset change flag after successful publish
      this.localIgnoreListChanged = false
      this.log.info(`Kind 10006 published to ${successCount}/${this.publishRelays.length} relays`)

    } catch (e) {
      this.log.error(`Error publishing kind 10006: ${e.message}`)
    }
  }

  /**
   * Publish NIP-09 deletion events for all locally ignored relays
   * Uses "a" tags to delete addressable events (kind 30166) without knowing event IDs
   */
  async publishDeletions(privkey) {
    if (!this.enabled) {
      this.log.info('IgnoreListSync is disabled, skipping deletion publish')
      return
    }

    if (this.publishRelays.length === 0) {
      this.log.warn('No relays configured for publishing deletions')
      return
    }

    if (this.localIgnoredRelays.size === 0) {
      this.log.info('No local ignored relays to publish deletions for')
      return
    }

    try {
      const { getPublicKey, finalizeEvent } = await import('nostr-tools')
      const pubkey = getPublicKey(privkey)

      // Build kind 5 (deletion) event with "a" tags for each ignored relay
      // Format: kind:pubkey:d-identifier where d-identifier is the relay URL
      const aTags = Array.from(this.localIgnoredRelays).map(relayUrl =>
        ['a', `30166:${pubkey}:${relayUrl}`]
      )

      const event = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['k', '30166'], // Indicate we're deleting kind 30166 events
          ...aTags
        ],
        content: 'Deleting duplicate/ignored relay reports',
        pubkey
      }

      const signedEvent = finalizeEvent(event, privkey)

      this.log.info(`Publishing NIP-09 deletion for ${this.localIgnoredRelays.size} ignored relays to ${this.publishRelays.length} relays`)

      // pool.publish() returns an array of Promises (one per relay)
      const publishPromises = this.pool.publish(this.publishRelays, signedEvent)

      // Wait for all relays to respond (or fail)
      const results = await Promise.allSettled(publishPromises)

      // Log results
      let successCount = 0
      results.forEach((result, index) => {
        const relay = this.publishRelays[index]
        if (result.status === 'fulfilled') {
          successCount++
          this.log.debug(`Published deletion to ${relay}`)
        } else {
          this.log.error(`Failed to publish deletion to ${relay}: ${result.reason}`)
        }
      })

      this.log.info(`NIP-09 deletions published to ${successCount}/${this.publishRelays.length} relays`)

    } catch (e) {
      this.log.error(`Error publishing deletion events: ${e.message}`)
    }
  }

  /**
   * Close the pool connections
   */
  close() {
    this.pool.close(this.metaRelays)
    this.pool.close(this.publishRelays)
  }
}
