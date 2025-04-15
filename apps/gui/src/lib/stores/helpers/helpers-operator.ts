import { derived, get, type Readable } from "svelte/store";
import { operatorPubkeySoftwaresMap } from "../softwares"
import { relayCheckAggregates } from "../checks";
import {
  pubkeyProfile,
  pubkeyProfile$,
  pubkeyRelays,
  pubkeyRelays$,
  pubkeyUserInstance,
  pubkeyUserInstance$,
  type StorePubkeyEvents,
  type StorePubkeyProfile,
  type StorePubkeyRelays,
  type StoreUser,
  type StoreUserReadable
} from "./helpers-pubkey";


import { eventsStoreMemoryRelay } from "../memory-relays/memory-relay-events";

import { isps } from "$lib/stores/isps";
import { formatPubkeyForIndex } from "$utils/event-keys";

//aggregates
export const operatorSoftwares = (pubkey: string): string[] | undefined => {
    const set = get(operatorPubkeySoftwaresMap).get(pubkey)
    if(!set) return undefined;
    return Array.from(set)
}

export const operatorSoftwares$ = (pubkey: string): Readable<string[] | undefined> => {
    return derived(operatorPubkeySoftwaresMap, ($operatorPubkeySoftwaresMap) => {
        const set = $operatorPubkeySoftwaresMap.get(pubkey)
        if(!set) return undefined;
        return Array.from(set);
    })
}

export const operatorRelaysOperated = (pubkey: string): string[] | undefined => {
    return get(relayCheckAggregates)
        .filter((aggregate: any) => aggregate?.operatorPubkey === pubkey )
        .map((aggregate: any) => aggregate.relay)
}

export const operatorRelaysOperatedAggregate$ = (pubkey: string): Readable<any[] | undefined> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        return $relayCheckAggregates
            .filter((aggregate) => aggregate?.operatorPubkey === pubkey )
    })
}

export const operatorRelaysOperated$ = (pubkey: string): Readable<string[] | undefined> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        return $relayCheckAggregates
            .filter((aggregate) => aggregate?.operatorPubkey === pubkey )
            .map((aggregate) => aggregate.relay)
    })
}


export const operatorIsps = (pubkey: string): string[] | undefined => {
    const uniques: Set<string> = new Set();
    const result = get(relayCheckAggregates)
        .filter((aggregate: any) => aggregate?.operatorPubkey === pubkey )
        .map((aggregate: any) => aggregate?.isp )
        .filter((isp: string) => !!isp )
    result.forEach((isp: string) => uniques.add(isp))
    return Array.from(uniques);
}

export const operatorIsps$ = (pubkey: string): Readable<string[] | undefined> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        const uniques: Set<string> = new Set();
        $relayCheckAggregates
            .filter((aggregate: any) => aggregate?.operatorPubkey === pubkey )
            .map((aggregate: any) => aggregate?.isp )
            .filter((isp: string) => !!isp )
            .forEach((isp: string) => uniques.add(isp))
        return Array.from(uniques)
    })
}

export const operatorCountries = (pubkey: string): string[] | undefined => {
    const uniques: Set<string> = new Set();
    const result = get(relayCheckAggregates)
        .filter((aggregate: any) => aggregate?.operatorPubkey === pubkey )
        .map((aggregate: any) => aggregate?.geocodes )
        .filter((code: string) => !!code )
    result.forEach((code: string) => uniques.add(code))
    return Array.from(uniques);
}

export const operatorCountries$ = (pubkey: string): Readable<string[] | undefined> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        return operatorCountries(pubkey)
    })
}


//convenience, namespaced wrappers
export const operatorUser = (pubkey: string): StoreUser => {
    return pubkeyUserInstance(pubkey);
}

export const operatorUser$ = (pubkey: string): StoreUserReadable => {
    return pubkeyUserInstance$(pubkey);
}

export const operatorRelays = (pubkey: string): StorePubkeyRelays => {
    return pubkeyRelays(pubkey);
}

export const operatorRelays$ = (pubkey: string): StorePubkeyRelaysReadable => {
    return pubkeyRelays$(pubkey);
}

export const operatorProfile = (pubkey: string): StorePubkeyProfile | undefined => {
    return pubkeyProfile(pubkey);
}

export const operatorProfile$ = (pubkey: string): Readable<StorePubkeyProfile | undefined> => {
    return pubkeyProfile$(pubkey);
}