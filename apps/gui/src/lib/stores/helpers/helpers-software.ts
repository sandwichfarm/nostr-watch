import type Nip66Check from "$lib/components/partials/Nip66Check.svelte";
import { relayCheckAggregates } from "$stores/checks";
import { ispsBySoftware, softwareGeocodesStore, softwareOperatorPubkeysMap, softwareRelaysStore } from "$stores/softwares";
import { isPubkey } from "$utils/nostr";
import { derived, get, type Readable } from "svelte/store";


export const softwareRelays = (softwareKey: string): Nip66Check[] => {
    return Array.from(new Set(get(relayCheckAggregates).filter((relayCheck) => {
        return softwareKey === relayCheck?.software;
    })))
}

export const softwareRelays$ = (softwareKey: string): Readable<Nip66Check[]> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        return Array.from(new Set($relayCheckAggregates.filter((relayCheck) => {
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