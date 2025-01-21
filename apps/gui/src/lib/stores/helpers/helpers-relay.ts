import { derived, get, readable, type Readable } from "svelte/store";
import { relayChecks } from "../checks";
import { pubkeyProfile, pubkeyProfile$, pubkeyRelays, pubkeyRelays$, pubkeyUserInstance, pubkeyUserInstance$, type StorePubkeyProfile, type StorePubkeyProfileReadable, type StorePubkeyRelays, type StorePubkeyRelaysReadable, type StoreUser, type StoreUserReadable } from "./helpers-pubkey";

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