import { bindBootstrapEmitters, instance } from "../utils/lifecycle";
import type { Nip11Service } from "$lib/services/Nip11Service";
import type { IEvent } from "@nostrwatch/route66/models/Event";
import { nip11Service } from "$stores/nip11s";
import { get } from "svelte/store";
import type { Filter } from "nostr-tools";
import type { WebsocketAdapterOptions } from "@nostrwatch/route66/core/WebsocketAdapter";
import { operatorsPubkeys, operatorsPubkeysValid } from "$stores/operators";
import { delay } from "@nostrwatch/utils";
import { relaysWithNip11s$, relaysWithoutNip11s$ } from "$stores/helpers/helpers-nip11s";

export const fetchMonitors = async () => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();
    await $route66?.services?.monitors?.bootstrapMonitors();
}

export const fetchMonitorsChecks = async () => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();
    await $route66?.services?.monitors?.bootstrapMonitorsChecks();
}

export const fetchNip11s = async () => {
    const $nip11Service: Nip11Service = get(nip11Service);
    const $relaysWithoutNip11s: string[] = get(relaysWithoutNip11s$());
    // const $relaysWithNip11s: string[] = get(relaysWithNip11s$());
    // const relays: string[] = Array.from(new Set([...$relaysWithoutNip11s, ...$relaysWithNip11s]));
    const relays: string[] = Array.from(new Set([...$relaysWithoutNip11s]));
    if(relays.length === 0) return;
    const promises: Promise<any>[] = [];
    for(const relay of relays){
        promises.push(new Promise( resolve => {
            setTimeout( resolve, 20000 )
            $nip11Service.check(relay).then( resolve )
        }));
    }
    return Promise.allSettled(promises);
}

export const fetchOperators = async (pubkeys?: string[]) => {
    // await delay(1000)
    //console.log('fetchOperators')
    const $route66 = await instance();
    await $route66.ready();
    if(!pubkeys?.length){
        pubkeys = get(operatorsPubkeysValid);
    }
    const emptyFilter: Filter = { kinds: [0, 10002], authors: [] };
    const chunks: Filter[][] = [];
    let filters: Filter[] = [];
    let filter: Filter = structuredClone(emptyFilter);
    for (const pubkey of pubkeys) {
        if (!Array.isArray(filter.authors)) {
            filter.authors = [];
        }
        if (filter.authors.length >= 10) {
            filters.push(filter);
            filter = structuredClone(emptyFilter);
            if (filters.length >= 5) {
                chunks.push([...filters]);
                filters = [];
            }
        }
        (filter.authors as string[]).push(pubkey);
    }

    //console.log('fetchOperators', 'filters', filters)
    
    if ((filter.authors as string[]).length > 0) {
        filters.push(filter);
    }
    
    if (filters.length > 0) {
        chunks.push([...filters]);
    }
    let results: IEvent[] = []
    for(const filters of chunks){
        const relays = $route66?.services?.relay?.userMetaRelays || []
        const priority = 1;
        const onevents = (events: IEvent[]) => results.push(...events);
        const options: WebsocketAdapterOptions = {
            cache: true,
            returnResults: true, 
            keepAlive: false,
            stream: true,
            batch: 10
        }
        await $route66.subscribe( { relays, filters, priority, options }, { onevents } )
    }
    //console.log('fetchOperators', results)
    return results;
}