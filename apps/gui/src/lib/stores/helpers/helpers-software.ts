import type Nip66Check from "$lib/components/partials/Nip66Check.svelte";
import { relayCheckAggregates } from "$stores/checks";
import { workerAggregates } from "$stores/dimension-stores";
import { ispsBySoftware, softwareGeocodesStore, softwareOperatorPubkeysMap, softwareRelaysStore } from "$stores/softwares";
import { isPubkey } from "$utils/nostr";
import { derived, get, type Readable } from "svelte/store";

// ============================================================================
// HELPER: Get aggregates source (prefer worker, fallback to legacy)
// ============================================================================

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
// SOFTWARE HELPERS
// ============================================================================

export const softwareRelays = (softwareKey: string): Nip66Check[] => {
    return Array.from(new Set(getAggregates().filter((relayCheck) => {
        return softwareKey === relayCheck?.software;
    })))
}

export const softwareRelays$ = (softwareKey: string): Readable<Nip66Check[]> => {
    return derived(aggregatesSource$, ($aggregates) => {
        return Array.from(new Set($aggregates.filter((relayCheck) => {
            return softwareKey === relayCheck?.software;
        })))
    })
}

export const softwareGeos = (softwareKey: string): string[] => {
    return Array.from(new Set(get(softwareGeocodesStore).get(softwareKey) || []));
}

export const softwareGeos$ = (softwareKey: string): Readable<string[]> => {
    return derived(softwareGeocodesStore, ($softwareGeocodesStore) => {
        return Array.from(new Set($softwareGeocodesStore.get(softwareKey) || []));
    })
}

export const softwareOperatorsPubkeys = (softwareKey: string): string[] => {
    return Array.from(get(softwareOperatorPubkeysMap).get(softwareKey) || []).filter(isPubkey);
}

export const softwareOperatorsPubkeys$ = (softwareKey: string): Readable<string[]> => {
    return derived(softwareOperatorPubkeysMap, ($softwareOperatorPubkeysMap) => {
        return Array.from($softwareOperatorPubkeysMap.get(softwareKey) || []).filter(isPubkey);
    })
}

export const softwareIsps = (softwareKey: string): string[] => {
    return Array.from(get(ispsBySoftware).get(softwareKey) || []);
}

export const softwareIsps$ = (softwareKey: string): Readable<string[]> => {
    return derived(ispsBySoftware, ($ispsBySoftware) => {
        return Array.from($ispsBySoftware.get(softwareKey) || []);
    })
}
