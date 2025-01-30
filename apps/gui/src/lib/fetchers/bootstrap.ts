import { instance } from "../utils/lifecycle";
import type { Nip11Service } from "$lib/services/Nip11Service";
import { publishEventsToMemoryRelay } from "$stores/events-helpers";
import type { IEvent } from "@nostrwatch/route66/models/Event";
import { nip11Service, operatorPubkeysValid, relaysWithNip11s, relaysWithoutNip11s } from "$stores/nip11s";
import { get } from "svelte/store";
import type { Filter } from "nostr-tools";
import type { WebsocketAdapterOptions } from "@nostrwatch/route66/core/WebsocketAdapter";

export const fetchMonitors = async () => {
    const $route66 = await instance();
    await $route66.ready();
    await $route66?.services?.monitors?.bootstrapMonitors();
}

export const fetchMonitorsChecks = async () => {
    const $route66 = await instance();
    await $route66.ready();
    await $route66?.services?.monitors?.bootstrapMonitorsChecks();
}

export const fetchNip11s = async () => {
    const $nip11Service: Nip11Service = get(nip11Service);
    const $relaysWithoutNip11s: string[] = get(relaysWithoutNip11s);
    const $relaysWithNip11s: string[] = get(relaysWithNip11s);
    const relays: string[] = Array.from(new Set([...$relaysWithoutNip11s, ...$relaysWithNip11s]));
    if(relays.length === 0) return;
    const promises: Promise<any>[] = [];
    for(const relay of relays){
        promises.push(new Promise( resolve => {
            setTimeout( resolve, 20000 )
            $nip11Service.check(relay).then( resolve )
        }));
    }
    await Promise.allSettled(promises);
}

export const fetchOperators = async (pubkeys?: string[]) => {
    const $route66 = await instance();
    await $route66.ready();
    if(!pubkeys){
        pubkeys = get(operatorPubkeysValid);
    }
    const emptyFilter: Filter = { kinds: [0, 10002], authors: [] };
    const chunks: Filter[][] = [];
    let filters: Filter[] = [];
    let filter: Filter = structuredClone(emptyFilter);
    for (const pubkey of pubkeys) {
        if (!Array.isArray(filter.authors)) {
            filter.authors = [];
        }
        if (filter.authors.length > 20) {
            filters.push(filter);
            filter = structuredClone(emptyFilter);
            if (filters.length > 10) {
                chunks.push([...filters]);
                filters = [];
            }
        }
        (filter.authors as string[]).push(pubkey);
    }
    
    if ((filter.authors as string[]).length > 0) {
        filters.push(filter);
    }
    
    if (filters.length > 0) {
        chunks.push([...filters]);
    }
    for(const filters of chunks){
        const onevent = (event: IEvent) => { 
            publishEventsToMemoryRelay([event], 'bootstrapOperatorsMeta')
        };
        const onevents = (events: IEvent[]) => {
            publishEventsToMemoryRelay(events, 'bootstrapOperatorsMeta');
        }
        const relays = $route66?.services?.relay?.userMetaRelays || []
        const priority = 1;
        const options: WebsocketAdapterOptions = {
            cache: true,
            returnResults: true, 
            keepAlive: false,
            stream: true,
            batch: 10
        }
        await $route66.subscribe( { relays, filters, priority, options }, { onevents, onevent } );
    }
}

