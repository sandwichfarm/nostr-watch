import { derived } from "svelte/store";
import type { INip11 } from "@nostrwatch/nip66/models"
import { deterministicHash } from "@nostrwatch/nip66/utils";

import { eventsArray } from './events.js'; 

export const nip11s = derived(eventsArray, ($eventsArray) => {
  if (!$eventsArray || $eventsArray.length === 0) {
    return new Map();
  }

  const nip11Map = new Map();

  $eventsArray.forEach((event) => {
    const relayTag = event.tags.find((tag) => tag[0] === 'd');
    if (!relayTag || !relayTag[1]) return;

    let relay;
    try {
      relay = new URL(relayTag[1]).toString();
    } catch (error) {
      console.error('Invalid relay URL:', relayTag[1]);
      return;
    }

    const monitorPubkey = event.pubkey;
    const nid = event.id;
    const created_at = event.created_at;

    let json = null;
    let hash = null;

    if (event.content && event.content.length > 2) {
      try {
        json = JSON.parse(event.content);
        hash = deterministicHash(json);
      } catch (error) {
        console.error('Failed to parse JSON content:', error);
      }
    }

    if(!json) return 

    const nip11Entry: INip11 = {
      relay,
      monitorPubkey,
      hash,
      nid,
      created_at,
      json,
    };

    // Add or update the entry in the Map
    nip11Map.set(relay, nip11Entry);
  });

  return nip11Map;
});
