import { Event, type NostrEvent } from "npm:@nostrwatch/publisher";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { getLogger } from "../utils/logger.ts";

const logger = getLogger("Kind20066");

export interface Kind20066EventData {
  url: string;
  operationalStatus: "init" | "down" | "up";  // State transition (required)
  online: boolean;
  rttOpen?: number;
  retryCount?: number;
}

/**
 * Kind 20066 Event Builder for Ephemeral Relay State Changes
 *
 * Ephemeral events (20000-29999) that broadcast state changes in real-time.
 * Only published when operational status changes (init/down/up).
 * Not stored by relays - for live monitoring only.
 */
export class Kind20066 extends Event {
  constructor(pubkey: string) {
    super(20066, pubkey);
  }

  /**
   * Generate tags for the Kind 20066 event
   */
  private generateTags(data: Kind20066EventData): string[][] {
    const tags: string[][] = [];

    // Always include the relay URL as 'r' tag (reference)
    tags.push(['r', data.url]);

    // Operational status (required for this event type)
    tags.push(['O', data.operationalStatus]);

    // Add RTT if online
    if (data.online && data.rttOpen !== undefined && data.rttOpen > 0) {
      tags.push(['rtt-open', String(Math.round(data.rttOpen))]);
    }

    // Add retry count if offline
    if (!data.online && data.retryCount !== undefined) {
      tags.push(['retry', String(data.retryCount)]);
    }

    logger.debug(`Generated ephemeral state change event for ${data.url}: ${data.operationalStatus}`);

    return tags;
  }

  /**
   * Generate an unsigned Kind 20066 event (override from Event class)
   */
  protected _generateEvent(data: Kind20066EventData): NostrEvent {
    const tags = this.generateTags(data);
    const now = Math.floor(Date.now() / 1000);

    return {
      kind: 20066,
      pubkey: this.pubkey,
      created_at: now,
      tags,
      content: "", // Empty content, all data in tags
    };
  }

  /**
   * Generate and sign a Kind 20066 event in one call
   */
  async generateAndSignEvent(data: Kind20066EventData, privkey: string): Promise<any> {
    const unsignedEvent = this.generateEvent(data);
    const signedEvent = finalizeEvent(unsignedEvent, hexToBytes(privkey));
    return signedEvent;
  }
}

/**
 * Helper function to create a Kind 20066 event
 */
export async function createKind20066Event(
  pubkey: string,
  data: Kind20066EventData,
  privkey: string
): Promise<any> {
  const builder = new Kind20066(pubkey);
  return builder.generateAndSignEvent(data, privkey);
}
