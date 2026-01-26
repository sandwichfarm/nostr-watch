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
import { isBootstrapping, lastCompleteSync, setStatsAsOf } from "$lib/stores/app";
import { StateManager } from "@nostrwatch/route66";

export const fetchMonitors = async () => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();
    await $route66?.services?.monitors?.bootstrapMonitors();
}

export const fetchMonitorsChecks = async (): Promise<IEvent[]> => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();
    const res = await $route66?.services?.monitors?.bootstrapMonitorsChecks();
    const events = Array.isArray(res) ? (res as IEvent[]) : [];

    // Only advance the UI "as of" reference when this sync is not part of a larger
    // bootstrapping composite; composites update `statsAsOf` on completion.
    if (!get(isBootstrapping) && events.length) {
        const now = Math.round(Date.now() / 1000);
        lastCompleteSync.set(now);
        try {
            StateManager.set('lastCompleteSync', now);
        } catch {}
        setStatsAsOf(now, { persist: true });
    }

    return events;
}

// Fetch additional checks from active-but-disabled monitors to broaden relay coverage.
// This should run after `fetchMonitors()` has populated monitors + active status.
export const fetchDisabledMonitorsChecks = async (): Promise<IEvent[]> => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();
    const res = await $route66?.services?.monitors?.fetchDisabledMonitorsChecks();
    return Array.isArray(res) ? (res as IEvent[]) : [];
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

/**
 * Backfill historical check events for offline/dead relay counts.
 * Fetches events older than the "online" window up to the dead threshold (30 days).
 * Runs at low priority after initial sync completes.
 */
export const backfillMonitorChecks = async () => {
    const $route66 = await instance();
    await $route66.ready();
    bindBootstrapEmitters();

    const monitorService = $route66?.services?.monitors;
    if (!monitorService) return;

    const enabledMonitors = monitorService.enabledMonitors || [];
    if (!enabledMonitors.length) return;

    const now = Math.round(Date.now() / 1000);
    const DEAD_THRESHOLD_SECONDS = 30 * 24 * 60 * 60; // 30 days

    // Build filters for historical events (between online window and dead threshold)
    const filters: Filter[] = [];
    for (const monitor of enabledMonitors) {
        const frequency = monitor?.registration?.frequency || (12 * 60 * 60);
        const onlineAfter = now - frequency;
        const deadBefore = now - DEAD_THRESHOLD_SECONDS;

        // Get events from dead threshold up to online window (offline + dead range)
        filters.push({
            kinds: [30166],
            authors: [monitor.pubkey],
            since: deadBefore,
            until: onlineAfter - 1, // Don't overlap with online window
        });
    }

    if (!filters.length) return;

    const relays = monitorService.nip66Relays || [];
    const options: WebsocketAdapterOptions = {
        cache: true,
        returnResults: true,
        keepAlive: false,
        stream: true,
        batch: 50, // Smaller batches for background work
    };

    // Fetch in chunks to avoid overwhelming relays
    const chunkSize = 5;
    for (let i = 0; i < filters.length; i += chunkSize) {
        const chunk = filters.slice(i, i + chunkSize);
        try {
            await $route66.fetch({ relays, filters: chunk, options, priority: 10 });
        } catch (e) {
            console.warn('[backfillMonitorChecks] chunk failed:', e);
        }
        // Yield to browser between chunks
        await delay(100);
    }
};

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
