import type { SchemaValidationServiceResponse } from "$lib/services/SchemaValidationService";
import { StateManager } from "@nostrwatch/route66";
import { compress, decompress } from "compress-json";
import { derived, get, writable, type Readable, type Writable } from "svelte/store";

export const relayNip11Validations: Writable<Map<string, SchemaValidationServiceResponse>> = writable(new Map())

relayNip11Validations.subscribe( async (value) => {
  if(value.size > 0) {
    StateManager.set('aggregate:relayNip11Validations', compress(Array.from(value.entries())))
  }
})

if(Object.keys(get(relayNip11Validations)).length === 0) {
  const cachedMap = StateManager.get('aggregate:relayNip11Validations');
  if(cachedMap) {
    try {
      let decompressed = decompress(cachedMap);
      if(Array.isArray(decompressed)) {
        relayNip11Validations.set(new Map(decompressed));
      } else {
        console.error('Decompressed relayNip11Validations value is not a valid array:', decompressed)
      }
    } catch(e) {
      console.error('Error during relayNip11Validations decompression:', e)
    }
  }
}

export const nip11ValidationErrorCount: Readable<Map<string, number>> = derived(
  relayNip11Validations,
  ($relayNip11Validations) => {
    const result = new Map<string, number>()
    for(const [relay, validation] of Array.from($relayNip11Validations)) {
      const count = validation.result.errors.length
      result.set(relay, count)
    }
    return result
  }
)