import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { Nip66Event, type INip11 } from "@nostrwatch/nip66/models"
import { deterministicHash } from "@nostrwatch/nip66/utils";

import { eventsArray } from './events.js'; 
import { Nip11Service } from "$lib/services/Nip11Service";
import { StateManager } from "@nostrwatch/nip66";
import { compress, decompress } from "compress-json";
import { Nip11 } from "@nostrwatch/nip66/models";
import { doAggregateCache, hasBeenBoostrapped, hasBeenSeeded } from "./app.js";
import type { RelayInformation } from "@nostrwatch/nip66/models";
import type { nip11 } from "nostr-tools";

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

export const nip11s = derived(
    [eventsArray, nip11sLocal], 
    ([$eventsArray, $nip11sLocal]
  ) => {
    
    let nip11Map = new Map();

    const updateEntry = (relay: string, nip11Entry: Nip11) => {
      let existing = nip11Map.get(relay);
      if(!existing) existing = []
      existing.push(nip11Entry)
      nip11Map.set(relay, existing);
    }

    let nip66Nip11s: number = 0
    let localNip11s: number = 0

    $eventsArray.forEach((event: Nip66Event) => {
      if(!event.nip11 || !event.relay) return;
      updateEntry(event.relay, event.nip11)
      nip66Nip11s++;
    });

    for(const relayUrl of $nip11sLocal.keys()) {
      const nip11 = $nip11sLocal.get(relayUrl)
      if(!nip11) continue;
      updateEntry(relayUrl, nip11)
      localNip11s++
    }

    const totalWithotLocal = nip66Nip11s - localNip11s

    if( totalWithotLocal > 0 && hasBeenBoostrapped() && hasBeenSeeded() && get(doAggregateCache) === true ) {
      StateManager.set('aggregate:nip11s', compress(
        Array.from(nip11Map.entries()).map(([relay, entries]) => [relay, entries.map((nip11: Nip11) => nip11.json)])
      ));
    }
    else if( hasBeenSeeded() ){
      console.log('!!! HAS BEEN SEEDED')
      const cachedMap = StateManager.get('aggregate:nip11s')
      console.log('cached nip11 compressed', nip11Map)
      if (cachedMap) {
        try {
          let decompressed = decompress(cachedMap);
          if (Array.isArray(decompressed)) {
            decompressed = decompressed.map( ([relay, entries]: [string, RelayInformation[]]) => [relay, entries?.map( (nip11: RelayInformation) => new Nip11(nip11) )] )
            nip11Map = new Map(decompressed);
            console.log('nip11Map cached nip11Map', nip11Map);
          } else {
            console.error('nip11Map Decompressed value is not a valid array:', decompressed);
          }
        } catch (e) {
          console.error('nip11Map Error during decompression:', e);
        }
      }
    }
    else {
      // console.log('!!! HAS NOT BEEN BOOTSTRAPPED OR SEEDED')
    }
      
    return nip11Map;
});
