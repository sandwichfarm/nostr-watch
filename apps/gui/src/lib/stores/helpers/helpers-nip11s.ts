import { derived, get, readable, writable, type Readable, type Writable } from "svelte/store"
import { nip11s, nip11sLocal } from "../nip11s"
import type { Limitations, Nip11 } from "@nostrwatch/route66/models/Nip11";
import { relayCheckAggregates } from "$stores/checks";

export const relayNip11 = (relay: string): Nip11 | undefined => {
    return get(nip11s).get(relay)?.[0];
}

export const relayNip11$ = (relay: string): Readable<Nip11 | undefined> => {
    return derived(
        [nip11sLocal, nip11s],
        ([$nip11sLocal, $nip11s]) => {
            const localNip11 = $nip11sLocal.get(relay);
            if (localNip11) return localNip11;
            if ($nip11s) return $nip11s.get(relay)?.[0];
            return undefined;
        }
    );
}

export const relayNip11s = (relay: string): Nip11[] | undefined => {
    return get(nip11s).get(relay);
}

export const relayNip11s$ = (relay: string): Readable<Nip11[] | undefined> => {
    return derived(nip11s, ($nip11s) => {
        return $nip11s.get(relay);
    })
}

const nip11Property$ = <T>( store: Writable<Nip11> | Readable<Nip11>, property: string ): Readable<T | undefined> => {
    return derived(store, ($store) => $store?.[property as keyof Nip11]);
}

export const relaySupportedNips = (relay: string): number[] | undefined => {
    return relayNip11(relay)?.supportedNips;
}

export const relaySupportedNips$ = (relay: string) => {
    nip11Property$(relayNip11$(relay), 'supportedNips');
}

export const relayOperatorPubkey = (relay: string): string | undefined => {
    return relayNip11(relay)?.pubkey;
}

export const relaySoftware = (relay: string): string | undefined => {
    return relayNip11(relay)?.software;
}

export const relaySoftware$ = (relay: string): Readable<string | undefined> => {
    const nip11 = relayNip11$(relay);
    if(!get(nip11)) return readable(undefined);
    return nip11Property$(nip11 as Readable<Nip11>, 'software');
}

export const relaySoftwareVersion = (relay: string): string | undefined => {
    return relayNip11(relay)?.version;
}

export const relaySoftwareVersion$ = (relay: string) => {
    return nip11Property$(relayNip11$(relay), 'version');
}

export const relayLimitation = (relay: string): Limitations | undefined => {
    return relayNip11(relay)?.limitation;
}

export const relayLimitation$ = (relay: string): Readable<Limitations | undefined> => {
    return nip11Property$(relayNip11$(relay), 'limitation');
}

export const relayFees = (relay: string): number | undefined => {
    return relayNip11(relay)?.fees;
}

export const relayFees$ = (relay: string) => {
    return nip11Property$(relayNip11$(relay), 'fees');
}

export const relaysWithNip11s$ = (): Readable<string[]> => {
    return derived(nip11s, ($nip11s) => {
        const result = new Set()
        for(const relay of $nip11s.keys()) {
            result.add(relay)
        }
        return Array.from(result) as string[]
    })
}

export const relaysWithoutNip11s$ = (): Readable<string[]> => {
    return derived(relayCheckAggregates, ($relayCheckAggregates) => {
        const result = new Set()
        $relayCheckAggregates.forEach( (check: any) => { 
            if(!check.hasNip11) {
                result.add(check.relay)
            }
        })
        return Array.from(result) as string[]
    })
}