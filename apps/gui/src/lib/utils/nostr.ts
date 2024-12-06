import type { Nip05 } from "nostr-tools/nip05"
import { nip05Service } from "$lib/stores/nip05s.js"
import { get } from "svelte/store"
import { monitorNip05s } from "$lib/stores/monitors.js"

export const checkManyNip05s = async () => {
    for(const { pubkey, nip05 } of get(monitorNip05s)){
        checkNip05(pubkey, nip05)
    }
}

export const checkNip05 = async ( pubkey: string, nip05: Nip05 ) => {
    const service = get(nip05Service);
    service.check(pubkey, nip05)
}