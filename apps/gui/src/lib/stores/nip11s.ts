import { derived, writable, type Readable, type Writable } from "svelte/store";
import { Nip66Event, type INip11 } from "@nostrwatch/nip66/models"
import { deterministicHash } from "@nostrwatch/nip66/utils";

import { eventsArray } from './events.js'; 
import { Nip11Service } from "$lib/services/Nip11Service";
import { StateManager } from "@nostrwatch/nip66";
import { compress, decompress } from "compress-json";
import { Nip11 } from "@nostrwatch/nip66/models";

type RelayUrl = string

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());

export const nip11sLocal: Writable<Map<string, Nip11>> = writable(new Map())

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
  let nip11Map = new Map();

  const updateEntry = (relay: string, nip11Entry: Nip11) => {
    let existing = nip11Map.get(relay);
    if(!existing) existing = []
    existing.push(nip11Entry)
    nip11Map.set(relay, existing);
  }

  let nip66Nip11s: number = 0

  $eventsArray.forEach((event: Nip66Event) => {
    if(!event.nip11 || !event.relay) return;
    updateEntry(event.relay, event.nip11)
    nip66Nip11s++;
  });

  for(const relayUrl of $nip11sLocal.keys()) {
    const nip11 = $nip11sLocal.get(relayUrl)
    if(!nip11) continue;
    updateEntry(relayUrl, nip11)
  }

  let nip11Array = Array.from(nip11Map.entries())
  if(nip11Array.length) {
    StateManager.set('aggregate:nip11s', compress(nip11Array))
  }
  if(nip66Nip11s !== 0) {
    const cachedMap = StateManager.get('aggregate:nip11s')
    if(cachedMap ){
      nip11Map = new Map(decompress(cachedMap));
      console.log('cached nip11Map', nip11Map)
    }
  }
  return nip11Map;
});

nip11s.subscribe(($nip11s) => {
  
})
