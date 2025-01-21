import { writable, type Writable, type Readable, get } from "svelte/store";
import { Nip66CheckEvent, Geocoded, NostrEvent, type IEvent, Monitor, PubkeyRelays, PubkeyProfile } from '@nostrwatch/route66/models'
import { Route66 } from "@nostrwatch/route66";
import { SvelteMemoryRelay } from "@nostrwatch/memory-relay"
import { route66 } from "../route66";
import { events, type StoreEventType } from "../events";

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const getMonitor = (pubkey: string): Monitor => {
    return $route66?.services?.monitors?.map.get(pubkey)
}

const eventsStoreMemoryRelay_ = new SvelteMemoryRelay<IEvent, StoreEventType>(events)

const eventModelMap: Record<number, any> = {
    0: PubkeyProfile,
    10002: PubkeyRelays,
    30166: Nip66CheckEvent,
    10166: Nip66CheckEvent
}

eventsStoreMemoryRelay_.on('instantiate', (event: StoreEventType) => { 
    return  eventModelMap[event.kind]? 
        new eventModelMap[event.kind](event):
        new NostrEvent(event);
});

//!!NOTICE: THE EVENTS RELAY IS ONLY STORING NIP-66 EVENTS
// TO MAINTAIN FUNCTIONALITY UNTIL EVERYTHING IT FLETCHED OUT:
eventsStoreMemoryRelay_.on('qualify', (event: StoreEventType, key: string, $relay: SvelteMemoryRelay<IEvent, StoreEventType>) => { 
    // const { kind } = event;

    // const existing = $relay.get(key);
    // if (existing && existing.id === event.id) return false

    // if(kind !== 30166 && kind !== 10166) return false;

    // const monitor = getMonitor(event.pubkey);
    // const online = monitor?.relayIsOnline(event);
    // monitor?.maybeUpdateLastActive?.(event);

    // if (!online) return false

    // if (!event?.created_at || (existing && (existing.created_at ?? 0) > event.created_at)) return false
    return true
});

export const eventsStoreMemoryRelay: Writable<SvelteMemoryRelay<IEvent, StoreEventType>> = writable(eventsStoreMemoryRelay_);