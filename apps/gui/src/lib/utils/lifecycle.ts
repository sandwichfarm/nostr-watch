import { get, type Updater } from 'svelte/store';

import Nip66, { StateManager } from '@nostrwatch/nip66';

import { Nip66Event, type IEvent } from '@nostrwatch/nip66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { nip66, events, monitorsMap, monitors, eventsArray } from '$lib/stores/index.js';
import { shouldSync, updateLastSync } from '$lib/stores/app.js';

import { addEventsToStore } from '$lib/stores/events-helpers.js';

import type { Monitor, NostrEvent } from "@nostrwatch/nip66/models"
import { generateNip05MapKey, nip05Service } from '$lib/stores/nip05s.js';
import { hasBeenBoostrapped, isBootstrapping, isLivesyncing, isSeeded, nip66Ready } from '../stores/app';
import type { SubscribeHandlers } from '@nostrwatch/nip66/core/WebsocketAdapter';
import { Batcher } from '@nostrwatch/nip66/core';

import NostrSqliteAdapter from '@nostrwatch/nip66-cacheadapter-nostrsqlite';
import NostrToolsAdapter from '@nostrwatch/nip66-wsadapter-nostrtools';

let $monitorsMap: Map<string, Monitor>;

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

let $nip66: Nip66;
let initializing: boolean = false;

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 50, 
    timeout: 30000,
    callback: addEventsToStore
})

export const bindBootstrapEmitters = () => {
    const $nip05Service = get(nip05Service)
    
    if (!$nip66 || typeof $nip66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    $nip66.on('monitor:update', (monitor: Monitor) => {
        monitorsMap.update((monitorsMap) => {
            const existing = monitorsMap.get(monitor.pubkey);
            if (existing?.registration?.created_at && monitor?.registration?.created_at && existing.registration.created_at > monitor.registration.created_at) {
                return monitorsMap;
            }
            const { pubkey } = monitor
            const nip05 = monitor?.profile?.nip05;
            monitorsMap.set(pubkey, monitor);
            if(nip05 && !$nip05Service.find(pubkey, nip05)){
                $nip05Service.check(pubkey, nip05)
            }
            return monitorsMap;
        });
    });    

    $nip66.on('events', (_events: any) => {
        // console.log('Svelte Received events:', _events.length);
        addEventsToStore(_events)
    });
};

export const bindLiveSubscriptionEmitters = () => {
    if (!$nip66 || typeof $nip66.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }
    $nip66.on('event', (event: any) => {
        const key = eventKey(egitvent);
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

export const instance = async (): Promise<Nip66> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    if(initializing) {
        await nip66Ready();
        return get(nip66)
    }

    initializing = true;

    if ($nip66 && $nip66 instanceof Nip66 && $nip66.initialized) {
        console.log('nip66 instance exists.');
        return $nip66;
    }

    $nip66 = $nip66 || get(nip66);

    if (!$nip66) {
        const adapters = {
            cacheAdapter: new NostrSqliteAdapter(),
            websocketAdapter: new NostrToolsAdapter(),
        }; 

        nip66.set(new Nip66(adapters));
        $nip66 = get(nip66)
    }

    if (!$nip66.initialized) {
        await $nip66.init();
        console.log('nip66 initialized');
        loadMonitorsFromCache($nip66);
    }
    else {
        return $nip66;
    }
    
    await $nip66.ready();

    nip66.set($nip66);
    return $nip66;
};

export const loadMonitorsFromCache = () => {
    const monitors = StateManager.get('cache:monitors')
    console.log('Loading monitors from cache:', monitors);
    if(monitors) {
        $nip66?.services?.monitors?.loadMonitors(monitors);
    }
}

export const bootstrapMonitorData = async () => {
    if(!$nip66){
        $nip66 = await instance();
    }
    bindBootstrapEmitters($nip66);
    await $nip66?.services?.monitors?.bootstrapMonitors();
}

export const bootstrapMonitorChecks = async () => {
    if(!$nip66){
        $nip66 = await instance();
    }
    bindBootstrapEmitters();
    await $nip66?.services?.monitors?.syncMonitorsChecks();
}


export const bootstrap = async () => {
    if(!$nip66){
        $nip66 = await instance();
    }
    await $nip66.ready();
    
    bindBootstrapEmitters();

    const onevents = (events: IEvent[]) => {
        for(const event of events){
            liveSyncBatcher.add(event); 
        }
    }
    
    if( shouldSync() ){
        if( get(isBootstrapping) ) return;
        isBootstrapping.set(true)
        $nip66?.services?.monitors?.bootstrap().then( () => {
            isBootstrapping.set(false)
            updateLastSync()
            beginLiveSync({ onevents })
            removeStaleChecksFromStore()
        })
    }
    else {
        console.log('skipping full sync')
        //TODO: Send ready event from Cache Adapter Worker wait on Adapter ready.
        // await $nip66?.adapters?.cache.ready();
        await new Promise( (resolve) => setTimeout(resolve, 1000) ) 
        //
        seedFromCache().then( () => {
            removeStaleChecksFromStore()
            if(get(isLivesyncing)) return;
            beginLiveSync({ onevents })
        });
    }
}

export const beginLiveSync = async (callbacks?: SubscribeHandlers): Promise<void> => {
    isLivesyncing.set(true)
    if(!$nip66){
        $nip66 = await instance();
    }
    $nip66?.services?.monitors?.beginLiveSync(callbacks)
}

export const stopLiveSync = async (): Promise<void> => {
    isLivesyncing.set(false)
    if(!$nip66){
        $nip66 = await instance();
    }
    $nip66?.services?.monitors?.stopLiveSync()
}

type LiveSyncResumer = () => Promise<void>

export const pauseLiveSync = async (): Promise<LiveSyncResumer> => {
    let wasLiveSyncing = get(isLivesyncing) 
    if(!$nip66){
        $nip66 = await instance();
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
    nip66.update(($nip66: Nip66) => {
        if ($nip66 && typeof $nip66.destroy === 'function') {
            $nip66.destroy();
        } else {
            console.error('nip66 instance is missing or does not have a destroy method.');
        }
        return $nip66;
    });
};

export const seedFromCache = async () => {
    if(!$nip66) {
        $nip66 = await instance();
    }
    if(!$nip66) return;
    if(get(isSeeded)) return;
    if(!hasBeenBoostrapped()) return;

    const promises: Promise<any>[] = [];
    $nip66?.services?.monitors?.enabledMonitors?.forEach( async (monitor: Monitor) => {
        promises.push(new Promise( resolve => {
            console.log('!!! begin seeding', monitor.pubkey)
            console.log('loading from cache', monitor.pubkey)
            $nip66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey).then(resolve)
        }));
    })
    const cachedEvents = (await Promise.all(promises)).flat();
    addEventsToStore(cachedEvents || []);
    isSeeded.set(true)
}

export const removeStaleChecksFromStore = async () => {
    const eventsArr: IEvent[] = get(eventsArray)
    if(!eventsArr.length) return console.log('no events to check for staleness');
    const oldKeys: string[] = []
    for(const check of eventsArr.filter( event => event.kind === 30166 )){
        const monitor = $monitorsMap.get(check.pubkey);
        if(!monitor) continue;
        if(monitor.relayIsOnline(check)) continue;
        oldKeys.push(eventKey(check));
    }
    if(oldKeys.length === 0) return console.log('no stale checks found');
    console.log('removing stale checks:', oldKeys)
    const $events: Map<string, NostrEvent> = get(events);
    for(const key of oldKeys){
        $events.delete(key);
    }
    events.set($events);
}