import { writable, derived, type Writable, type Readable } from "svelte/store";

export const events: Writable<Map<string, any>> = writable(new Map());
export const eventsArray = derived(events, ($events) => Array.from($events?.values() || []));
export const checkEventsByRelay: Readable<Map<string, any>> = derived(
    eventsArray,
    $events => {
        const map = new Map();
        $events.forEach(event => {
            if(event.kind !== '30166') return;
            const relay = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
            if(!relay) return ;
            let entry = map.get(relay);
            if(!entry) entry = [];
            entry.push(event);
            map.set(relay, entry);
        })
    }
)

