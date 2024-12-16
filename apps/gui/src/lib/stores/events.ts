import { writable, derived, type Writable, type Readable, get } from "svelte/store";
import { Monitor, Nip66Event, type IEvent } from '@nostrwatch/nip66/models'
import { StateManager } from "@nostrwatch/nip66";
import { doAggregateCache } from "./app";


export const events: Writable<Map<string, Nip66Event>> = writable(new Map());
export const eventsArray: Readable<Nip66Event[]> = derived(
    events, 
    ($events) => {
        const eventsArr = Array.from($events?.values() || []);
        if(eventsArr.length && get(doAggregateCache) === true) {
            StateManager.set('count:events:checks', eventsArr.length);
        }
        return eventsArr;
    }
)

export const totalMonitors: Readable<Set<string>> = derived(    
    eventsArray,
    ($events): Set<string> => {
        const monitors: Set<string> = new Set();
        $events.forEach(event => {
            if(event.kind !== 30166) return;
            monitors.add(event.pubkey);
        })
        return monitors;
    }
)


        

// export const checkEventsByRelay: Readable<Map<string, Nip66Event>> = derived(
//     eventsArray,
//     $events => {
//         const map = new Map();
//         $events.forEach(event => {
//             if(event.kind !== '30166') return;
//             const relay = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
//             if(!relay) return ;
//             let entry = map.get(relay);
//             if(!entry) entry = [];
//             entry.push(event);
//             map.set(relay, entry);
//         })
//     }
// )

