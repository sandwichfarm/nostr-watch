import { DataRegister } from "$lib/managers/DataRegister";
import { get, writable, type Writable } from "svelte/store";
import { doBootstrap } from "$stores/routines";
import { doAggregateCache, isBootstrapped, isSeeded } from "$stores/app";
import { fetchMonitors, fetchMonitorsChecks, fetchNip11s, fetchOperators } from "$lib/fetchers/bootstrap";
import { beginLiveSync, bindBootstrapEmitters, instance, liveSync, removeStaleChecksFromStore, seedFromCache } from "$utils/lifecycle";
import { publishEventsToMemoryRelay } from "./events-helpers";
import { delay } from "@nostrwatch/utils";
import type { IEvent } from "@nostrwatch/route66/models/Event";
import { fetchRelayChecks, fetchRelayNip11, fetchRelayOperator } from "$lib/fetchers/relay";

export const dataRegister: Writable<DataRegister> = writable(new DataRegister())

export const dataRegisterInit = async () => {
    const data = get(dataRegister);
    
    //state
    data.register({
        key: 'set:bootstrapped',
        priority: 1,
        fn: async (value: boolean) => { doBootstrap.set(value) }
    });

    data.register({
        key: 'set:cacheAggregates',
        priority: 1,
        fn: async (value: boolean) => { doAggregateCache.set(value) }
    });

    const relayKeyFn = (key: string, params: string[]) => { 
        const relay = params[0]
        if (!relay) return key;
        console.log('relayKeyFn', key, params,  `${key}:${params[0]}`)
        return `${key}:${params[0]}`;
    }

    //fetchers: relay
    data.register({
        key: 'sync:relay:checks',
        priority: 10,
        keyFn: relayKeyFn,
        fn: fetchRelayChecks
    });
    data.register({
        key: 'sync:relay:nip11',
        priority: 11,
        keyFn: relayKeyFn,
        fn: fetchRelayNip11
    });
    data.register({
        key: 'sync:relay:operator',
        priority: 12,
        keyFn: relayKeyFn,
        fn: fetchRelayOperator
    });

    //fetchers: all (bootstrap)
    data.register({
        key: 'sync:monitors',
        priority: 20,
        expiry: "45m",
        fn: fetchMonitors,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:checks',
        priority: 21,
        expiry: "30m",
        fn: fetchMonitorsChecks,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:nip11s',
        priority: 22,
        expiry: "24h",
        fn: fetchNip11s
    });
    data.register({
        key: 'sync:operators',
        priority: 23,
        expiry: "30m",
        condition: async () => !get(isSeeded), 
        fn: fetchOperators,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:live',
        priority: 200,
        fn: async () => liveSync()
    })
    //cache: all (bootstrap)
    data.register({
        key: 'sync:cache',
        priority: 3,
        fn: seedFromCache,
        condition: async () => {
            return !get(isSeeded) && get(isBootstrapped)
        },
        onComplete: async (events: IEvent[]): Promise<any> => {
            publishEventsToMemoryRelay(events, 'cache')
            if(!events?.length) return 
            isSeeded.set(true)
            return events?.length ?? 0;
        }
    });

    //memory lifecycle  
    data.register({
        key: 'memory:clearStale',
        priority: 100,
        fn: removeStaleChecksFromStore
    });

    //composites
    data.composite({
        key: 'sync:all',
        keys: ['sync:monitors', 'sync:checks', 'sync:nip11s', 'sync:operators', 'sync:live'],
        priority: -10,
        onComplete: async () => isBootstrapped.set(true),
        ignoreConditions: {},
        ignoreExpiries: {}
    });
    
    data.composite({
        key: 'sync:all-force',
        keys: ['sync:monitors', 'sync:checks', 'sync:nip11s', 'sync:operators', 'sync:live'],
        priority: -10,
        onComplete: async () => isBootstrapped.set(true),
        ignoreConditions: {
            'sync:monitors': true,
            'sync:checks': true,
            'sync:nip11s': true,
            'sync:operators': true
        },
        ignoreExpiries: {
            'sync:monitors': true,
            'sync:checks': true,
            'sync:nip11s': true,
            'sync:operators': true
        }
    });

    //composites
    data.composite({
        key: 'sync:relay',
        keys: ['sync:relay:checks', 'sync:relay:nip11', 'sync:relay:operator'],
        ignoreConditions: { 
            'sync:relay:checks': true,
            'sync:relay:nip11': true,
            'sync:relay:operator': true
        },
        priority: -20
    });

    await (await instance()).ready()
    await delay(1000)
    data.unlock();
}