import { get, type Updater } from 'svelte/store';

import Nip66, { StateManager } from '@nostrwatch/nip66';

import { Nip66Event } from '@nostrwatch/nip66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { nip66, events, monitorsMap } from '$lib/stores/index.js';

export const loadFromCache = (nip66Instance: Nip66) => {
    const monitors = StateManager.get('cache:monitors')
    console.log('Loading monitors from cache:', monitors);
    if(monitors) {
        nip66Instance.monitorService.loadMonitors(monitors);
    }
}

export const bindBootstrapEmitters = (nip66Instance: Nip66) => {
    if (!nip66Instance || typeof nip66Instance.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }

    nip66Instance.on('monitor:update', (monitor: any) => {
        monitorsMap.update((monitorsMap) => {
            const existing = monitorsMap.get(monitor.registration.pubkey);
            if (existing && existing.registration.created_at > monitor.registration.created_at) {
                return monitorsMap;
            }
            monitorsMap.set(monitor.registration.pubkey, monitor);
            return monitorsMap;
        });
    });

    const wtf = new Set()

    nip66Instance.on('monitor:update:profile', (monitor: any) => {
        wtf.add(monitor.pubkey)
        // console.log(`EVENT 0 [from emitter]`, monitor.pubkey)
        console.log(`EVENT 0 ${wtf.size} unique pubkeys`)
    });

    

    nip66Instance.on('events', (_events: any) => {
        console.log('Svelte Received events:', _events.length);
        events.update((map) => {
            _events.forEach((event: any) => {
                const key = eventKey(event);
                if (!key) return;
                const existing = map.get(key);
                if (existing && existing.id === event.id) return;
                if (existing && existing.created_at > event.created_at) return;
                map.set(key, new Nip66Event(event));
            });
            return map;
        });
    });
};

export const bindLiveSubscriptionEmitters = (nip66Instance: any) => {
    if (!nip66Instance || typeof nip66Instance.on !== 'function') {
        throw new Error('Invalid nip66Instance: missing `on` method.');
    }
    nip66Instance.on('event', (event: any) => {
        console.log('Svelte Received event:', event.id);
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

export const instance = async (instance?: Nip66): Promise<Nip66> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    if (instance && instance instanceof Nip66) {
        console.log('nip66 instance exists.');
        return instance;
    }

    let nip66Instance: Nip66 | null = get(nip66);

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

    loadFromCache(nip66Instance);

    nip66.set(nip66Instance);
    return nip66Instance;
};


export const bootstrapMonitorData = async (_instance?: Nip66) => {
    const nip66Instance = await instance(_instance);
    bindBootstrapEmitters(nip66Instance);
    await nip66Instance.monitorService.bootstrapMonitors();
}

export const bootstrapMonitorChecks = async (_instance?: Nip66) => {
    const nip66Instance = await instance(_instance);
    bindBootstrapEmitters(nip66Instance);
    await nip66Instance.monitorService.bootstrapMonitorChecks();
}

export const bootstrap = async (_instance?: Nip66) => {
    const nip66Instance = await instance(_instance);
    bindBootstrapEmitters(nip66Instance);
    await nip66Instance.monitorService.bootstrap();
    // bindLiveSubscriptionEmitters(nip66Instance);
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
