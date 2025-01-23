import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
import { derived, get, type Readable } from "svelte/store";
import { eventsStoreMemoryRelay } from "../memory-relays/memory-relay-events";
import { events, type StoreEventType } from "../events";
import { User } from "../../models/User";
import type { NostrEvent } from "@nostrwatch/route66/models";
import { formatPubkeyForIndex } from "$lib/utils/event-keys";

export type StoreUser = User | undefined
export type StoreUserReadable = Readable<StoreUser>

const topMemoryRelay = () => get(eventsStoreMemoryRelay);

export const pubkeyUserInstance = (pubkey: string): StoreUser => {
    const profileEvent = pubkeyProfile(pubkey);
    const relayListEvent = pubkeyRelays(pubkey);
    //console.log('pubkeyUserInstance', profileEvent, relayListEvent)
    if(profileEvent && relayListEvent) {
        return User.from(profileEvent.json, relayListEvent.json);
    }
}

export const pubkeyUserInstance$ = (pubkey: string): Readable<StoreUser> => {
    return derived(
        [events], 
        () => {
            const profileEvent = pubkeyProfile(pubkey);
            const relayListEvent = pubkeyRelays(pubkey);
            if(profileEvent && relayListEvent) {
                return User.from(profileEvent.json, relayListEvent.json);
            }
        }
    ) as StoreUserReadable
}

export type StorePubkeyProfile = PubkeyProfile | undefined

export const pubkeyProfile = (pubkey: string): StorePubkeyProfile | undefined => {
    //console.log( 'pubkeyProfile', `${formatPubkeyForIndex(pubkey)}:${0}`, get(events).get(`${formatPubkeyForIndex(pubkey)}:${0}`));
    return topMemoryRelay().get(`${formatPubkeyForIndex(pubkey)}:${0}`) as PubkeyProfile | undefined;
}

export const pubkeyProfile$ = (pubkey: string): Readable<StorePubkeyProfile> => {
    return derived([eventsStoreMemoryRelay, get(eventsStoreMemoryRelay).store], ([$storeRelay]) => {
        return $storeRelay.$get(`${formatPubkeyForIndex(pubkey)}:${0}`);
    }) as Readable<StorePubkeyProfile> 
}

export type StorePubkeyRelays = PubkeyProfile | undefined

export const pubkeyRelays = (pubkey: string): StorePubkeyRelays => {
    return topMemoryRelay()?.get(`${formatPubkeyForIndex(pubkey)}:${10002}`) as StorePubkeyRelays;
}

export const pubkeyRelays$ = (pubkey: string): Readable<StorePubkeyRelays> => {
    return derived([eventsStoreMemoryRelay, get(eventsStoreMemoryRelay).store], ([$storeRelay]) => {
        return $storeRelay.get(`${formatPubkeyForIndex(pubkey)}:${10002}`);
    }) as Readable<StorePubkeyRelays>
}

export type StorePubkeyEvents = StoreEventType[]
export type StorePubkeyEventsReadable = Readable<StorePubkeyEvents>

export const pubkeyNotes = (pubkey: string): StorePubkeyEvents => {
    return topMemoryRelay().req(`notes:pubkey:${formatPubkeyForIndex(pubkey)}`, [ {authors: [pubkey], kinds: [1]} ]) as StorePubkeyEvents;
}

export const pubkeyNotes$ = (pubkey: string): StorePubkeyEventsReadable => {
    return topMemoryRelay().$req(`notes:pubkey:${formatPubkeyForIndex(pubkey)}`, [ {authors: [pubkey], kinds: [1]} ]);
}