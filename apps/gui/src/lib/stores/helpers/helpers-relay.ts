import { derived, get, readable, type Readable } from "svelte/store";
import { eventsChecks, relayCheckAggregates, relayChecks } from "../checks";
import { pubkeyProfile, pubkeyProfile$, pubkeyRelays, pubkeyRelays$, pubkeyUserInstance, pubkeyUserInstance$, type StorePubkeyProfile, type StorePubkeyProfileReadable, type StorePubkeyRelays, type StorePubkeyRelaysReadable, type StoreUser, type StoreUserReadable } from "./helpers-pubkey";
import type { Nip66CheckEvent } from "@nostrwatch/route66/models/Nip66CheckEvent";
import { events, eventsArray, type StoreEventType } from "$stores/events";
import type { NostrEvent } from "nostr-tools";


export const relayLivenessAggregate = (relayUrl: string): any | undefined => {
    return get(eventsChecks).find((aggregate: any) => aggregate.relay === relayUrl) || undefined
}

export const relayLivenessAggregate$ = (relayUrl: string): Readable<any | undefined> => {
    return derived(eventsChecks, ($eventsChecks) => {
        return $eventsChecks.find((aggregate: any) => aggregate.relay === relayUrl) || undefined
    })
}

export const relayLivenessChecks = (relayUrl: string): Nip66CheckEvent[] => {
    return relayLivenessAggregate(relayUrl)?.checks || [];
}

export const relayLivenessChecks$ = (relayUrl: string): Readable<Nip66CheckEvent[]> => {
    return derived(eventsArray, ($eventsArray: StoreEventType[]) => {
        return $eventsArray.filter(event => event!.relay === relayUrl) as Nip66CheckEvent[];  
    })
}

export const relayOperatorPubkey = (relay: string): string | undefined => {
    const record = get(relayChecks)?.[relay];
    return record?.aggregate?.operatorPubkey;
}

export const relayOperatorPubkey$ = (relay: string): Readable<string | undefined> => {
    return derived(relayChecks, ($relayChecks) => {
        const record = $relayChecks?.[relay];
        return record?.aggregate?.operatorPubkey;
    });
}

export const relayOperatorUser = (relay: string): StoreUser => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyUserInstance(pubkey);
}

export const relayOperatorUser$ = (relay: string): Readable<StoreUser> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyUserInstance$(pubkey);
}

export const relayOperatorRelayList = (relay: string) => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyRelays(pubkey);
}

export const relayOperatorRelayList$ = (relay: string): Readable<StorePubkeyRelays> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyRelays$(pubkey);
}

export const relayOperatorProfile = (relay: string): StorePubkeyProfile => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyProfile(pubkey);
}

export const relayOperatorProfile$ = (relay: string): Readable<StorePubkeyProfile> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyProfile$(pubkey);
}