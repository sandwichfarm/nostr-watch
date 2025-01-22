import { writable, derived, type Writable, type Readable, get } from "svelte/store";
import { Nip66CheckEvent, Geocoded, NostrEvent, type IEvent, Monitor } from '@nostrwatch/route66/models'
import { Route66, StateManager } from "@nostrwatch/route66";
import { doAggregateCache } from "./app";

export type StoreEventType = Nip66CheckEvent | Geocoded | NostrEvent

export const events: Writable<Map<string, StoreEventType>> = writable(new Map());

export const eventsArray: Readable<StoreEventType[]> = derived(
    events, 
    ($events) => {
        const eventsArr = Array.from($events?.values() || []);
        if(eventsArr.length && get(doAggregateCache) === true) {
            StateManager.set('count:events:checks', eventsArr.length);
        }
        return eventsArr;
    }
)

export const totalMonitors: Readable<number> = derived(    
    eventsArray,
    ($events): number => {
        const monitors: Set<string> = new Set();
        $events.forEach(event => {
            if(event.kind !== 30166) return;
            monitors.add(event.pubkey);
        })
        return monitors.size;
    }
)