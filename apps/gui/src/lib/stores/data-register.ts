import { DataRegister } from "$lib/managers/DataRegister";
import { get, writable, type Writable } from "svelte/store";
import { doBootstrap } from "$stores/routines";
import { doAggregateCache, doLiveSync, isBootstrapped, isSeeded } from "$stores/app";
import { fetchMonitors, fetchMonitorsChecks, fetchNip11s, fetchOperators } from "$lib/fetchers/bootstrap";
import { beginLiveSync, bindBootstrapEmitters, instance, liveSync, removeStaleChecksFromStore, seedFromCache } from "$utils/lifecycle";
import { publishEventsToMemoryRelay } from "./events-helpers";
import { delay } from "@nostrwatch/utils";
import type { IEvent } from "@nostrwatch/route66/models/Event";
import { fetchRelayChecks, fetchRelayNip11, fetchRelayOperator } from "$lib/fetchers/relay";
import { SchemaValidationService, type SchemaValidationServiceResponse } from "$lib/services/SchemaValidationService";
import { nip11s } from "./nip11s";
import type { Nip11 } from "@nostrwatch/route66/models/Nip11";
import { relayNip11Validations } from "./nip11-validations";
import { page } from "$app/stores";
import { relayLiveSync } from "$utils/live-sync";
import { SYNC_CHECKS_EXPIRY, SYNC_MONITORS_EXPIRY, SYNC_NIP11_EXPIRY, SYNC_OPERATORS_EXPIRY, SYNC_RELAY_ALL_EXPIRY, SYNC_RELAY_CHECKS_EXPIRY, SYNC_RELAY_NIP11_EXPIRY, SYNC_RELAY_OPERATOR_EXPIRY, VALIDATE_NIP11S_EXPIRY } from "$lib/constants/synchronization";

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
        expiry: SYNC_RELAY_CHECKS_EXPIRY,
        keyFn: relayKeyFn,
        fn: fetchRelayChecks
    });
    data.register({
        key: 'sync:relay:nip11',
        priority: 11,
        expiry: SYNC_RELAY_NIP11_EXPIRY,
        keyFn: relayKeyFn,
        fn: fetchRelayNip11
    });
    data.register({
        key: 'sync:relay:operator',
        priority: 12,
        expiry: SYNC_RELAY_OPERATOR_EXPIRY,
        keyFn: relayKeyFn,
        fn: fetchRelayOperator
    });

    data.register({
        key: 'sync:relay:live',
        priority: 200,
        fn: async (relay: string) => relayLiveSync(relay)
    });

    //fetchers: all (bootstrap)
    data.register({
        key: 'sync:monitors',
        priority: 20,
        expiry: SYNC_MONITORS_EXPIRY,
        fn: fetchMonitors,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:checks',
        priority: 21,
        expiry: SYNC_CHECKS_EXPIRY,
        fn: fetchMonitorsChecks,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:nip11s',
        priority: 22,
        expiry: SYNC_NIP11_EXPIRY,
        fn: fetchNip11s
    });
    data.register({
        key: 'sync:operators',
        priority: 23,
        expiry: SYNC_OPERATORS_EXPIRY,
        condition: async () => !get(isSeeded), 
        fn: fetchOperators,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:live',
        priority: 200,
        condition: async () => get(doLiveSync) === true,
        fn: async () => liveSync()
    })

    data.register({
        key: 'validate:nip11s',
        expiry: VALIDATE_NIP11S_EXPIRY,    
        priority: 200,
        fn: async () => {
            const validator = new SchemaValidationService();
            const validationsMap = new Map();
            const keysIndex: string[] = []
            const promises: Promise<SchemaValidationServiceResponse>[] = [];
            for( const [relay, n11Entry] of Array.from(get(nip11s).entries()) ){
                console.log('validate:nip11s', relay)
                keysIndex.push(relay)
                const json = n11Entry?.[0]?.json
                if(!json) return
                promises.push(validator.validateNip11(json))
                await delay(10)
            }
            const validations = await Promise.all(promises);
            validations.forEach( (validation, index) => {
                validationsMap.set(keysIndex[index], validation)
            })
            return validationsMap;  
        },
        onComplete: async (validationsMap: Map<string, SchemaValidationServiceResponse>) => {
            console.log('validationsMap', validationsMap)   
            relayNip11Validations.update(() => validationsMap)
        }
    })


    //cache: all (bootstrap)
    data.register({
        key: 'sync:cache',
        priority: 3,
        condition: async () => {
            return !get(isSeeded) && get(isBootstrapped)
        },
        fn: seedFromCache,
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
        keys: ['sync:monitors', 'sync:checks', 'sync:nip11s', 'sync:operators', 'validate:nip11s', 'sync:live'],
        priority: -10,
        // expiry: SYNC_RELAY_ALL_EXPIRY,
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
        keys: ['sync:relay:checks', 'sync:relay:nip11', 'sync:relay:operator', 'sync:relay:live'],
        ignoreConditions: { 
            'sync:relay:checks': true,
            'sync:relay:nip11': true,
            'sync:relay:operator': true
        },
        priority: -20
    });

    await (await instance()).ready()
    await delay(20)
    data.unlock();
}