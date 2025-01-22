import { derived, get, type Readable } from "svelte/store"
import { nip05ResultsByPubkey } from "../nip05s"
import type { Nip05 } from "nostr-tools/nip05"
import { pubkeyProfile, pubkeyProfile$, pubkeyUserInstance, pubkeyUserInstance$, type StorePubkeyProfile, type StoreUser } from "./helpers-pubkey"

export const monitorNip05 = (pubkey: string): Nip05 | undefined => {
    return get(nip05ResultsByPubkey).get(pubkey);
}

export const monitorNip05$ = (pubkey: string): Readable<Nip05 | undefined> => {
    return derived( nip05ResultsByPubkey, $nip05ResultsByPubkey => {
        return $nip05ResultsByPubkey.get(pubkey);
    })
}

export const monitorProfile = (pubkey: string): StorePubkeyProfile => {
    return pubkeyProfile(pubkey);
}

export const monitorProfile$ = (pubkey: string): Readable<StorePubkeyProfile> => {
    return pubkeyProfile$(pubkey);
}

export const monitorUserInstance = (pubkey: string): StoreUser => {
    return pubkeyUserInstance(pubkey);
}

export const monitorUserInstance$ = (pubkey: string): Readable<StoreUser> => {
    return pubkeyUserInstance$(pubkey);
}