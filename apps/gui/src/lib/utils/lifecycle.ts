import { get } from 'svelte/store';

import Route66, { StateManager } from '@nostrwatch/route66';

import { type IEvent } from '@nostrwatch/route66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { route66, events, monitorsMap, monitors, eventsArray } from '$lib/stores/index.js';

import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers.js';

import type { Monitor, Nip11, NostrEvent } from "@nostrwatch/route66/models"
import { nip05Service } from '$lib/stores/nip05s.js';
import { hasBeenBootstrapped, isBootstrapping, isLivesyncing, isSeeded, route66Ready } from '../stores/app';
import type { SubscribeHandlers, WebsocketAdapterOptions } from '@nostrwatch/route66/core/WebsocketAdapter';
import { Batcher } from '@nostrwatch/route66/core';

import NostrSqliteAdapter from '@nostrwatch/route66-cacheadapter-nostrsqlite';
import NostrToolsAdapter from '@nostrwatch/route66-wsadapter-nostrtools';

import type { Nip05Service } from '../services/Nip05Service';
import type { Nip05 } from 'nostr-tools/nip05';
import { nip11Service, operatorPubkeysValid } from '../stores';
import type { Filter } from 'nostr-tools';
import type { Nip11Service } from '../services/Nip11Service';
import { relaysWithNip11s$, relaysWithoutNip11s$ } from '$stores/helpers/helpers-nip11s';

let $monitorsMap: Map<string, Monitor>;
let emittersBound: boolean = false; 

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

let $route66: Route66 | null;
let initializing: boolean = false;

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 3, 
    timeout: 30000,
    callback: (events: IEvent[]) => publishEventsToMemoryRelay(events, 'livesyncer')
})

let count = 0

export const bindBootstrapEmitters = (from?: string) => {
    if(emittersBound) return;
    // if(from) console.log('Lifecycle:bindBootstrapEmitters', from)
    const $nip05Service: Nip05Service = get(nip05Service)
    
    if (!$route66 || typeof $route66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    const onEvents = (_events: IEvent[]) => {
        // console.log('onEvents', from)
        count++
        publishEventsToMemoryRelay(_events, 'onEvents')
    }

    const onMonitorUpdate = (monitor: Monitor) => {
        // console.log('onMonitorUpdate')
        // console.log('monitor.events', monitor.events)
        if(monitor?.events) {
            publishEventsToMemoryRelay(monitor.events, 'onMonitorUpdate')
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

    emittersBound = true;
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
    bindBootstrapEmitters('bootstrapMonitorData');
    await $route66?.services?.monitors?.bootstrapMonitors();
}

export const bootstrapMonitorChecks = async () => {
    if(!$route66){
        $route66 = await instance();
    }
    bindBootstrapEmitters('bootstrapMonitorChecks');
    await $route66?.services?.monitors?.syncMonitorsChecks();
}

// export const bootstrap = async () => {
//     //console.log('bootstrap')
//     if(!$route66){
//         $route66 = await instance();
//     }
//     await $route66.ready();
//     // await $route66?.cacheAdapter?.relay.debug();
//     bindBootstrapEmitters('bootstrap');
//     if( shouldSync() ){
//         console.log('bootstrap:syncing')
//         if( get(isBootstrapping) ) return;
//         isBootstrapping.set(true)
//         // await bootstrapMonitorData();
//         // await bootstrapMonitorChecks();
//         await $route66?.services?.monitors?.bootstrap()
//         updateLastSync();
//         seedFromCache();
//         await fetchNip11s()
//         await bootstrapOperatorsMeta()
//     }
//     else {
//         console.log('seeding from cache')
//         await new Promise( (resolve) => setTimeout(resolve, 1000) )     
//         await seedFromCache();
//         if(get(monitorsMap).size === 0){
//             await bootstrapMonitorData();
//         }
//         await bootstrapMonitorChecks();
//         await bootstrapOperatorsMeta();
//     }
//     isBootstrapping.set(false)
//     removeStaleChecksFromStore()
// }

// export const liveSync = () => {
//     if(get(isLivesyncing)) return;
//     const onevents = (events: IEvent[]) => {
//         for(const event of events){
//             liveSyncBatcher.add(event); 
//         }
//     }
//     beginLiveSync({ onevents })
// }

export const bootstrapOperatorsMeta = async (pubkeys?: string[]) => {

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

// export const fetchNip11s = async () => {
//     const $nip11Service: Nip11Service = get(nip11Service);
//     const $relaysWithoutNip11s: string[] = get(relaysWithoutNip11s$());
//     const $relaysWithNip11s: string[] = get(relaysWithNip11s$());
//     const relays: string[] = Array.from(new Set([...$relaysWithoutNip11s, ...$relaysWithNip11s]));
//     if(relays.length === 0) return;
//     const promises: Promise<any>[] = [];
//     for(const relay of relays){
//         promises.push(new Promise( resolve => {
//             setTimeout( resolve, 20000 )
//             $nip11Service.check(relay).then( resolve )
//         }));
//     }
//     // const debug = setInterval( () => { 
//         //console.log('fetchNip11s:total', promises.length)
//         //console.log('fetchNip11s:waiting', promises.filter( (p) => p?.status === 'pending').length)
//     // }, 1000)
//     await Promise.allSettled(promises);
//     // clearInterval(debug)
//     //console.log('fetchNip11s:done')
// }

// type LiveSyncResumer = () => Promise<void>

// export const beginLiveSync = async (callbacks?: SubscribeHandlers): Promise<void> => {
//     isLivesyncing.set(true)
//     if(!$route66){
//         $route66 = await instance();
//     }
//     $route66?.services?.monitors?.beginLiveSync(callbacks)
// }

// export const stopLiveSync = async (): Promise<void> => {
//     isLivesyncing.set(false)
//     if(!$route66){
//         $route66 = await instance();
//     }
//     $route66?.services?.monitors?.stopLiveSync()
// }

// export const pauseLiveSync = async (): Promise<LiveSyncResumer> => {
//     let wasLiveSyncing = get(isLivesyncing)? true: false;
//     if(!$route66){
//         $route66 = await instance();
//     }
//     if(wasLiveSyncing){
//         await stopLiveSync()
//     }
//     return async () => {
//         if(wasLiveSyncing){
//             beginLiveSync()
//         }
//     }
// }

export const destroy = () => {
    initializing = false;
    $route66 = null;
    route66.update( ($route66) => {
        if ($route66 && typeof $route66.destroy === 'function') {
            $route66.destroy();
        } else {
            console.error('route66 instance is missing or does not have a destroy method.');
        }
        return null;
    });
};

export const canSeedFromCache = async (): boolean => {
    if(!$route66) {
        $route66 = await instance();
    }
    if(!$route66) return false;
    // if(get(isSeeded)) return false;
    if(!hasBeenBootstrapped()) return false;
    return true
}

export const seedFromCache = async (): Promise<IEvent[]> => {
    const checks = await seedChecksFromCache()
    const meta = await seedMetaFromCache()
    // console.log('seedFromCache', [checks, meta].flat())
    return [checks, meta].flat().filter(  (e) => e !== undefined )
}   

export const seedChecksFromCache = async () => {
    if(!$route66){
        $route66 = await instance();
    }
    await $route66.ready();
    const promises: Promise<any>[] = [];
    console.log('enabledMonitors', $route66?.services?.monitors?.enabledMonitors.map( m => m.pubkey ))
    $route66?.services?.monitors?.enabledMonitors?.forEach( async (monitor: Monitor) => {
        promises.push(new Promise( resolve => {
            $route66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey).then(resolve)
        }));
    })
    const cachedEvents = (await Promise.all(promises)).flat();
    if(cachedEvents.length === 0) return;
    isSeeded.set(true)
    return cachedEvents
}

export const seedMetaFromCache = async () => {
    if(!$route66) {
        $route66 = await instance();
    }
    await $route66.ready();
    // if(!$route66) return [];
    const cachedEvents = await $route66.REQ([{ kinds: [ 0, 10002 ]}])
    if(!cachedEvents?.length) return [];
    console.log('seedMetaFromCache:events', cachedEvents.length)
    return cachedEvents
}

export const seedAllEventsFromCache = async () => {
    if(!$route66) {
        $route66 = await instance();
    }
    await $route66.ready();
    if(get(isSeeded)) return [];
    // if(!hasBeenBootstrapped()) return;
    const cachedEvents = await $route66.REQ([{}])
    if(!cachedEvents?.length) return [];
    publishEventsToMemoryRelay(cachedEvents, 'seedAllEventsFromCache');
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