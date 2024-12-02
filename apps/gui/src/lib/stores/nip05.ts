import type { Nip05 } from "nostr-tools/nip05";
import { Nip05Service } from "$lib/services/Nip05Service/Nip05Service.js";
import { derived, writable, type Writable } from "svelte/store";

export interface INip05Result {
    pubkey: Pubkey;
    nip05: Nip05;
    valid: boolean;
}

export type INip05Map = Map<Nip05, INip05Result>;

type Pubkey = string;

export const nip05Service: Writable<Nip05Service> = writable(new Nip05Service());

export const nip05Results = writable<INip05Map>(new Map());

export const validNip05s = derived(
    nip05Results,
    ($nip05Results) => {
        return Array.from($nip05Results.values()).filter(nip05Result => nip05Result.valid);
    }
);

export const invalidNip05s = derived(
    nip05Results,
    ($nip05Results) => {
        return Array.from($nip05Results.values()).filter(nip05Result => !nip05Result.valid);
    }
);

export const nip05ResultsByPubkey = derived(
    nip05Results,
    ($nip05Results) => {
        const map = new Map();
        $nip05Results.forEach((nip05Result: INip05Result) => {
            const { pubkey } = nip05Result;
            map.set(pubkey, nip05Result);
        });
        return map;
    }
);