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
        priority: 2,
        fn: async (value: boolean) => { doAggregateCache.set(value) }
    });

    //fetchers: relay
    data.register({
        key: 'relay:checks',
        priority: 14,
        fn: async (relay: string) => {}
    });
    data.register({
        key: 'relay:nip11',
        priority: 14,
        fn: async (relay: string) => {}
    });
    data.register({
        key: 'relay:operator',
        priority: 14,
        fn: async (check: string) => {}
    });

    //fetchers: all (bootstrap)
    data.register({
        key: 'all:monitors',
        priority: 20,
        fn: fetchMonitors
    });
    data.register({
        key: 'all:checks',
        priority: 21,
        fn: fetchMonitorsChecks
    });
    data.register({
        key: 'all:checks',
        priority: 22,
        fn: fetchNip11s
    });
    data.register({
        key: 'all:operators',
        priority: 23,
        fn: fetchOperators
    });

    //memory lifecycle  
    data.register({
        key: 'memory:clearStale',
        priority: 100,
        fn: removeStaleChecksFromStore
    });

    //composites
    data.composite({
        key: 'boostrap',
        keys: ['all:monitors', 'all:checks', 'all:nip11s', 'all:operators'],
        priority: -10
    });
}