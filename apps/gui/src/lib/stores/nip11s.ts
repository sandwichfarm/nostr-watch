import { derived, writable, type Readable, type Writable } from "svelte/store";
import { type INip11 } from "@nostrwatch/nip66/models"
import { deterministicHash } from "@nostrwatch/nip66/utils";

import { eventsArray } from './events.js'; 
import { Nip11Service } from "$lib/services/Nip11Service/index.js";
import { StateManager } from "@nostrwatch/nip66";
import { compress, decompress } from "compress-json";
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
  // if (!$eventsArray || $eventsArray.length === 0) {
  //   return new Map();
  // }

  let nip11Map = new Map();

  const updateEntry = (relay: string, nip11Entry: INip11) => {
    let existing = nip11Map.get(relay);
    if(!existing) existing = []
    existing.push(nip11Entry)
    nip11Map.set(relay, existing);
  }

  let nip66Nip11s: number = 0

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
    if (!event?.content || event.content.length <= 2 || !created_at)  return 
    const json = event?.nip11?.json 
    const hash = event?.nip11?.hash
    if(!json || !hash) return 
    nip66Nip11s++;
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

  // ( async () => {
  let nip11Array = Array.from(nip11Map.entries())
  console.log('cached wtf nip11Array', nip11Array)
  if(nip11Array.length) {
    StateManager.set('aggregate:nip11s', nip11Array)
  }
  if(nip66Nip11s !== 0) {
    const cachedMap = StateManager.get('aggregate:nip11s')
    console.log('cached nip11Map array', nip11Map)
    if(cachedMap ){
      nip11Map = new Map([...cachedMap]);
      console.log('cached nip11Map', nip11Map)
    }
  }
  // })()

  return nip11Map;
});

nip11s.subscribe(($nip11s) => {
  
})
