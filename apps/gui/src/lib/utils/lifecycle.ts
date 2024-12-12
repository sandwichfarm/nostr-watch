import { get, type Updater } from 'svelte/store';

import Nip66, { StateManager } from '@nostrwatch/nip66';

import { Nip66Event, type IEvent } from '@nostrwatch/nip66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { nip66, events, monitorsMap, monitors } from '$lib/stores/index.js';
import { shouldSync, updateLastSync } from '$lib/stores/app.js';

import { addEventsToStore } from '$lib/stores/events-helpers.js';

import type { Monitor } from "@nostrwatch/nip66/models"
import { generateNip05MapKey, nip05Service } from '$lib/stores/nip05s.js';
import { isSeeded } from '../stores/app';

let $monitorsMap: Map<string, Monitor>;

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

export const bindBootstrapEmitters = (nip66Instance: Nip66) => {
    const $nip05Service = get(nip05Service)
    
    if (!nip66Instance || typeof nip66Instance.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    nip66Instance.on('monitor:update', (monitor: Monitor) => {
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

    nip66Instance.on('events', (_events: any) => {
        console.log('Svelte Received events:', _events.length);
        addEventsToStore(_events)
    });
};

export const bindLiveSubscriptionEmitters = (nip66Instance: any) => {
    if (!nip66Instance || typeof nip66Instance.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }
    nip66Instance.on('event', (event: any) => {
        console.log('Svelte Received event:', event.id);
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

export const instance = async (instance?: Nip66): Promise<Nip66> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    if (instance && instance instanceof Nip66 && instance.initialized) {
        console.log('nip66 instance exists.');
        return instance;
    }

    let nip66Instance: Nip66 | null = instance || get(nip66);

    if (!nip66Instance) {
        const N66 = (await import('@nostrwatch/nip66')).default,
              NostrSqliteAdapter = (await import('@nostrwatch/nip66-cacheadapter-nostrsqlite')).default,
              NostrToolsAdapter = (await import('@nostrwatch/nip66-wsadapter-nostrtools')).default;

        const adapters = {
            cacheAdapter: new NostrSqliteAdapter(),
            websocketAdapter: new NostrToolsAdapter(),
        };

        nip66Instance = new N66(adapters);
    }

    if (!nip66Instance.initialized) {
        await nip66Instance.init();
        console.log('nip66 initialized');
    }
    else {
        console.log('nip66 already initialized');
    }

    loadMonitorsFromCache(nip66Instance);

    await nip66Instance.ready();

    nip66.set(nip66Instance);
    return nip66Instance;
};

export const loadMonitorsFromCache = (nip66Instance: Nip66) => {
    const monitors = StateManager.get('cache:monitors')
    console.log('Loading monitors from cache:', monitors);
    if(monitors) {
        nip66Instance?.services?.monitors?.loadMonitors(monitors);
    }
}

export const bootstrapMonitorData = async (_instance?: Nip66) => {
    const nip66Instance = await instance(_instance);
    bindBootstrapEmitters(nip66Instance);
    await nip66Instance?.services?.monitors?.bootstrapMonitors();
}

export const bootstrapMonitorChecks = async (_instance?: Nip66) => {
    const nip66Instance = await instance(_instance);
    bindBootstrapEmitters(nip66Instance);
    await nip66Instance.monitorService.bootstrapMonitorChecks();
}

export const bootstrap = async (_instance?: Nip66) => {
    const $nip66 = await instance(_instance);
    await $nip66.ready();
    
    bindBootstrapEmitters($nip66);
    
    if( shouldSync() ){
        $nip66?.services?.monitors?.bootstrap().then( () => updateLastSync() )
    }
    else {
        console.log('skipping full sync')
        //TODO: Send ready event from Cache Adapter Worker wait on Adapter ready.
        // await $nip66?.adapters?.cache.ready();
        await new Promise( (resolve) => setTimeout(resolve, 1000) ) 
        //
        seedFromCache($nip66);
    }
};

export const destroy = () => {
    nip66.update(($nip66) => {
        if ($nip66 && typeof $nip66.destroy === 'function') {
            $nip66.destroy();
        } else {
            console.error('nip66 instance is missing or does not have a destroy method.');
        }
        return $nip66;
    });
};

export const seedFromCache = async ($nip66?: Nip66) => {
    if(!$nip66) {
        $nip66 = await instance();
    }
    if(!$nip66) return;
    if(get(isSeeded)) return ;

    const promises: Promise<any>[] = [];
    $nip66?.services?.monitors?.enabledMonitors?.forEach( async (monitor: Monitor) => {
        promises.push(new Promise( resolve => {
            console.log('!!! begin seeding', monitor.pubkey)
            console.log('loading from cache', monitor.pubkey)
            $nip66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey)
                .then(resolve)
        }));
    })
    const cachedEvents = (await Promise.all(promises)).flat();
    addEventsToStore(cachedEvents || []);
    isSeeded.set(true)
}