import { writable, derived, type Writable, type Readable } from "svelte/store";
import { type Nip66Event } from '@nostrwatch/nip66/models'
import { StateManager } from "@nostrwatch/nip66";

export const events: Writable<Map<string, Nip66Event>> = writable(new Map());
export const eventsArray: Readable<Nip66Event[]> = derived(
    events, 
    ($events) => {
        const eventsArr = Array.from($events?.values() || []);
        if(eventsArr.length) {
            StateManager.set('count:events:checks', eventsArr.length);
        }
        return eventsArr;
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

