import { derived, get, type Readable } from "svelte/store";
import { operatorPubkeySoftwareCounts, operatorPubkeySoftwaresMap } from "../softwares"
import { relayCheckAggregates } from "../checks";
import { workerAggregates } from "../dimension-stores";
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

// ============================================================================
// HELPER: Get aggregates source (prefer worker, fallback to legacy)
// ============================================================================

/**
 * Get aggregates from worker store, falling back to relayCheckAggregates if empty.
 * This allows helpers to work before the worker has initialized.
 */
function getAggregates(): any[] {
    const worker = get(workerAggregates);
    if (worker && worker.length > 0) return worker;
    return get(relayCheckAggregates);
}

/**
 * Shared derived store that uses worker aggregates with fallback.
 * IMPORTANT: This is a single shared store, NOT a factory function.
 * Creating new derived stores on every call was causing memory leaks.
 */
const aggregatesSource$: Readable<any[]> = derived(
    [workerAggregates, relayCheckAggregates],
    ([$worker, $legacy]) => {
        if ($worker && $worker.length > 0) return $worker;
        return $legacy;
    }
);

// ============================================================================
// AGGREGATES-BASED HELPERS
// ============================================================================

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

export const operatorRelaysOperated = (pubkey: string, onlineOnly: boolean = true): string[] | undefined => {
    return getAggregates()
        .filter((aggregate: any) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .map((aggregate: any) => aggregate.relay)
}

export const operatorRelaysOperatedAggregate$ = (pubkey: string, onlineOnly: boolean = true): Readable<any[] | undefined> => {
    return derived(aggregatesSource$, ($aggregates) => {
        return $aggregates
            .filter((aggregate) => {
                if (aggregate?.operatorPubkey !== pubkey) return false;
                if (onlineOnly && aggregate?.liveness !== 'online') return false;
                return true;
            })
    })
}

export const operatorRelaysOperated$ = (pubkey: string, onlineOnly: boolean = true): Readable<string[] | undefined> => {
    return derived(aggregatesSource$, ($aggregates) => {
        return $aggregates
            .filter((aggregate) => {
                if (aggregate?.operatorPubkey !== pubkey) return false;
                if (onlineOnly && aggregate?.liveness !== 'online') return false;
                return true;
            })
            .map((aggregate) => aggregate.relay)
    })
}

export const operatorSoftwareCount = (pubkey: string, software: string, onlineOnly: boolean = true): number => {
    return getAggregates()
        .filter((aggregate) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (aggregate?.software !== software) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .length
}

export const operatorSoftwareCount$ = (pubkey: string, software: string, onlineOnly: boolean = true): Readable<number> => {
    return derived(aggregatesSource$, ($aggregates) => {
        return $aggregates
            .filter((aggregate) => {
                if (aggregate?.operatorPubkey !== pubkey) return false;
                if (aggregate?.software !== software) return false;
                if (onlineOnly && aggregate?.liveness !== 'online') return false;
                return true;
            })
            .length
    })
}


export const operatorIsps = (pubkey: string, onlineOnly: boolean = true): string[] | undefined => {
    const uniques: Set<string> = new Set();
    const result = getAggregates()
        .filter((aggregate: any) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .map((aggregate: any) => aggregate?.isp )
        .filter((isp: string) => !!isp )
    result.forEach((isp: string) => uniques.add(isp))
    return Array.from(uniques);
}

export const operatorIsps$ = (pubkey: string, onlineOnly: boolean = true): Readable<string[] | undefined> => {
    return derived(aggregatesSource$, ($aggregates) => {
        const uniques: Set<string> = new Set();
        $aggregates
            .filter((aggregate: any) => {
                if (aggregate?.operatorPubkey !== pubkey) return false;
                if (onlineOnly && aggregate?.liveness !== 'online') return false;
                return true;
            })
            .map((aggregate: any) => aggregate?.isp )
            .filter((isp: string) => !!isp )
            .forEach((isp: string) => uniques.add(isp))
        return Array.from(uniques)
    })
}

export const operatorIspCount = (pubkey: string, isp: string, onlineOnly: boolean = true): number => {
    return getAggregates()
        .filter((aggregate) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (aggregate?.isp !== isp) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .length
}



export const operatorCountries = (pubkey: string, onlineOnly: boolean = true): string[] | undefined => {
    const uniques: Set<string> = new Set();
    const result = getAggregates()
        .filter((aggregate: any) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .map((aggregate: any) => aggregate?.geocode )
        .filter((code: string) => !!code )
    result.forEach((code: string) => uniques.add(code))
    return Array.from(uniques);
}

export const operatorCountries$ = (pubkey: string, onlineOnly: boolean = true): Readable<string[] | undefined> => {
    return derived(aggregatesSource$, ($aggregates) => {
        const uniques: Set<string> = new Set();
        $aggregates
            .filter((aggregate: any) => {
                if (aggregate?.operatorPubkey !== pubkey) return false;
                if (onlineOnly && aggregate?.liveness !== 'online') return false;
                return true;
            })
            .map((aggregate: any) => aggregate?.geocode )
            .filter((code: string) => !!code )
            .forEach((code: string) => uniques.add(code))
        return Array.from(uniques)
    })
}

export const operatorCountryCount = (pubkey: string, country: string, onlineOnly: boolean = true): number => {
    return getAggregates()
        .filter((aggregate) => {
            if (aggregate?.operatorPubkey !== pubkey) return false;
            if (aggregate?.geocode !== country) return false;
            if (onlineOnly && aggregate?.liveness !== 'online') return false;
            return true;
        })
        .length
}

// ============================================================================
// CONVENIENCE WRAPPERS (Namespaced)
// ============================================================================

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
