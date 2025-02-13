import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { Nip66CheckEvent, type INip11 } from "@nostrwatch/route66/models"


import { Nip11Service } from "$lib/services/Nip11Service";
import { StateManager } from "@nostrwatch/route66";
import { compress, decompress } from "compress-json";
import { Nip11 } from "@nostrwatch/route66/models";
import { doAggregateCache, hasBeenBootstrapped, hasBeenSeeded } from "./app.js";
import type { RelayInformation } from "@nostrwatch/route66/models";
import { relayCheckAggregates } from "./checks.js";
import { isPubkey } from "../utils/nostr.js";
import { throttledDerived } from "$utils/stores.js";
import type { SchemaValidationServiceResponse } from "$lib/services/SchemaValidationService/index.js";

import { eventsArray } from './events.js'; 

type RelayUrl = string

export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());
export const nip11sLocal: Writable<Map<string, Nip11>> = writable(new Map())

const toCache = (nip11Map) => {
  const arrayified = Array.from(nip11Map.entries()).map(
    ([relay, entries]) => [relay, entries.map((n: Nip11) => n.json)]
  );
  StateManager.set('aggregate:nip11s', compress(arrayified));
}

const fromCache = () => {
  const cachedMap = StateManager.get('aggregate:nip11s');
  if (cachedMap) {
    try {
      let decompressed = decompress(cachedMap);
      console.log('Decompressed nip11Map:', decompressed);
      if (Array.isArray(decompressed)) {
        // Rebuild the Map with real Nip11 objects
        decompressed = decompressed.map(
          ([relay, entries]: [string, RelayInformation[]]) => [
            relay,
            entries?.map((item: RelayInformation) => new Nip11(item))
          ]
        );
        return new Map(decompressed);
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

export const nip11s: Readable<Map<string, Nip11[]>> = derived(
  [eventsArray, nip11sLocal],
  ([$eventsArray, $nip11sLocal]) => {
    const cachedMap = fromCache();
    let nip11Map = cachedMap || new Map<string, Nip11[]>();

    function updateEntry(relay: string, nip11Entry: Nip11) {
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
      const event = _event as Nip66CheckEvent;
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
      toCache(nip11Map);
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

export const relayNip11s = (relay: string): Readable<Nip11 | undefined> => {
  return throttledDerived(
    [nip11s],
    ([$nip11s]) => {
        return $nip11s.get(relay)?.[0];
    }, 
    100)
};