import type { Event as SignedEvent } from "nostr-tools";
/** An owned lease on an ACK-aware transport. Closing a lease must not close
 * another Publisher's connections. Fulfillment means a positive relay ACK. */
export interface PublishTransport {
  publish(relay: string, signedEvent: SignedEvent): Promise<unknown>;
  release(): void | Promise<void>;
}

export type PublisherFactory = (
  pubkey: string,
  relays: string[],
) => import("./Publisher.js").Publisher;
