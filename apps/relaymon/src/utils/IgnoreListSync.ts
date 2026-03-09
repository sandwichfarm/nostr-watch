import { getLogger } from "./logger.ts";
import { SimplePool, nip19, getPublicKey } from "npm:nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import type { Event } from "npm:nostr-tools";
import { normalizeURL } from "npm:nostr-tools/utils";
import { db } from "../db/db.ts";
import type { Config, IgnoreListConfig } from "../types/config.ts";
import { getErrorMessage } from "../types/errors.ts";

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
  private logger = getLogger("IgnoreListSync");
  private fullConfig: Config;
  private config: IgnoreListConfig;
  private enabled: boolean;
  private nip66Relays: string[];
  private listRelays: string[];
  private syncPubkeys: string[];
  private metaRelays: string[];
  private pool: SimplePool;
  private ignoredRelays: Map<string, string> = new Map();
  private localIgnoredRelays: Map<string, string> = new Map();
  private localIgnoreListChanged: boolean = false;

  constructor(config: Config, metaRelays: string[]) {
    this.fullConfig = config;
    this.config = config?.relaymon?.ignorelist || {
      enabled: false,
      interval: "6h",
      deletion_interval: "24h",
      relays: [],
      pubkeys: []
    };
    this.enabled = this.config.enabled || false;
    this.nip66Relays = config?.publisher?.relays || [];
    this.listRelays = this.config?.relays || [];
    this.syncPubkeys = this.config?.pubkeys || [];
    this.metaRelays = metaRelays;
    this.pool = new SimplePool();

    if (this.enabled) {
      this.logger.info(`IgnoreListSync initialized with ${this.syncPubkeys.length} pubkeys`);
      this.logger.info(`Publishing kind 10006 to: ${this.listRelays.join(", ")}`);
      this.loadLocalIgnoresFromDB();
    }
  }

  /**
   * Load local ignored relays from SQLite database
   */
  async loadLocalIgnoresFromDB(): Promise<void> {
    try {
      const results = db.query(`SELECT url, ignore_reason FROM relay_status WHERE ignore = 1`);

      const previousSize = this.localIgnoredRelays.size;

      this.localIgnoredRelays.clear();
      for (const [url, reason] of results) {
        const normalizedUrl = normalizeURL(url as string);
        const reasonStr = (reason as string) || "";
        this.localIgnoredRelays.set(normalizedUrl, reasonStr);
        this.ignoredRelays.set(normalizedUrl, reasonStr);
      }

      if (this.localIgnoredRelays.size !== previousSize) {
        this.localIgnoreListChanged = true;
      }

      this.logger.info(`Loaded ${this.localIgnoredRelays.size} ignored relays from database`);
    } catch (e: unknown) {
      this.logger.error(`Error loading ignored relays from database: ${getErrorMessage(e)}`);
    }
  }

  /**
   * Convert a pubkey in various formats (hex, npub, nprofile) to hex
   * Returns null if input is invalid
   */
  private toHexPubkey(input: string): string | null {
    try {
      const pk = (input || "").trim();
      if (!pk) return null;

      // If already hex (64 chars) use it
      if (/^[0-9a-fA-F]{64}$/.test(pk)) return pk.toLowerCase();

      // Try to decode NIP-19 (npub/nprofile)
      if (pk.startsWith("npub1") || pk.startsWith("nprofile1")) {
        const decoded = nip19.decode(pk);
        if (decoded.type === "npub") {
          return (decoded.data as string).toLowerCase();
        }
        if (decoded.type === "nprofile") {
          // nprofile.data may be an object with pubkey
          const data = decoded.data as unknown as { pubkey?: string };
          if (data && typeof data.pubkey === "string" && /^[0-9a-fA-F]{64}$/.test(data.pubkey)) {
            return data.pubkey.toLowerCase();
          }
        }
      }

      // Anything else is invalid for authors filter
      return null;
    } catch (_e) {
      return null;
    }
  }

  /**
   * Get relays to append to this monitor's kind 10002
   */
  getRelaysForKind10002(): string[] {
    return this.enabled ? this.listRelays : [];
  }

  /**
   * Add a relay to this monitor's local ignore list
   */
  addToIgnoreList(relayUrl: string, reason: string = ""): void {
    const normalized = normalizeURL(relayUrl);
    const isNew = !this.localIgnoredRelays.has(normalized);
    this.localIgnoredRelays.set(normalized, reason);
    this.ignoredRelays.set(normalized, reason);

    if (isNew) {
      this.localIgnoreListChanged = true;
      this.logger.info(`Added ${normalized} to local ignore list (total: ${this.localIgnoredRelays.size})`);
    }
  }

  /**
   * Remove a relay from this monitor's local ignore list
   */
  removeFromIgnoreList(relayUrl: string): void {
    const normalized = normalizeURL(relayUrl);
    this.localIgnoredRelays.delete(normalized);
    this.logger.debug(`Removed ${normalized} from local ignore list`);
  }

  /**
   * Check if a relay is in the merged ignore list
   */
  isIgnored(relayUrl: string): boolean {
    try {
      const normalized = normalizeURL(relayUrl);
      return this.ignoredRelays.has(normalized);
    } catch (e: unknown) {
      this.logger.error(`Error checking if relay is ignored: ${getErrorMessage(e)}`);
      return false;
    }
  }

  /**
   * Get the ignore reason for a relay from the merged ignore list
   */
  getIgnoreReason(relayUrl: string): string {
    try {
      const normalized = normalizeURL(relayUrl);
      return this.ignoredRelays.get(normalized) || "";
    } catch (e: unknown) {
      return "";
    }
  }

  /**
   * Fetch kind 10002 (relay list) for a pubkey from static relays
   */
  async fetchKind10002(pubkey: string): Promise<string[]> {
    try {
      this.logger.info(`Fetching kind 10002 for ${pubkey.slice(0, 8)}... from ${this.metaRelays.length} relays`);
      this.logger.info(`  Meta relays: ${this.metaRelays.join(", ")}`);

      const hex = this.toHexPubkey(pubkey);
      if (!hex) {
        this.logger.warn(`Invalid pubkey format for authors filter: ${pubkey}`);
        return [];
      }

      const events = await this.pool.querySync(this.metaRelays, {
        kinds: [10002],
        authors: [hex],
        limit: 1,
      });

      this.logger.info(`  Received ${events?.length || 0} kind 10002 events for ${pubkey.slice(0, 8)}...`);

      if (!events || events.length === 0) {
        this.logger.warn(`No kind 10002 found for ${pubkey.slice(0, 8)}... on relays: ${this.metaRelays.join(", ")}`);
        return [];
      }

      const event = events[0];
      this.logger.info(`  Event created_at: ${new Date(event.created_at * 1000).toISOString()}`);
      this.logger.info(`  Total tags: ${event.tags.length}`);

      const relays = event.tags
        .filter((tag: string[]) => tag[0] === "relay" || tag[0] === "r")
        .map((tag: string[]) => tag[1])
        .filter(Boolean);

      this.logger.info(`Found ${relays.length} relays in kind 10002 for ${pubkey.slice(0, 8)}...`);
      if (relays.length > 0) {
        this.logger.info(`  First 3 relays: ${relays.slice(0, 3).join(", ")}`);
      }
      return relays;
    } catch (e: unknown) {
      this.logger.error(`Error fetching kind 10002 for ${pubkey.slice(0, 8)}...: ${getErrorMessage(e)}`);
      this.logger.error(`  Stack: ${e.stack}`);
      return [];
    }
  }

  /**
   * Fetch kind 10006 (blocked relays) for a pubkey from their relays
   */
  async fetchKind10006(pubkey: string, relays: string[]): Promise<Array<{url: string, reason: string}>> {
    try {
      this.logger.debug(`Fetching kind 10006 for ${pubkey.slice(0, 8)}... from ${relays.length} relays`);

      const hex = this.toHexPubkey(pubkey);
      if (!hex) {
        this.logger.warn(`Invalid pubkey format for authors filter: ${pubkey}`);
        return [];
      }

      const events = await this.pool.querySync(relays, {
        kinds: [10006],
        authors: [hex],
        limit: 1,
      });

      if (!events || events.length === 0) {
        this.logger.debug(`No kind 10006 found for ${pubkey.slice(0, 8)}...`);
        return [];
      }

      const event = events[0];
      const blockedRelays = event.tags
        .filter((tag: string[]) => tag[0] === "relay" || tag[0] === "r")
        .filter((tag: string[]) => Boolean(tag[1]))
        .map((tag: string[]) => ({ url: normalizeURL(tag[1]), reason: tag[2] || "" }));

      this.logger.info(`Found ${blockedRelays.length} blocked relays from ${pubkey.slice(0, 8)}...`);
      return blockedRelays;
    } catch (e: unknown) {
      this.logger.error(`Error fetching kind 10006 for ${pubkey.slice(0, 8)}...: ${getErrorMessage(e)}`);
      return [];
    }
  }

  /**
   * Sync ignore lists from all configured pubkeys
   */
  async sync(): Promise<void> {
    if (!this.enabled) {
      this.logger.info("IgnoreListSync is disabled, skipping sync");
      return;
    }

    if (this.syncPubkeys.length === 0) {
      this.logger.info("No pubkeys configured for sync, skipping");
      return;
    }

    this.logger.info(`Syncing ignore lists from ${this.syncPubkeys.length} pubkeys...`);

    const allIgnoredRelays = new Map<string, string>();

    for (const pubkey of this.syncPubkeys) {
      try {
        const relays = await this.fetchKind10002(pubkey);
        if (relays.length === 0) {
          this.logger.warn(`No relays found for ${pubkey.slice(0, 8)}..., using meta relays`);
        }

        const blockedRelays = await this.fetchKind10006(
          pubkey,
          relays.length > 0 ? relays : this.metaRelays
        );

        const pubkey8 = pubkey.slice(0, 8);
        for (const { url, reason } of blockedRelays) {
          // Construct propagation reason with attribution
          const propagationReason = reason
            ? `Propagated block from monitor ${pubkey8}: ${reason}`
            : `Propagated block from monitor ${pubkey8}`;
          allIgnoredRelays.set(url, propagationReason);
        }
      } catch (e: unknown) {
        this.logger.error(`Error syncing ignore list for ${pubkey.slice(0, 8)}...: ${getErrorMessage(e)}`);
      }
    }

    const previousIgnored = new Map(this.ignoredRelays);
    this.ignoredRelays = new Map([...this.localIgnoredRelays, ...allIgnoredRelays]);
    this.logger.info(`Total ignore list size: ${this.ignoredRelays.size} (local: ${this.localIgnoredRelays.size}, synced: ${allIgnoredRelays.size})`);

    // Send Kind 5 deletions for newly-synced blocked relays
    const { deleteRelayCheckEvent } = await import("./deletion.ts");
    for (const [relay, reason] of allIgnoredRelays) {
      if (!previousIgnored.has(relay)) {
        this.logger.info(`Sending deletion for remotely-synced blocked relay: ${relay}`);
        try {
          await deleteRelayCheckEvent(
            relay,
            reason,
            this.fullConfig
          );
        } catch (e) {
          this.logger.error(`Failed to send deletion for synced relay ${relay}: ${getErrorMessage(e)}`);
        }
      }
    }
  }

  /**
   * Publish this monitor's kind 10006 (blocked relays list)
   */
  async publish(privkey: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug("IgnoreListSync is disabled, skipping publish");
      return;
    }

    if (!this.localIgnoreListChanged) {
      this.logger.debug("Local ignore list has not changed, skipping publish");
      return;
    }

    try {
      const pubkey = getPublicKey(hexToBytes(privkey));
      const event: Partial<Event> = {
        kind: 10006,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ...Array.from(this.localIgnoredRelays.entries()).map(([url, reason]) =>
            reason ? ["r", url, reason] : ["r", url]
          ),
          ["client", "@nostrwatch/relaymon"],
        ],
        content: "",
        pubkey,
      };

      // Sign the event
      const { finishEvent } = await import("npm:nostr-tools");
      const signedEvent = finishEvent(event, hexToBytes(privkey));

      // Publish to configured relays
      const publishPromises = this.listRelays.map(async (relay) => {
        try {
          await this.pool.publish([relay], signedEvent);
          this.logger.debug(`Published kind 10006 to ${relay}`);
        } catch (e: unknown) {
          this.logger.error(`Failed to publish kind 10006 to ${relay}: ${getErrorMessage(e)}`);
        }
      });

      await Promise.all(publishPromises);
      this.logger.info(`Published kind 10006 with ${this.localIgnoredRelays.size} ignored relays`);
      this.localIgnoreListChanged = false;
    } catch (e: unknown) {
      this.logger.error(`Error publishing kind 10006: ${getErrorMessage(e)}`);
    }
  }

  /**
   * Publish NIP-09 deletion events for all locally ignored relays
   */
  async publishDeletions(privkey: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug("IgnoreListSync is disabled, skipping deletions");
      return;
    }

    this.logger.info(`Publishing NIP-09 deletions for ${this.localIgnoredRelays.size} ignored relays...`);

    // Import deletion utility
    const { deleteRelayCheckEvent } = await import("./deletion.ts");

    let deletionCount = 0;
    for (const [relayUrl, reason] of this.localIgnoredRelays) {
      try {
        const ok = await deleteRelayCheckEvent(
          relayUrl,
          reason || "Relay marked as ignored by deduplication",
          this.fullConfig
        );
        if (ok) deletionCount++;
      } catch (e: unknown) {
        this.logger.error(`Error publishing deletion for ${relayUrl}: ${getErrorMessage(e)}`);
      }
    }

    this.logger.info(`Published ${deletionCount} NIP-09 deletion events`);
  }

  /**
   * Close all pool connections
   */
  close(): void {
    this.pool.close(this.metaRelays);
    this.pool.close(this.listRelays);
  }
}
