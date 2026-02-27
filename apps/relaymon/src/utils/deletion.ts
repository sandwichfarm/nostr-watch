import { getLogger } from "./logger.ts";
import { Publisher, Event } from "npm:@nostrwatch/publisher";
import { getEventHash, getPublicKey } from "npm:nostr-tools";
import type { Config } from "../config/config.ts";
import type { QueueManager } from "./queueManager.ts";
import { clearDeltaState, clearPeriodSnapshots } from "../db/db.ts";
import { getPrivateKey } from "../core/daemon.ts";

const logger = getLogger("Deletion");

// Global flag to suppress deletion publishing (used during warmup)
let suppressDeletionPublishing = false;

export function setDeletionPublishSuppressed(suppressed: boolean): void {
  suppressDeletionPublishing = suppressed;
  logger.info(`Deletion publishing ${suppressed ? "suppressed" : "enabled"}`);
}

/**
 * Kind5 event class for deletion events (NIP-09)
 */
export class Kind5Event extends Event {
  constructor(pubkey: string) {
    super(5, pubkey);
  }

  /**
   * Generate a Kind 5 deletion event with a-tag (NIP-09)
   * @param data Object containing relayUrl and content
   * @returns The generated NIP-09 event
   */
  protected _generateEvent(data: { relayUrl: string, pubkey: string, content: string }): {
    kind: number;
    created_at: number;
    pubkey: string;
    content: string;
    tags: string[][];
    id: string;
  } {
    // Create an a-tag for the relay check event using the format <kind>:<pubkey>:<d-identifier>
    const aTag = `30166:${data.pubkey}:${data.relayUrl}`;

    const tags = [
      ["a", aTag],
      ["k", "30166"], // Add k tag for the kind of event being deleted
      ["client", "@nostrwatch/relaymon"],
    ];

    const event = {
      ...this.tpl(),
      content: data.content,
      tags,
    };

    const id = getEventHash(event);
    event.id = id;
    return event;
  }
}

/**
 * Track deleted relays to prevent publishing duplicate deletion events
 */
const deletedRelays = new Set<string>();

/**
 * Delete a relay check event by sending a NIP-09 deletion event with an a-tag
 * @param relayUrl The URL of the relay to delete
 * @param reason The reason for deletion
 * @param config Configuration object
 * @param queueManager Optional queue manager for publish jobs
 */
export async function deleteRelayCheckEvent(
  relayUrl: string,
  reason: string,
  config: Config,
  queueManager?: QueueManager
): Promise<boolean> {
  try {
    // Respect warmup suppression
    if (suppressDeletionPublishing) {
      logger.debug(`Suppressed deletion publish for ${relayUrl} (reason: ${reason})`);
      return false;
    }

    // Get the private key from environment
    const privkey = getPrivateKey();
    if (!privkey) {
      logger.error("Missing RELAYMON_NSEC; cannot sign deletion event.");
      return false;
    }

    // Get the public key
    const pubkey = getPublicKey(privkey);
    
    // Check if config has publish relays
    if (!config.publisher?.relays || !Array.isArray(config.publisher.relays) || config.publisher.relays.length === 0) {
      logger.warn("Publisher relay list is missing; skipping deletion.");
      return false;
    }
    
    // Check if we've already deleted this relay
    if (deletedRelays.has(relayUrl)) {
      logger.debug(`Relay ${relayUrl} already has deletion event, skipping.`);
      return false;
    }
    
    // Create and sign a Kind 5 deletion event
    const deleteEvent = new Kind5Event(pubkey);
    const generatedEvent = deleteEvent.generateEvent({
      relayUrl,
      pubkey,
      content: reason
    });
    
    const signedEvent = await deleteEvent.signEvent(privkey);
    
    // If a queue manager is provided, use it to publish the event
    if (queueManager) {
      queueManager.addPublishJob(async () => {
        try {
          // Create a publisher instance for this job
          const publisher = new Publisher(pubkey, config.publisher.relays);
          await publisher.publishEvent(signedEvent);
          logger.info(`Queued deletion event for relay ${relayUrl} using a-tag`);

          // Add to the set of deleted relays on successful publish
          deletedRelays.add(relayUrl);

          // Clear delta state and period snapshots for this relay
          clearDeltaState(relayUrl);
          clearPeriodSnapshots(relayUrl);
        } catch (error) {
          logger.error(`Error publishing deletion event for ${relayUrl}: ${error}`);
          throw error; // Rethrow to trigger retry mechanism
        }
      }, { category: 'deletion' });
      // Consider successful queuing as success
      return true;
    } else {
      // Fallback to direct publishing if no queue manager is available
      const publisher = new Publisher(pubkey, config.publisher.relays);
      await publisher.publishEvent(signedEvent);

      // Add to the set of deleted relays
      deletedRelays.add(relayUrl);

      // Clear delta state and period snapshots for this relay
      clearDeltaState(relayUrl);
      clearPeriodSnapshots(relayUrl);

      logger.info(`Published deletion event for relay ${relayUrl} using a-tag`);
      return true;
    }
  } catch (error) {
    logger.error(`Error creating deletion event for ${relayUrl}: ${error}`);
    return false;
  }
}
