import { writable, derived, type Writable, type Readable } from "svelte/store";
import type Route66 from '@nostrwatch/route66'
import { Monitor, Nip66Event, type IEvent } from '@nostrwatch/route66/models'
import { StateManager } from "@nostrwatch/route66";
import { eventKey } from "$lib/utils/event-keys";
import { route66 } from "./route66.js";
import { events } from "./events";
import PQueue from 'p-queue';
import { delay } from '@nostrwatch/utils'

const queue = new PQueue({concurrency: 1});

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const getMonitor = (pubkey: string): Monitor => {
    return $route66?.services?.monitors?.map.get(pubkey)
}

export const addEventsToStore = (_events: IEvent[]) => {
    console.log(`addEventsToStore: ${_events.length} events`)
    queue.add(async () => {
        await delay(100)
        events.update((map) => {
            _events.forEach(async (event: IEvent) => {
                //temporary fix for a bug in relay monitors.
                // const aTag = event.tags.find((t: string[]) => t[0] === 'a')
                // if(aTag) return;
                //
                const key = eventKey(event);
                if(!key) return;
                const monitor = getMonitor(event.pubkey);
                const online = monitor?.relayIsOnline(event)
                monitor?.maybeUpdateLastActive?.(event); 
                if(!online) return;
                const existing = map.get(key);
                if (existing && existing.id === event.id) return;
                if (!event?.created_at || (existing && (existing.created_at ?? 0) > event.created_at)) return;
                map.set(key, new Nip66Event(event));
                await delay(1)
            });
            return map;
        });
    })
}