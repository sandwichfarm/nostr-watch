import { writable, type Writable, type Readable, get } from "svelte/store";
import { NostrEvent, PubkeyProfile, PubkeyRelays, type IEvent } from '@nostrwatch/route66/models'
import { Route66 } from "@nostrwatch/route66";
import { SvelteMemoryRelay } from "@nostrwatch/memory-relay"
import { route66 } from "../route66";
import { type StoreEventType } from "../events";
import { eventsStoreMemoryRelay } from "./memory-relay-events";

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const userMetaMemoryRelay_ = new SvelteMemoryRelay<StoreEventType | IEvent, StoreEventType>( get(eventsStoreMemoryRelay).store )

userMetaMemoryRelay_.on('instantiate', (event: IEvent) => { 
    if(event.kind === 0) {
        return new PubkeyProfile(event);
    }
    if(event.kind === 10002) {
        return new PubkeyRelays(event);
    }
    return new NostrEvent(event);
});

userMetaMemoryRelay_.on('qualify', (event: StoreEventType | IEvent, key: string, $relay: SvelteMemoryRelay<IEvent, StoreEventType>) => { 
    if(Object.hasOwnProperty.call(event, 'json')) {
        //it's already instantiated, pass reference.
        $relay.store.update($userMetaRelay => { 
            const newMap = new Map($userMetaRelay);
            newMap.set(key, event as StoreEventType)
            return newMap;
        })
        return false
    }
    const metaKinds = [0, 3, 10002]
    return metaKinds.includes(event.kind);
});

export const userMetaMemoryRelay: Writable<SvelteMemoryRelay<IEvent, StoreEventType>> = writable(userMetaMemoryRelay_);