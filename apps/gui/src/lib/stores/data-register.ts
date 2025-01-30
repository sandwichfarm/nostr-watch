import { DataRegister } from "$lib/managers/DataRegister";
import { get, writable, type Writable } from "svelte/store";
import { doBootstrap } from "$stores/routines";
import { doAggregateCache } from "$stores/app";
import { fetchMonitors, fetchMonitorsChecks, fetchNip11s, fetchOperators } from "$lib/fetchers/bootstrap";
import { removeStaleChecksFromStore } from "$utils/lifecycle";

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

    //fetchers: relay
    data.register({
        key: 'relay:checks',
        priority: 10,
        fn: async (relay: string) => {}
    });
    data.register({
        key: 'relay:nip11',
        priority: 11,
        fn: async (relay: string) => {}
    });
    data.register({
        key: 'relay:operator',
        priority: 12,
        fn: async (check: string) => {}
    });

    //fetchers: all (bootstrap)
    data.register({
        key: 'all:monitors',
        priority: 20,
        fn: fetchMonitors,
        expiry: "3h"
    });
    data.register({
        key: 'all:checks',
        priority: 21,
        fn: fetchMonitorsChecks,
        expiry: "30m"
    });
    data.register({
        key: 'all:nip11s',
        priority: 22,
        fn: fetchNip11s,
        expiry: "24h"
    });
    data.register({
        key: 'all:operators',
        priority: 23,
        fn: fetchOperators,
        expiry: "10m"
    });

    //memory lifecycle  
    data.register({
        key: 'memory:clearStale',
        priority: 100,
        fn: removeStaleChecksFromStore
    });

    //composites
    data.composite({
        key: 'bootstrap:force',
        keys: ['all:monitors', 'all:checks', 'all:nip11s', 'all:operators'],
        priority: -10,
        expiry: "1hr",
        ignoreConditions: {
            'all:monitors': true,
            'all:checks': true,
            'all:nip11s': true,
            'all:operators': true
        },
        ignoreExpiries: {
            'all:monitors': true,
            'all:checks': true,
            'all:nip11s': true,
            'all:operators': true
        }
    });

    data.composite({
        key: 'bootstrap:partial',
        keys: ['all:monitors', 'all:checks', 'all:nip11s', 'all:operators'],
        priority: -10,
        expiry: "1hr",
        ignoreConditions: {},
        ignoreExpiries: {}
    });

    //composites
    data.composite({
        key: 'relayData',
        keys: ['relay:checks', 'relay:nip11', 'relay:operator'],
        ignoreConditions: { 
            'relay:checks': true,
            'relay:nip11': true,
            'relay:operator': true
        },
        priority: -20
    });

}