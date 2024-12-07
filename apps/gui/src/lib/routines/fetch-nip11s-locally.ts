import { get } from "svelte/store"

import { relayAggregates } from "$lib/stores/checks.js"
import { nip11Service } from "$lib/stores/nip11s.js";

export default async () => {
    const $nip11Service = get(nip11Service)
    const $relayAggregates = get(relayAggregates);
    const relaysWithoutNip11 = $relayAggregates
        .filter( (relay: any) => relay.content.length <= 2 )
        .map( (relay: any) => relay.relay ) 
    for(const relay of relaysWithoutNip11) {
        $nip11Service.check(relay)
    }
}