import { writable, type Writable, type Readable, get } from "svelte/store";
import {  NostrEvent, type IEvent, Monitor, PubkeyProfile, PubkeyRelays } from '@nostrwatch/route66/models'
import { Route66 } from "@nostrwatch/route66";
import { SvelteMemoryRelay } from "@nostrwatch/memory-relay"
import { route66 } from "../route66";
import { type StoreEventType } from "../events";
import { userMetaMemoryRelay } from "./memory-relay-user-meta";

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

export const currentUser: Writable<any> = writable(null);
const currentUserMeta: Writable<Map<string, StoreEventType>> = writable(new Map<string, StoreEventType>());

get(userMetaMemoryRelay).store.subscribe($userMetaStore => {
    const $currentUser = get(currentUser);
    if(!$currentUser) return;
    const profileKey = `${$currentUser.pubkey}:0`
    const relaysKey = `${$currentUser.pubkey}:10002`
    const profile = $userMetaStore.get(profileKey);
    const relays = $userMetaStore.get(relaysKey);
    
    currentUserMeta.update($currentUserStore => {
        const newMap = new Map($currentUserStore);
        if(profile) newMap.set(profileKey, profile);
        if(relays) newMap.set(relaysKey, relays);
        return newMap;
    })
})

const currentUserMemoryRelay_ = new SvelteMemoryRelay<StoreEventType | IEvent, StoreEventType>( currentUserMeta )

currentUserMemoryRelay_.on('qualify', (event: StoreEventType | IEvent, key: string, $relay: SvelteMemoryRelay<IEvent, StoreEventType>) => { 
    if(Object.hasOwnProperty.call(event, 'json')) {
        $relay.store.update($currentUserRelay => { 
            const newMap = new Map($currentUserRelay);
            newMap.set(key, event as StoreEventType)
            return newMap;
        })
        return false;
    }
    const existing = $relay.get(key);
    if (existing && existing.id === event.id) return false;
    
    const acceptedKinds = [
        0, 3, 10002, //meta
        10166, 30166, //nip66: adhoc
        10000, 10001, 10003, 10006, 10007, 10015, //lists
        30002, 30030, 30000 //sets
    ]
    return acceptedKinds.includes(event.kind);
});

currentUserMemoryRelay_.on('instantiate', (event: IEvent, key: string, $relay: SvelteMemoryRelay<IEvent, StoreEventType>) => { 
    if(Object.hasOwnProperty.call(event, 'json')) {
        $relay.store.update($store => $store.set(key, event as StoreEventType))
        return event as StoreEventType;
    }
    if(event.kind === 0) {
        return new PubkeyProfile(event);
    }
    if(event.kind === 10002) {
        return new PubkeyRelays(event);
    }
    return new NostrEvent(event);
});

export const currentUserMemoryRelay: Writable<SvelteMemoryRelay<IEvent, StoreEventType>> = writable(currentUserMemoryRelay_);