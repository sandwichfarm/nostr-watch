import type { Readable } from "svelte/motion";
import { derived, writable, type Writable } from "svelte/store";
import type { ICheck } from "@nostrwatch/nip66/models";
import { eventsArray } from "./events.js";
import type { IMonitor, IEvent } from "@nostrwatch/nip66/models";
import { throttledDerived } from "$lib/utils/stores.js";
import { StateManager } from "@nostrwatch/nip66";

export type Monitor = {
  priority?: number,
  registration?: IMonitor,
  relays?: string[],
  profile?: any
}

export const monitorsMap: Writable<Map<string, any>> = writable(new Map());

export const monitors = throttledDerived(
  monitorsMap, 
  ($monitorsMap) => {
    const arr = Array.from($monitorsMap.values());
    //console.log('monitors array', arr)
    //console.log('monitors stringified:', JSON.stringify(arr))
    StateManager.set('cache:monitors', arr);
    return arr;
  },
  10
)

export const monitorChecksCount = throttledDerived(
  eventsArray, 
  ($eventsArray) => {
    const countMap: Record<string, number> = {};
    $eventsArray.forEach((event: any) => {
      countMap[event.pubkey] = (countMap?.[event.pubkey] || 0) + 1;
    });
    return countMap;
  },
  5000
);