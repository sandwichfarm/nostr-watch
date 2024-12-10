import { writable, derived, type Writable, type Readable } from "svelte/store";
import { Monitor, Nip66Event, type IEvent } from '@nostrwatch/nip66/models'
import { StateManager } from "@nostrwatch/nip66";
import { eventKey } from "$lib/utils/event-keys";
import { monitorsMap } from "./monitors";
import { events } from "./events";

let $monitorsMap: Map<string, Monitor> = new Map();

monitorsMap.subscribe(value => $monitorsMap = value)

export const addEventsToStore = (_events: IEvent[]) => {
    events.update((map) => {
        _events.forEach((event: IEvent) => {
            const aTag = event.tags.find((t: string[]) => t[0] === 'a')
            if(aTag) return;
            const key = eventKey(event);
            if(!key) return;
            const online = $monitorsMap.get(event.pubkey)?.relayIsOnline(event)
            if(!online) return;
            const existing = map.get(key);
            if (existing && existing.id === event.id) return;
            if (!event?.created_at || (existing && (existing.created_at ?? 0) > event.created_at)) return;
            map.set(key, new Nip66Event(event));
        });
        return map;
    });
}