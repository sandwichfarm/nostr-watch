import { get, type Writable, type Readable } from 'svelte/store';

import Route66, { StateManager } from '@nostrwatch/route66';

import { Nip66CheckEvent, type IEvent } from '@nostrwatch/route66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { route66, events, monitorsMap, monitors, eventsArray } from '$lib/stores/index.js';
import { shouldSync, updateLastSync } from '$lib/stores/app.js';

import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers.js';

import type { Monitor, Nip11, NostrEvent } from "@nostrwatch/route66/models"
import { nip05Service } from '$lib/stores/nip05s.js';
import { hasBeenBoostrapped, isBootstrapping, isLivesyncing, isSeeded, route66Ready } from '../stores/app';
import type { SubscribeHandlers, WebsocketAdapterOptions } from '@nostrwatch/route66/core/WebsocketAdapter';
import { Batcher } from '@nostrwatch/route66/core';

import NostrSqliteAdapter from '@nostrwatch/route66-cacheadapter-nostrsqlite';
import NostrToolsAdapter from '@nostrwatch/route66-wsadapter-nostrtools';
import type { Nip05Service } from '../services/Nip05Service';
import type { Nip05 } from 'nostr-tools/nip05';
import { nip11Service, operatorPubkeys, operatorPubkeysValid, relaysWithNip11s, relaysWithoutNip11s } from '../stores';
import { userService } from '../stores/user';
import type { UserService } from '../services/UserService';
import type { Filter } from 'nostr-tools';
import type { Nip11Service } from '../services/Nip11Service';

let $monitorsMap: Map<string, Monitor>;

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

let $route66: Route66;
let initializing: boolean = false;

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 50, 
    timeout: 30000,
    callback: publishEventsToMemoryRelay
})

let count = 0

export const bindBootstrapEmitters = () => {
    //console.log('Lifecycle:bindBootstrapEmitters')
    const $nip05Service: Nip05Service = get(nip05Service)
    
    if (!$route66 || typeof $route66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    const onEvents = (_events: IEvent[]) => {
        count++
        publishEventsToMemoryRelay(_events)
    }

    const onMonitorUpdate = (monitor: Monitor) => {
        //console.log('monitor.events', monitor.events)
        if(monitor?.events) {
            publishEventsToMemoryRelay(monitor.events)
        }
        monitorsMap.update((monitorsMap: Map<string, Monitor>) => {
            const existing = monitorsMap.get(monitor.pubkey);
            if (existing?.registration?.created_at && monitor?.registration?.created_at && existing.registration.created_at > monitor.registration.created_at) {
                return monitorsMap;
            }
            const { pubkey } = monitor
            const nip05: Nip05 | undefined = monitor?.profile?.nip05;
            monitorsMap.set(pubkey, monitor);
            if(nip05 && !$nip05Service.find(pubkey, nip05)){
                $nip05Service.check(pubkey, nip05)
            }
            return monitorsMap;
        });
    }


    $route66.off('monitor:update', onMonitorUpdate);
    $route66.off('events', onEvents);
    $route66.on('monitor:update', onMonitorUpdate);    
    $route66.on('events', onEvents);
};

export const instance = async (): Promise<Route66> => {
    //console.log('Lifecycle:instance')
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    if(initializing) {
        await route66Ready();
        return get(route66)
    }

    initializing = true;

    if ($route66 && $route66 instanceof Route66 && $route66.initialized) {
        //console.log('route66 instance exists and is initialized');
        return $route66;
    }

    $route66 = $route66 || get(route66);

    if (!$route66) {
        //console.log('creating new route66 instance');
        const adapters = {
            cacheAdapter: new NostrSqliteAdapter(),
            websocketAdapter: new NostrToolsAdapter(),
        }; 

        route66.set(new Route66(adapters));
        $route66 = get(route66)
    }

    if (!$route66.initialized) {
        await $route66.init();
        //console.log('route66 initialized');
        loadMonitorsFromCache($route66);
    }
    
    await $route66.ready();

    route66.set($route66);
    return $route66;
};

export const loadMonitorsFromCache = () => {
    const monitors = StateManager.get('cache:monitors')
    if(monitors) {
        $route66?.services?.monitors?.loadMonitors(monitors);
    }
}

export const bootstrapMonitorData = async () => {
    //console.log('bootstrapMonitorData')
    if(!$route66){
        $route66 = await instance();
    }
    bindBootstrapEmitters();
    await $route66?.services?.monitors?.bootstrapMonitors();
}

export const bootstrapMonitorChecks = async () => {
    if(!$route66){
        $route66 = await instance();
    }
    bindBootstrapEmitters();
    await $route66?.services?.monitors?.syncMonitorsChecks();
}

export const bootstrap = async () => {
    //console.log('bootstrap')
    if(!$route66){
        $route66 = await instance();
    }
    await $route66.ready();
    bindBootstrapEmitters();
    const onevents = (events: IEvent[]) => {
        for(const event of events){
            liveSyncBatcher.add(event); 
        }
    }
    if( shouldSync() ){
        //console.log('bootstrap:syncing')
        if( get(isBootstrapping) ) return;
        isBootstrapping.set(true)
        await $route66?.services?.monitors?.bootstrap().then( async () => {
            await fetchNip11s()
            await bootstrapOperatorMeta()
            isBootstrapping.set(false)
            seedFromCache();
            updateLastSync();
            removeStaleChecksFromStore()
        })
    }
    else {
        //console.log('bootstrap:skipping')
        await new Promise( (resolve) => setTimeout(resolve, 1000) )         
        seedFromCache().then( () => {
            if(get(isLivesyncing)) return;
            beginLiveSync({ onevents })
        });
    }
}

export const bootstrapOperatorMeta = async () => {
    //console.log('bootstrapOperatorMeta');
    const $operatorPubkeysValid: string[] = get(operatorPubkeysValid);
    const emptyFilter: Filter = { kinds: [0, 10002], authors: [] };
    const chunks: Filter[][] = [];
    let filters: Filter[] = [];
    let filter: Filter = structuredClone(emptyFilter);
    
    for (const pubkey of $operatorPubkeysValid) {
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
            publishEventsToMemoryRelay([event])
        };
        const onevents = (events: IEvent[]) => {
            publishEventsToMemoryRelay(events);
        }
        const relays = $route66?.services?.relay?.userMetaRelays || []
        const priority = 1;
        const options: WebsocketAdapterOptions = {
            cache: true,
            returnResults: true, 
            keepAlive: false,
            stream: true,
            batch: 20
        }
        await $route66.subscribe( { relays, filters, priority, options }, { onevents, onevent } );
    }
}

const fetchNip11s = async () => {
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
    const debug = setInterval( () => { 
        //console.log('fetchNip11s:total', promises.length)
        //console.log('fetchNip11s:waiting', promises.filter( (p) => p?.status === 'pending').length)
    }, 1000)
    await Promise.allSettled(promises);
    clearInterval(debug)
    //console.log('fetchNip11s:done')
}

type LiveSyncResumer = () => Promise<void>

export const beginLiveSync = async (callbacks?: SubscribeHandlers): Promise<void> => {
    //console.log('starting live sync')
    isLivesyncing.set(true)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.beginLiveSync(callbacks)
}

export const stopLiveSync = async (): Promise<void> => {
    //console.log('stopping live sync')
    isLivesyncing.set(false)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.stopLiveSync()
}

export const pauseLiveSync = async (): Promise<LiveSyncResumer> => {
    //console.log('pausing live sync')
    let wasLiveSyncing = get(isLivesyncing)? true: false;
    if(!$route66){
        $route66 = await instance();
    }
    if(wasLiveSyncing){
        await stopLiveSync()
    }
    return async () => {
        if(wasLiveSyncing){
            beginLiveSync()
        }
    }
}

export const destroy = () => {
    //console.log('Lifecycle:destroy')
    route66.update(($route66: Route66) => {
        if ($route66 && typeof $route66.destroy === 'function') {
            $route66.destroy();
        } else {
            console.error('route66 instance is missing or does not have a destroy method.');
        }
        return $route66;
    });
};

export const canSeedFromCache = async (): boolean => {
    if(!$route66) {
        $route66 = await instance();
    }
    if(!$route66) return false;
    if(get(isSeeded)) return false;
    if(!hasBeenBoostrapped()) return false;
    return true
}

export const seedFromCache = async () => {
    seedChecksFromCache()
    seedMetaFromCache()
}   

export const seedChecksFromCache = async () => {
    if(!canSeedFromCache()) return;
    const promises: Promise<any>[] = [];
    $route66?.services?.monitors?.enabledMonitors?.forEach( async (monitor: Monitor) => {
        promises.push(new Promise( resolve => {
            $route66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey).then(resolve)
        }));
    })
    const cachedEvents = (await Promise.all(promises)).flat();
    if(cachedEvents.length === 0) return;
    publishEventsToMemoryRelay(cachedEvents);
    isSeeded.set(true)
}

export const seedMetaFromCache = async () => {
    if(!$route66) {
        $route66 = await instance();
    }
    await $route66.ready();
    if(!$route66) return;
    if(get(isSeeded)) return;
    if(!hasBeenBoostrapped()) return;

    const cachedEvents = await $route66.REQ([{ kinds: [ 0, 10002 ]}])
    if(!cachedEvents?.length) return;
    publishEventsToMemoryRelay(cachedEvents);
}

export const seedAllEventsFromCache = async () => {
    if(!$route66) {
        $route66 = await instance();
    }
    if(!$route66) return;
    if(get(isSeeded)) return;
    if(!hasBeenBoostrapped()) return;

    const cachedEvents = await $route66.REQ([{}])
    if(cachedEvents.length === 0) return;
    publishEventsToMemoryRelay(cachedEvents);
}

export const removeStaleChecksFromStore = async () => {
    const eventsArr: IEvent[] = get(eventsArray)
    if(!eventsArr.length) return
    const oldKeys: string[] = []
    for(const check of eventsArr.filter( event => event.kind === 30166 )){
        const monitor = $monitorsMap.get(check.pubkey);
        if(!monitor) continue;
        if(monitor.relayIsOnline(check)) continue;
        oldKeys.push(eventKey(check));
    }
    if(oldKeys.length === 0) return
    const $events: Map<string, NostrEvent> = get(events);
    for(const key of oldKeys){
        $events.delete(key);
    }
    events.set($events);
}