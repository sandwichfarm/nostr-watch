import { derived, writable, type Writable } from "svelte/store";
import { type INip11 } from "@nostrwatch/nip66/models"
import { deterministicHash } from "@nostrwatch/nip66/utils";

import { eventsArray } from './events.js'; 
import { Nip11Service } from "$lib/services/Nip11Service/index.js";
export type LocalNip11  = any

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());

export const nip11sLocal: Writable<Map<string, LocalNip11>> = writable(new Map())

const processNip11 = ( json: any ) => {
  const result = { json: null, hash: null }
  try {
    if(json instanceof Object ) {
      result.json = json
    }
    else {
      result.json = JSON.parse(json);
    }
    result.hash = deterministicHash(json);
  } catch (error) {
    console.error('Failed to parse JSON content:', error);
  }
  return result;
}

export const nip11s = derived([eventsArray, nip11sLocal], ([$eventsArray, $nip11sLocal]) => {
  if (!$eventsArray || $eventsArray.length === 0) {
    return new Map();
  }

  const nip11Map = new Map();

  const updateEntry = (relay: string, nip11Entry: INip11) => {
    let existing = nip11Map.get(relay);
    if(!existing) existing = []
    existing.push(nip11Entry)
    nip11Map.set(relay, existing);
  }

  $eventsArray.forEach((event) => {
    const relayTag = event.tags.find((tag: string[]) => tag[0] === 'd');
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
    if (!event?.content || event.content.length <= 2)  return 
    const { json, hash } = processNip11(event.content)
    if(!json || !hash) return 
    const nip11Entry: INip11 = {
      relay,
      monitorPubkey,
      hash,
      nid,
      created_at,
      json,
    };
    updateEntry(relay, nip11Entry)
  });

  for(const localNip11 of $nip11sLocal) {
    const [ relay, json ] = localNip11
    const created_at = Math.round(Date.now()/1000)
    const monitorPubkey = 'currentUser';
    const { hash } = processNip11(json)
    const nid = null; 
    const nip11Entry: INip11 = {
      relay,
      monitorPubkey,
      hash,
      nid,
      created_at,
      json,
    };
    updateEntry(relay, nip11Entry)
  }
  return nip11Map;
});
