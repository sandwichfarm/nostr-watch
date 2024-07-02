import { NostrEvent, NDKRelayMeta } from "@nostr-dev-kit/ndk";
import $RelayDb from "./db";

export const addRelayMetaEvent = async (event: NDKRelayMeta) => {
  if(!event?.id) return false
  return addNostrEvent(event.rawEvent() as NostrEvent)
};

export const addNostrEvent = async (event: NostrEvent) => {
  if(!event?.id) return false
  await $RelayDb.events.add({
    nid: event.id as string,
    monitorPubkey: event.pubkey,
    relay: event.tags.find( t => t[0] === 'd')?.[1],
    createdAt: event.created_at,
    event
  });
};