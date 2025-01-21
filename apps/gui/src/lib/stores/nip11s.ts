import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { Nip66CheckEvent, type INip11 } from "@nostrwatch/route66/models"
import { deterministicHash } from "@nostrwatch/route66/utils";

import { eventsArray } from './events.js'; 
import { Nip11Service } from "$lib/services/Nip11Service";
import { StateManager } from "@nostrwatch/route66";
import { compress, decompress } from "compress-json";
import { Nip11 } from "@nostrwatch/route66/models";
import { doAggregateCache, hasBeenBoostrapped, hasBeenSeeded } from "./app.js";
import type { RelayInformation } from "@nostrwatch/route66/models";
import type { nip11 } from "nostr-tools";
import { relayCheckAggregates } from "./checks.js";
import { isPubkey } from "../utils/nostr.js";

type RelayUrl = string

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());
export const nip11sLocal: Writable<Map<string, Nip11>> = writable(new Map())

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

    $eventsArray.forEach((event: Nip66CheckEvent) => {
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
      const cachedMap = StateManager.get('aggregate:nip11s')
      if (cachedMap) {
        try {
          let decompressed = decompress(cachedMap);
          if (Array.isArray(decompressed)) {
            decompressed = decompressed.map( ([relay, entries]: [string, RelayInformation[]]) => [relay, entries?.map( (nip11: RelayInformation) => new Nip11(nip11) )] )
            nip11Map = new Map(decompressed);
          } else {
            console.error('nip11Map Decompressed value is not a valid array:', decompressed);
          }
        } catch (e) {
          console.error('nip11Map Error during decompression:', e);
        }
      }
    }
    else {
      // //console.log('!!! HAS NOT BEEN BOOTSTRAPPED OR SEEDED')
    }
      
    return nip11Map;
});

export const relaysWithNip11s: Readable<string[]> = derived(
  nip11s,
  ($nip11s) => {
    const result = new Set()
    for(const relay of $nip11s.keys()) {
      result.add(relay)
    }
    return Array.from(result) as string[]
  }
)

export const relaysWithoutNip11s: Readable<string[]> = derived(
  relayCheckAggregates,
  ($relayCheckAggregates) => {
    const result = new Set()
    $relayCheckAggregates.forEach( (check: any) => { 
      if(!check.hasNip11) {
        result.add(check.relay)
      }
    })
    return Array.from(result) as string[]
  }
)

export const operatorPubkeys: Readable<string[]> = derived(
  nip11s,
  ($nip11s) => {
    const result: Set<string> = new Set()
    if(!$nip11s) return []
    for(const [relay, nip11] of Array.from($nip11s)) {
      const json = nip11?.[0].json;
      if(!json) continue;
      const { pubkey } = json;
      if(pubkey){
        result.add(pubkey)
      }
    }
    return Array.from(result)
  }
)

export const operatorPubkeysValid: Readable<string[]> = derived(
  operatorPubkeys,
  ($operatorPubkeys) => {
    return $operatorPubkeys.filter(isPubkey)
  }
)

export const operatorPubkeysInvalid: Readable<string[]> = derived(
  operatorPubkeys,
  ($operatorPubkeys) => {
    return $operatorPubkeys.filter((pubkey: string) => !isPubkey(pubkey))
  }
)