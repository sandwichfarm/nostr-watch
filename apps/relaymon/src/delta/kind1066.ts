import { Event, type NostrEvent } from "npm:@nostrwatch/publisher";
import { finalizeEvent } from "nostr-tools/pure";
import { hexToBytes } from "@noble/hashes/utils";
import { getLogger } from "../utils/logger.ts";
import { deltasToTags, type Delta } from "./detector.ts";

const logger = getLogger("Kind1066");

export interface Kind1066EventData {
  url: string;
  online: boolean;
  retryCount?: number;
  rttOpen?: number;
  deltas: Delta[];
  periods?: string[];  // Period tags (e.g., ["6h", "1d", "7d"])
}

/**
 * Kind 1066 Event Builder for Relay Delta Events
 *
 * Generates delta events that track changes in relay state over time.
 * - When online: includes rtt-open + delta tags
 * - When offline: includes retry count only (no deltas)
 */
export class Kind1066 extends Event {
  constructor(pubkey: string) {
    super(1066, pubkey);
  }

  /**
   * Generate tags for the Kind 1066 event
   */
  private generateTags(data: Kind1066EventData): string[][] {
    const tags: string[][] = [];

    // Always include the relay URL as 'd' tag (identifier)
    tags.push(['d', data.url]);

    // Add period tags (T tags) if provided - cascading from shortest to longest
    if (data.periods && data.periods.length > 0) {
      for (const period of data.periods) {
        tags.push(['T', period]);
      }
      logger.debug(`Added ${data.periods.length} period tags: ${data.periods.join(', ')}`);
    }

    if (data.online) {
      // Online event: include rtt-open and deltas
      if (data.rttOpen !== undefined && data.rttOpen > 0) {
        tags.push(['rtt-open', String(Math.round(data.rttOpen))]);
      }

      // Add delta tags (changes, additions, removals)
      const deltaTags = deltasToTags(data.deltas);
      tags.push(...deltaTags);

      logger.debug(`Generated online delta event for ${data.url} with ${data.deltas.length} deltas`);
    } else {
      // Offline event: only include retry count
      const retryCount = data.retryCount ?? 0;
      tags.push(['retry', String(retryCount)]);

      logger.debug(`Generated offline delta event for ${data.url} with retry count ${retryCount}`);
    }

    return tags;
  }

  /**
   * Generate an unsigned Kind 1066 event (override from Event class)
   */
  protected _generateEvent(data: Kind1066EventData): NostrEvent {
    const tags = this.generateTags(data);
    const now = Math.floor(Date.now() / 1000);

    return {
      kind: 1066,
      pubkey: this.pubkey,
      created_at: now,
      tags,
      content: "", // Empty content, all data in tags
    };
  }

  /**
   * Generate and sign a Kind 1066 event in one call
   */
  async generateAndSignEvent(data: Kind1066EventData, privkey: string): Promise<any> {
    const unsignedEvent = this.generateEvent(data);
    const signedEvent = finalizeEvent(unsignedEvent, hexToBytes(privkey));
    return signedEvent;
  }
}

/**
 * Helper function to create a Kind 1066 event
 */
export async function createKind1066Event(
  pubkey: string,
  data: Kind1066EventData,
  privkey: string
): Promise<any> {
  const builder = new Kind1066(pubkey);
  return builder.generateAndSignEvent(data, privkey);
}
