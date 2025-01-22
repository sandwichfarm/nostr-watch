import { derived, get, type Readable, type Writable } from "svelte/store"
import { nip11s } from "../nip11s"
import type { Limitations, Nip11 } from "@nostrwatch/route66/models/Nip11";

export const relayNip11 = (relay: string): Nip11 => {
    return get(nip11s).get(relay)?.[0];
}

export const relayNip11$ = (relay: string): Readable<Nip11> => {
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

export const relayOperatorPubkey$ = (relay: string) => {
    return nip11Property$(relayNip11$(relay), 'pubkey');
}

export const relaySoftware = (relay: string): string | undefined => {
    return relayNip11(relay)?.software;
}

export const relaySoftware$ = (relay: string) => {
    return nip11Property$(relayNip11$(relay), 'software');
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