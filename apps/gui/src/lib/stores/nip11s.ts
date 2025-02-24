import { compress, decompress } from "compress-json";

import { derived, get, writable, type Readable, type Writable } from "svelte/store";

import type { StateManager as StateManagerType } from "@nostrwatch/route66";
import type { Nip66CheckEvent as Nip66CheckEventType, Nip11 as Nip11Type, RelayInformation } from "@nostrwatch/route66/models"

import { Nip11Service } from "$lib/services/Nip11Service";

import { doAggregateCache, hasBeenBootstrapped, hasBeenSeeded } from "./app.js";

import { relayCheckAggregates } from "./checks.js";
import { isPubkey } from "../utils/nostr.js";
import { throttledDerived } from "$utils/stores.js";
import type { SchemaValidationServiceResponse } from "$lib/services/SchemaValidationService/index.js";

import { eventsArray } from './events.js'; 

let Nip11: typeof Nip11Type;
let StateManager: typeof StateManagerType;

import("@nostrwatch/route66/models")
  .then(({Nip11:Nip11_}) => { 
    Nip11 = Nip11_;
  })
  .catch((e) => {
    console.error('Error importing Nip11:', e);
  });

import("@nostrwatch/route66")
  .then(({StateManager:StateManager_}) => { 
    StateManager = StateManager_;
  })
  .catch((e) => {
    console.error('Error importing StateManager:', e);
  });



type RelayUrl = string

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());
export const nip11sLocal: Writable<Map<string, Nip11Type>> = writable(new Map())

export const nip11s: Readable<Map<string, Nip11Type[]>> = derived(
  [eventsArray, nip11sLocal],
  ([$eventsArray, $nip11sLocal]) => {
    let nip11Map = new Map<string, Nip11Type[]>();

    function updateEntry(relay: string, nip11Entry: Nip11Type) {
      let existing = nip11Map.get(relay);
      if (!existing) {
        existing = [];
      }
      existing.push(nip11Entry);
      nip11Map.set(relay, existing);
    }

    let nip66Nip11s = 0;
    let localNip11s = 0;

    for (const _event of $eventsArray) {
      if(_event.kind !== 30166) continue;
      const event = _event as Nip66CheckEventType;
      if (!event?.nip11 || !event?.relay) continue;
      updateEntry(event.relay, event.nip11);
      nip66Nip11s++;
    }

    for (const [relayUrl, nip11Entry] of $nip11sLocal.entries()) {
      if (!nip11Entry) continue;
      updateEntry(relayUrl, nip11Entry);
      localNip11s++;
    }

    const totalWithoutLocal = nip66Nip11s - localNip11s;
    if (
      totalWithoutLocal > 0 &&
      hasBeenBootstrapped() &&
      hasBeenSeeded() &&
      get(doAggregateCache) === true &&
      StateManager
    ) {
      const arrayified = Array.from(nip11Map.entries()).map(
        ([relay, entries]) => [relay, entries.map((n: Nip11Type) => n.json)]
      );
      StateManager.set('aggregate:nip11s', compress(arrayified));
    } else if (hasBeenSeeded()) {
      let cachedMap;
      if(StateManager){
        cachedMap = StateManager.get('aggregate:nip11s');
      }
      if (cachedMap) {
        try {
          let decompressed = decompress(cachedMap);
          if (Array.isArray(decompressed)) {
            // Rebuild the Map with real Nip11 objects
            if(Nip11){
              decompressed = decompressed.map(
                ([relay, entries]: [string, RelayInformation[]]) => [
                  relay,
                  entries?.map((item: RelayInformation) => new Nip11(item))
                ]
              );
              nip11Map = new Map(decompressed);
            }
          } else {
            console.error(
              'Decompressed nip11Map value is not a valid array:',
              decompressed
            );
          }
        } catch (e) {
          console.error('Error during nip11Map decompression:', e);
        }
      }
    } 
    return nip11Map;
  }
);

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

export const relayNip11s = (relay: string): Readable<Nip11Type | undefined> => {
  return throttledDerived(
    [nip11s],
    ([$nip11s]) => $nip11s.get(relay)?.[0],
    100)
};