import { get } from 'svelte/store';

import Route66, { StateManager } from '@nostrwatch/route66';

import { Nip66Event, type IEvent } from '@nostrwatch/route66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { route66, events, monitorsMap, monitors, eventsArray } from '$lib/stores/index.js';
import { shouldSync, updateLastSync } from '$lib/stores/app.js';

import { addEventsToStore } from '$lib/stores/events-helpers.js';

import type { Monitor, NostrEvent } from "@nostrwatch/route66/models"
import { nip05Service } from '$lib/stores/nip05s.js';
import { hasBeenBoostrapped, isBootstrapping, isLivesyncing, isSeeded, route66Ready } from '../stores/app';
import type { SubscribeHandlers } from '@nostrwatch/route66/core/WebsocketAdapter';
import { Batcher } from '@nostrwatch/route66/core';

import NostrSqliteAdapter from '@nostrwatch/route66-cacheadapter-nostrsqlite';
import NostrToolsAdapter from '@nostrwatch/route66-wsadapter-nostrtools';
import type { Nip05Service } from '../services/Nip05Service';
import type { Nip05 } from 'nostr-tools/nip05';

let $monitorsMap: Map<string, Monitor>;

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

let $route66: Route66;
let initializing: boolean = false;

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 50, 
    timeout: 30000,
    callback: addEventsToStore
})

export const bindBootstrapEmitters = () => {
    console.log('Lifecycle:bindBootstrapEmitters')
    const $nip05Service: Nip05Service = get(nip05Service)
    
    if (!$route66 || typeof $route66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    $route66.on('monitor:update', (monitor: Monitor) => {
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
    });    

    $route66.on('events', (_events: any) => {
        console.log('Svelte Received events:', _events.length);
        addEventsToStore(_events)
    });
};

export const bindLiveSubscriptionEmitters = () => {
    console.log('bindLiveSubscriptionEmitters')
    if (!$route66 || typeof $route66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }
    $route66.on('event', (event: any) => {
        const key = eventKey(event);
        if (!key) return;
        events.update((currentEvents: Map<string, any>) => {
            const existing = currentEvents.get(key);
            if (existing && existing.id === event.id) return currentEvents;
            if (existing && existing.created_at > event.created_at) return currentEvents;
            currentEvents.set(key, new Nip66Event(event));
            return currentEvents; 
        });
    });
}

export const instance = async (): Promise<Route66> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    if(initializing) {
        await route66Ready();
        return get(route66)
    }

    initializing = true;

    if ($route66 && $route66 instanceof Route66 && $route66.initialized) {
        console.log('route66 instance exists and is initialized');
        return $route66;
    }

    $route66 = $route66 || get(route66);

    if (!$route66) {
        console.log('creating new route66 instance');
        const adapters = {
            cacheAdapter: new NostrSqliteAdapter(),
            websocketAdapter: new NostrToolsAdapter(),
        }; 

        route66.set(new Route66(adapters));
        $route66 = get(route66)
    }

    if (!$route66.initialized) {
        await $route66.init();
        console.log('route66 initialized');
        loadMonitorsFromCache($route66);
    }
    
    await $route66.ready();

    route66.set($route66);
    return $route66;
};

export const loadMonitorsFromCache = () => {
    const monitors = StateManager.get('cache:monitors')
    console.log('Loading monitors from cache:', monitors.length);
    if(monitors) {
        $route66?.services?.monitors?.loadMonitors(monitors);
    }
}

export const bootstrapMonitorData = async () => {
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
    console.log('bootstrap')
    if(!$route66){
        console.log('bootstrap:no instance')
        $route66 = await instance();
    }
    await $route66.ready();
    console.log('bootstrap:ready')
    bindBootstrapEmitters();
    const onevents = (events: IEvent[]) => {
        for(const event of events){
            liveSyncBatcher.add(event); 
        }
    }
    if( shouldSync() ){
        if( get(isBootstrapping) ) return;
        isBootstrapping.set(true)
        $route66?.services?.monitors?.bootstrap().then( () => {
            isBootstrapping.set(false)
            updateLastSync()
            beginLiveSync({ onevents })
            removeStaleChecksFromStore()
        })
    }
    else {
        await new Promise( (resolve) => setTimeout(resolve, 1000) )         
        seedFromCache().then( () => {
            if(get(isLivesyncing)) return;
            beginLiveSync({ onevents })
        });
    }
}

type LiveSyncResumer = () => Promise<void>

export const beginLiveSync = async (callbacks?: SubscribeHandlers): Promise<void> => {
    isLivesyncing.set(true)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.beginLiveSync(callbacks)
}

export const stopLiveSync = async (): Promise<void> => {
    isLivesyncing.set(false)
    if(!$route66){
        $route66 = await instance();
    }
    $route66?.services?.monitors?.stopLiveSync()
}

export const pauseLiveSync = async (): Promise<LiveSyncResumer> => {
    console.log('Lifecycle:pauseLiveSync')
    let wasLiveSyncing = get(isLivesyncing) 
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
    console.log('Lifecycle:destroy')
    route66.update(($route66: Route66) => {
        if ($route66 && typeof $route66.destroy === 'function') {
            $route66.destroy();
        } else {
            console.error('route66 instance is missing or does not have a destroy method.');
        }
        return $route66;
    });
};

export const seedFromCache = async () => {
    if(!$route66) {
        $route66 = await instance();
    }
    if(!$route66) return;
    if(get(isSeeded)) return;
    if(!hasBeenBoostrapped()) return;

    const promises: Promise<any>[] = [];
    $route66?.services?.monitors?.enabledMonitors?.forEach( async (monitor: Monitor) => {
        promises.push(new Promise( resolve => {
            //console.log('!!! begin seeding', monitor.pubkey)
            //console.log('loading from cache', monitor.pubkey)
            $route66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey).then(resolve)
        }));
    })
    const cachedEvents = (await Promise.all(promises)).flat();
    // StateManager.emit(`events`, cachedEvents);
    addEventsToStore(cachedEvents ?? []);
    isSeeded.set(true)
}

export const removeStaleChecksFromStore = async () => {
    const eventsArr: IEvent[] = get(eventsArray)
    if(!eventsArr.length) return //console.log('no events to check for staleness');
    const oldKeys: string[] = []
    for(const check of eventsArr.filter( event => event.kind === 30166 )){
        const monitor = $monitorsMap.get(check.pubkey);
        if(!monitor) continue;
        if(monitor.relayIsOnline(check)) continue;
        oldKeys.push(eventKey(check));
    }
    if(oldKeys.length === 0) return //console.log('no stale checks found');
    const $events: Map<string, NostrEvent> = get(events);
    for(const key of oldKeys){
        $events.delete(key);
    }
    events.set($events);
}