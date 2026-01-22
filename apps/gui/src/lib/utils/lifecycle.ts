import { get, type Unsubscriber } from 'svelte/store';

import Route66, { StateManager } from '@nostrwatch/route66';

import { type IEvent } from '@nostrwatch/route66/models';

import { eventKey } from '$lib/utils/event-keys.js';
import { route66, events, monitorsMap, monitors, eventsArray } from '$lib/stores/index.js';
import { enabledNip66RelayUrls } from '$lib/stores/nip66-relays';

import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers.js';

import type { Monitor, Nip11, NostrEvent } from "@nostrwatch/route66/models"
import { nip05Service } from '$lib/stores/nip05s.js';
import { hasBeenBootstrapped, isBootstrapping, isLivesyncing, isSeeded, route66Ready, tabState, opfsStatus, opfsError } from '../stores/app';
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
import { TabClientCacheAdapter, TabClientWebsocketAdapter } from '$lib/runtime/tab-client-adapters';
import { getLeaderTabRpcClient } from '$lib/runtime/leader-tab-client';
import { isPubkey } from '$utils/nostr';
import { decompress } from 'compress-json';

let $monitorsMap: Map<string, Monitor>;
let emittersBoundTo: Route66 | null = null;
const DEV = import.meta.env.DEV;

monitorsMap.subscribe( ($m: Map<string, Monitor>) => $monitorsMap = $m )

let $route66: Route66 | null;
let initializing: boolean = false;
let runtimeMode: 'leader' | 'client' | null = null;
let nip66RelayUnsubscriber: Unsubscriber | null = null;

let liveSyncBatcher: Batcher<IEvent, any> = new Batcher<IEvent, any>({
    maxLength: 3, 
    timeout: 30000,
    callback: (events: IEvent[]) => publishEventsToMemoryRelay(events, 'livesyncer')
})

let count = 0

/**
 * Update OPFS status stores based on the cache adapter type
 */
const updateOpfsStatus = (r66: Route66 | null) => {
    if (!r66) {
        opfsStatus.set('pending');
        return;
    }

    const cacheAdapter = r66.adapters?.cacheAdapter;
    const adapterName = cacheAdapter?.constructor?.name;

    if (adapterName === 'TabClientCacheAdapter') {
        // Follower tab using RPC - OPFS not applicable
        opfsStatus.set('online'); // Consider it "online" since it's working via RPC
        opfsError.set(null);
    } else if (adapterName === 'NostrSqliteAdapter') {
        // Check if the relay is using SQLite or InMemoryRelay
        const relay = (cacheAdapter as any)?._relay;
        if (relay) {
            // Try to detect if it's using InMemoryRelay (fallback)
            // The relay.worker exists for both, but we can check the relay state
            const state = (relay as any)?.state;
            const relayHandler = state?.relay;
            const relayType = relayHandler?.constructor?.name;

            if (relayType === 'InMemoryRelay') {
                opfsStatus.set('fallback');
                opfsError.set('OPFS unavailable, using in-memory storage');
            } else if (relayType === 'SqliteRelay') {
                opfsStatus.set('online');
                opfsError.set(null);
            } else {
                // Worker-based relay - we can't easily check the type
                // Assume it's working if the adapter is ready
                if (cacheAdapter.isReady) {
                    opfsStatus.set('online');
                    opfsError.set(null);
                } else {
                    opfsStatus.set('pending');
                }
            }
        } else {
            opfsStatus.set('error');
            opfsError.set('Cache adapter relay not initialized');
        }
    } else {
        opfsStatus.set('pending');
    }
};

/**
 * Configure Route66 with user's NIP-66 relay preferences
 * and subscribe to changes
 */
const configureNip66Relays = () => {
    if (!$route66?.services?.monitors) return;

    const monitorService = $route66.services.monitors;
    const relayUrls = get(enabledNip66RelayUrls);

    // Safety: Only replace relays if we have at least one URL
    // Otherwise keep the hardcoded defaults from MonitorService constructor
    if (relayUrls.length > 0) {
        monitorService.setRelays('route66', relayUrls);
        if (DEV) {
            console.log('NIP-66 relays configured:', relayUrls);
        }
    } else {
        if (DEV) {
            console.warn('NIP-66 relay store returned empty array, keeping defaults');
        }
    }

    // Subscribe to changes (only once)
    if (!nip66RelayUnsubscriber) {
        nip66RelayUnsubscriber = enabledNip66RelayUrls.subscribe((urls) => {
            if ($route66?.services?.monitors && urls.length > 0) {
                $route66.services.monitors.setRelays('route66', urls);
                if (DEV) {
                    console.log('NIP-66 relays updated:', urls);
                }
            }
        });
    }
};

export const bindBootstrapEmitters = (from?: string) => {
    if (emittersBoundTo === $route66) return;
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

        try {
            const all: any[] | undefined = ($route66 as any)?.services?.monitors?.array;
            if (all?.length) {
                const cached = all
                    .map((m: any) => (typeof m?.toCache === 'function' ? m.toCache() : null))
                    .filter(Boolean);
                if (cached.length) {
                    StateManager.set('cache:monitors', cached);
                }
            }
        } catch {}
    }


    $route66.off('monitor:update', onMonitorUpdate);
    $route66.off('events', onEvents);
    $route66.on('monitor:update', onMonitorUpdate);    
    $route66.on('events', onEvents);

    emittersBoundTo = $route66;
};

export const instance = async (): Promise<Route66> => {
    //console.log('Lifecycle:instance')
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Window or navigator not available.');
    }

    const desiredMode: 'leader' | 'client' = get(tabState) === 'leader' ? 'leader' : 'client';

    // If mode changed (follower -> leader takeover), force a fresh instance.
    if ($route66 && runtimeMode && runtimeMode !== desiredMode) {
        destroy();
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
    if ($route66 && !runtimeMode) {
        const cacheCtor = ($route66 as any)?.adapters?.cacheAdapter?.constructor?.name as
            | string
            | undefined;
        runtimeMode = cacheCtor === 'TabClientCacheAdapter' ? 'client' : 'leader';
    }

    if (!$route66) {
        //console.log('creating new route66 instance');
        const adapters =
            desiredMode === 'leader'
                ? {
                      cacheAdapter: new NostrSqliteAdapter(),
                      websocketAdapter: new NostrToolsAdapter(),
                  }
                : {
                      cacheAdapter: new TabClientCacheAdapter(),
                      websocketAdapter: new TabClientWebsocketAdapter(),
                  };

        route66.set(new Route66(adapters));
        $route66 = get(route66)
        runtimeMode = desiredMode;
    }

    if (!$route66.initialized) {
        await $route66.init();
        //console.log('route66 initialized');
        loadMonitorsFromCache();
    }

    await $route66.ready();

    // Update OPFS status based on which adapter is in use
    updateOpfsStatus($route66);

    // Configure NIP-66 relays from user preferences
    configureNip66Relays();

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

export const destroy = async () => {
    initializing = false;
    const r66 = $route66;
    $route66 = null;
    runtimeMode = null;
    emittersBoundTo = null;

    // Clean up NIP-66 relay subscription
    if (nip66RelayUnsubscriber) {
        nip66RelayUnsubscriber();
        nip66RelayUnsubscriber = null;
    }

    // Properly shutdown the route66 instance (closes SQLite database and releases OPFS pool)
    if (r66 && typeof r66.shutdown === 'function') {
        try {
            await r66.shutdown();
        } catch (e) {
            console.warn('[lifecycle] Error during route66 shutdown:', e);
        }
    }

    route66.set(null);
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
    // Followers should avoid heavy cache seeding work by default; prefer a lightweight
    // leader-provided snapshot and/or cached aggregates already in StateManager.
    if (get(tabState) !== 'leader') {
        const hasCachedAggregates = Boolean(StateManager.get('aggregate:complete'));
        const hasCachedMonitors = Boolean(StateManager.get('cache:monitors'));

        let snapshotEvents: IEvent[] = [];
        try {
            const res = await getLeaderTabRpcClient().call(
                'sys.snapshot',
                [{ kinds: [30166], limit: 750 }],
                { timeoutMs: 2500 }
            );
            snapshotEvents = (res?.events ?? []) as IEvent[];
        } catch {}

        // Snapshot buffering currently focuses on check events for fast first paint.
        // However, the operators UI requires pubkey metadata events (kinds 0 + 10002)
        // to build `User` rows; without them, follower tabs can show a blank operators
        // page despite having check aggregates. Pull operator metadata from the
        // leader's cache so followers render immediately without hitting relays.
        const operatorPubkeys = new Set<string>();

        // Prefer extracting from snapshot check events when available (most precise).
        if (snapshotEvents.length) {
            for (const ev of snapshotEvents as any[]) {
                const raw = (ev as any)?.json ?? ev;
                if (!raw || typeof raw !== 'object') continue;
                const tags = Array.isArray((raw as any)?.tags) ? ((raw as any).tags as any[]) : [];
                const pTag = tags.find((t: any) => Array.isArray(t) && t[0] === 'p');
                const p = Array.isArray(pTag) ? pTag[1] : undefined;

                let pubkey: string | undefined = typeof p === 'string' ? p : undefined;
                if (!pubkey) {
                    const content = (raw as any)?.content;
                    if (typeof content === 'string' && content.length > 2) {
                        try {
                            const parsed = JSON.parse(content) as any;
                            if (typeof parsed?.pubkey === 'string') pubkey = parsed.pubkey;
                        } catch {}
                    }
                }

                if (typeof pubkey === 'string' && isPubkey(pubkey)) operatorPubkeys.add(pubkey);
            }
        }

        if (operatorPubkeys.size === 0 && hasCachedAggregates) {
            // If snapshot is empty (e.g., immediately after leader restart), fall back to
            // persisted aggregates which still contain operator pubkeys.
            try {
                const compressed = StateManager.get('aggregate:complete') as any;
                const aggregates = decompress(compressed) as any;
                if (Array.isArray(aggregates)) {
                    for (const item of aggregates) {
                        const p = item?.operatorPubkey;
                        if (typeof p === 'string' && isPubkey(p)) operatorPubkeys.add(p);
                    }
                }
            } catch {}
        }

        const pubkeys = Array.from(operatorPubkeys);
        const metaEvents: IEvent[] = [];
        if (pubkeys.length) {
            const chunkSize = 50;
            for (let i = 0; i < pubkeys.length; i += chunkSize) {
                const authors = pubkeys.slice(i, i + chunkSize);
                try {
                    const cached = (await getLeaderTabRpcClient().call(
                        'cache.REQ',
                        [[{ kinds: [0, 10002], authors }]],
                        { timeoutMs: 2500 }
                    )) as IEvent[];
                    if (cached?.length) metaEvents.push(...cached);
                } catch {}
            }
        }

        if (snapshotEvents.length || metaEvents.length) {
            return metaEvents.length ? [...snapshotEvents, ...metaEvents] : snapshotEvents;
        }

        // If we already have persisted UI-friendly caches, treat this tab as "seeded"
        // and let live leader broadcasts fill in the rest.
        if (hasCachedAggregates || hasCachedMonitors) {
            isSeeded.set(true);
            return [];
        }
    }

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
    if (DEV) console.log('enabledMonitors', $route66?.services?.monitors?.enabledMonitors.map( m => m.pubkey ))
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
    if (DEV) console.log('seedMetaFromCache:events', cachedEvents.length)
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
