import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
import { derived, get, type Readable } from "svelte/store";
import { eventsStoreMemoryRelay } from "../memory-relays/memory-relay-events";
import { events, type StoreEventType } from "../events";
import { User } from "../../models/User";
import type { NostrEvent } from "@nostrwatch/route66/models";

export type StoreUser = User | undefined
export type StoreUserReadable = Readable<StoreUser>

export const pubkeyUserInstance = (pubkey: string): StoreUser => {
    const profileEvent = get(eventsStoreMemoryRelay).get(`${pubkey}:${0}`) as NostrEvent | undefined;
    const relayListEvent = get(eventsStoreMemoryRelay).get(`${pubkey}:${10002}`) as NostrEvent | undefined;
    if(profileEvent && relayListEvent) {
        return User.from(profileEvent.json, relayListEvent.json);
    }
}

export const pubkeyUserInstance$ = (pubkey: string): StoreUserReadable => {
    return derived([eventsStoreMemoryRelay, events], ([$storeRelay, $events]) => {
        const profileEvent = $storeRelay.get(`${pubkey}:${0}`) as NostrEvent | undefined;
        const relayListEvent = $storeRelay.get(`${pubkey}:${10002}`) as NostrEvent | undefined;
        if(profileEvent && relayListEvent) {
            return User.from(profileEvent.json, relayListEvent.json);
        }
    }) as StoreUserReadable
}

export type StorePubkeyProfile = PubkeyProfile | undefined
export type StorePubkeyProfileReadable = Readable<StorePubkeyProfile>

export const pubkeyProfile = (pubkey: string): StorePubkeyProfile | undefined => {
    return get(eventsStoreMemoryRelay)?.get(`${pubkey}:${0}`) as PubkeyProfile | undefined;
}

export const pubkeyProfile$ = (pubkey: string): StorePubkeyProfileReadable => {
    return derived(eventsStoreMemoryRelay, ($storeRelay) => {
        return $storeRelay.$get(`${pubkey}:${0}`);
    }) as StorePubkeyProfileReadable
}

export type StorePubkeyRelays = PubkeyProfile | undefined
export type StorePubkeyRelaysReadable = Readable<StorePubkeyRelays>

export const pubkeyRelays = (pubkey: string): StorePubkeyRelays => {
    return get(eventsStoreMemoryRelay)?.get(`${pubkey}:${0}`) as StorePubkeyRelays;
}

export const pubkeyRelays$ = (pubkey: string): StorePubkeyRelaysReadable => {
    return derived(eventsStoreMemoryRelay, ($storeRelay) => {
        return $storeRelay.$get(`${pubkey}:${0}`);
    }) as StorePubkeyRelaysReadable
}

export type StorePubkeyEvents = StoreEventType[]
export type StorePubkeyEventsReadable = Readable<StorePubkeyEvents>

export const pubkeyNotes = (pubkey: string): StorePubkeyEvents => {
    return get(eventsStoreMemoryRelay).req('notes:pubkey', [ {authors: [pubkey], kinds: [1]} ]) as StorePubkeyEvents;
}

export const pubkeyNotes$ = (pubkey: string): StorePubkeyEventsReadable => {
    return get(eventsStoreMemoryRelay).$req('notes:pubkey', [ {authors: [pubkey], kinds: [1]} ]);
}