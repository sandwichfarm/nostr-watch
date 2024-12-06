import type { Nip05 } from "nostr-tools/nip05";
import { Nip05Service } from "$lib/services/Nip05Service/index.js";
import { derived, writable, type Writable } from "svelte/store";

export type Nip05MapKey = `${Nip05}:${string}`

export const generateNip05MapKey = (pubkey: string, value: Nip05): Nip05MapKey => {
    return `${value}:${pubkey}`;
}

export interface INip05Result {
    pubkey: Pubkey;
    nip05: Nip05;
    valid: boolean;
}

export type INip05Map = Map<Nip05MapKey, INip05Result>;

type Pubkey = string;

export const nip05Service: Writable<Nip05Service> = writable(new Nip05Service());

export const nip05s = writable<INip05Map>(new Map());

export const validNip05s = derived(
    nip05s,
    ($nip05s) => {
        return Array.from($nip05s.values()).filter(nip05Result => nip05Result.valid);
    }
);

export const invalidNip05s = derived(
    nip05s,
    ($nip05s) => {
        return Array.from($nip05s.values()).filter(nip05Result => !nip05Result.valid);
    }
);

export const nip05ResultsByPubkey = derived(
    nip05s,
    ($nip05s) => {
        const map = new Map();
        $nip05s.forEach((nip05Result: INip05Result) => {
            const { pubkey } = nip05Result;
            map.set(pubkey, nip05Result);
        });
        return map;
    }
);