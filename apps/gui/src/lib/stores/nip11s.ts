import { compress, decompress } from "compress-json";

import { derived, get, writable, type Readable, type Writable } from "svelte/store";

import type { StateManager as StateManagerType } from "@nostrwatch/route66";
import type { Nip66CheckEvent as Nip66CheckEventType, Nip11 as Nip11Type, RelayInformation } from "@nostrwatch/route66/models"

import { Nip11Service } from "$lib/services/Nip11Service";

import { doAggregateCache, hasBeenBootstrapped, hasBeenSeeded } from "./app.js";

import { isPubkey } from "../utils/nostr.js";
import { throttledDerived } from "$utils/stores.js";

import { eventsArray } from './events.js'; 

// Define a proper type for the imported modules
interface ImportedModules {
  Nip11: typeof Nip11Type | null;
  StateManager: typeof StateManagerType | null;
}

// Creating a store to track when the imports are ready
const importsReady = writable(false);
// Store for the imported modules
const importedModules = writable<ImportedModules>({
  Nip11: null,
  StateManager: null
});

// Promise for loading the modules
const loadModules = async () => {
  try {
    const [routeModels, route66] = await Promise.all([
      import("@nostrwatch/route66/models"),
      import("@nostrwatch/route66")
    ]);
    
    importedModules.set({
      Nip11: routeModels.Nip11,
      StateManager: route66.StateManager
    });
    
    importsReady.set(true);
  } catch (e) {
    console.error('Error importing modules:', e);
  }
};

// Start loading modules immediately
loadModules();

type RelayUrl = string

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());
export const nip11sLocal: Writable<Map<string, Nip11Type>> = writable(new Map())

export const nip11s: Readable<Map<string, Nip11Type[]>> = derived(
  [eventsArray, nip11sLocal, importsReady, importedModules],
  ([$eventsArray, $nip11sLocal, $importsReady, $importedModules]) => {
    let nip11Map = new Map<string, Nip11Type[]>();
    
    // If imports aren't ready yet, return empty map
    if (!$importsReady) {
      return nip11Map;
    }
    
    const { Nip11, StateManager } = $importedModules;
    if (!Nip11 || !StateManager) {
      console.warn('Nip11 or StateManager not loaded yet');
      return nip11Map;
    }

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

    for (const [relayUrl, nip11Entry] of $nip11sLocal.entries()) {
      if (!nip11Entry) continue;
      updateEntry(relayUrl, nip11Entry);
      localNip11s++;
    }

    for (const _event of $eventsArray) {
      if(_event.kind !== 30166) continue;
      const event = _event as Nip66CheckEventType;
      if (!event?.nip11 || !event?.relay) continue;
      updateEntry(event.relay, event.nip11);
      nip66Nip11s++;
    }

    const totalWithoutLocal = nip66Nip11s - localNip11s;
    if (
      totalWithoutLocal > 0 &&
      hasBeenBootstrapped() &&
      hasBeenSeeded() &&
      get(doAggregateCache) === true
    ) {
      const arrayified = Array.from(nip11Map.entries()).map(
        ([relay, entries]) => [relay, entries.map((n: Nip11Type) => n.json)]
      );
      StateManager.set('aggregate:nip11s', compress(arrayified));
    } else if (hasBeenSeeded()) {
      let cachedMap;
      cachedMap = StateManager.get('aggregate:nip11s');
      if (cachedMap) {
        try {
          let decompressed = decompress(cachedMap);
          if (Array.isArray(decompressed)) {
            // Rebuild the Map with real Nip11 objects
            decompressed = decompressed.map(
              ([relay, entries]: [string, RelayInformation[]]) => [
                relay,
                entries?.map((item: RelayInformation) => new Nip11(item))
              ]
            );
            nip11Map = new Map(decompressed);
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
    const result: Set<string> = new Set();
    if(!$nip11s) return [];
    
    // Use Array.from to convert Map to array of entries, and iterate through it
    const nip11Entries = Array.from($nip11s.entries());
    
    for(const [relay, nip11Array] of nip11Entries) {
      if (!nip11Array || !nip11Array.length) continue;
      
      const json = nip11Array[0].json;
      if(!json) continue;
      
      const { pubkey } = json;
      if(pubkey){
        result.add(pubkey);
      }
    }
    return Array.from(result);
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
    ([$nip11s]) => {
      // Make sure $nip11s is a Map before using get()
      if ($nip11s instanceof Map) {
        const entries = $nip11s.get(relay);
        return entries && entries.length > 0 ? entries[0] : undefined;
      }
      // If $nip11s is not a Map (which should not happen), return undefined
      return undefined;
    },
    100
  );
};