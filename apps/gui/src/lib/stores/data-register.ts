import { DataRegister } from "$lib/managers/DataRegister";
import { get, writable, type Writable } from "svelte/store";
import { doBootstrap } from "$stores/routines";
import { doAggregateCache, doLiveSync, isBootstrapped, isBootstrapping, isSeeded, tabState } from "$stores/app";
import { backfillMonitorChecks, fetchDisabledMonitorsChecks, fetchMonitors, fetchMonitorsChecks, fetchNip11s, fetchOperators } from "$lib/fetchers/bootstrap";
import { seedBuildData } from "$lib/fetchers/seed";
import { instance, removeStaleChecksFromStore, seedFromCache } from "$utils/lifecycle";
import { liveSync } from "$utils/live-sync";
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
import { initDimensionsWorker } from "$lib/workers/dimensions-worker-manager";
import { syncBlocklists, cleanBlockedRelaysFromCache } from "./blocklist";

// Dynamic import to avoid circular dependency issues
let _startBootActivity: ((slug: string, text: string) => void) | null = null;
let _completeBootActivity: ((slug: string, value?: string | number) => void) | null = null;

async function loadBootActivityFunctions() {
    if (!_startBootActivity) {
        const mod = await import('$lib/stores/boot-activity');
        _startBootActivity = mod.startBootActivity;
        _completeBootActivity = mod.completeBootActivity;
    }
}

function startBootActivity(slug: string, text: string) {
    if (_startBootActivity) _startBootActivity(slug, text);
}

function completeBootActivity(slug: string, value?: string | number) {
    if (_completeBootActivity) _completeBootActivity(slug, value);
}

export const dataRegister: Writable<DataRegister> = writable(new DataRegister())

export const dataRegisterInit = async () => {
    const data = get(dataRegister);

    // Load boot activity functions (dynamic import to avoid circular deps)
    await loadBootActivityFunctions();

    // Register boot activities upfront so user sees what's coming
    startBootActivity('data:register', 'Registering data sources');

    // Pre-register seed activities so progress bar shows them as pending
    // These will be updated/completed by seedBuildData when it runs
    startBootActivity('seed:manifest', 'Loading seed manifest');
    startBootActivity('seed:monitors', 'Loading monitors');
    startBootActivity('seed:checks', 'Loading relay checks');
    startBootActivity('seed:operators', 'Loading operator profiles');
    startBootActivity('seed:nip11s', 'Loading NIP-11 relay info');

    //state
    data.register({
        key: 'seed:build',
        priority: 0,
        fn: seedBuildData
    });

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
        // expiry: SYNC_RELAY_CHECKS_EXPIRY,
        keyFn: relayKeyFn,
        fn: fetchRelayChecks
    });
    data.register({
        key: 'sync:relay:nip11',
        priority: 11,
        // expiry: SYNC_RELAY_NIP11_EXPIRY,
        keyFn: relayKeyFn,
        fn: fetchRelayNip11
    });
    data.register({
        key: 'sync:relay:operator',
        priority: 12,
        // expiry: SYNC_RELAY_OPERATOR_EXPIRY,
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

    // Sync blocklists from monitors (kind 10006) - must run after monitors are loaded
    data.register({
        key: 'sync:blocklists',
        priority: 20.5,
        expiry: SYNC_MONITORS_EXPIRY, // Same expiry as monitors
        condition: async () => get(tabState) === 'leader',
        fn: syncBlocklists,
        onComplete: async () => {
            // Clean blocked relays from cache after syncing
            const cleaned = await cleanBlockedRelaysFromCache();
            if (cleaned > 0) {
                console.log(`[blocklist] Cleaned ${cleaned} blocked relay events from cache`);
            }
        }
    });

    data.register({
        key: 'sync:checks',
        priority: 21,
        expiry: SYNC_CHECKS_EXPIRY,
        fn: fetchMonitorsChecks,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:checks:disabled',
        priority: 22,
        expiry: SYNC_CHECKS_EXPIRY,
        fn: fetchDisabledMonitorsChecks,
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:nip11s',
        priority: 23,
        expiry: SYNC_NIP11_EXPIRY,
        fn: fetchNip11s
    });
    data.register({
        key: 'sync:operators',
        priority: 24,
        expiry: SYNC_OPERATORS_EXPIRY,
        // Always keep operator meta fresh in the leader tab; followers should
        // rely on leader broadcasts and cache snapshots.
        condition: async () => get(tabState) === 'leader',
        fn: fetchOperators,
        onComplete: publishEventsToMemoryRelay
    });

    // Backfill historical check events for accurate offline/dead counts.
    // Runs at lower priority after initial sync, only in leader tab.
    data.register({
        key: 'sync:checks:backfill',
        priority: 50,
        expiry: SYNC_CHECKS_EXPIRY,
        condition: async () => get(tabState) === 'leader',
        fn: backfillMonitorChecks,
        onComplete: publishEventsToMemoryRelay
    });

    const operatorKeyFn = (key: string, params: string[]) => {
        const pubkey = params?.[0];
        if (!pubkey) return key;
        return `${key}:${pubkey}`;
    }

    // Targeted operator meta fetch (used by /operators/[pubkey]).
    data.register({
        key: 'sync:operator:meta',
        priority: 25,
        expiry: SYNC_OPERATORS_EXPIRY,
        keyFn: operatorKeyFn,
        fn: async (pubkey: string) => {
            const $route66 = await instance();
            await $route66.ready();
            try {
                const cached = await $route66.REQ([{ kinds: [0, 10002], authors: [pubkey] }]);
                if (cached?.length) return cached;
            } catch {}
            return fetchOperators([pubkey]);
        },
        onComplete: publishEventsToMemoryRelay
    });
    data.register({
        key: 'sync:live',
        priority: 200,
        condition: async () => get(doLiveSync) === true && get(tabState) === 'leader',
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
            if (get(isSeeded)) {
                console.log('[DataRegister] skipping sync:cache: already seeded');
                return false;
            }
            // Followers should always try to hydrate from the leader/cache, even
            // when this origin hasn't been "bootstrapped" yet.
            if (get(tabState) !== 'leader') return true;
            const bootstrapped = get(isBootstrapped);
            if (!bootstrapped) {
                console.log('[DataRegister] skipping sync:cache: fresh state');
            }
            return bootstrapped;
        },
        fn: seedFromCache,
        onComplete: async (events: IEvent[]): Promise<any> => {
            if(!events?.length) return
            publishEventsToMemoryRelay(events, 'cache')
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
        keys: [
            'seed:build',
            'sync:monitors',
            'sync:blocklists',
            'sync:checks',
            'sync:checks:disabled',
            'sync:checks:backfill',
            'sync:operators',
            'sync:live',
            'sync:nip11s',
            'validate:nip11s'
        ],
        priority: -10,
        fn: async () => {
            isBootstrapping.set(true);
            startBootActivity('sync:network', 'Syncing from network');
        },
        onComplete: async () => {
            completeBootActivity('sync:network');
            isBootstrapping.set(false)
            isBootstrapped.set(true)
            // Ensure isSeeded is set so UI can progress
            if (!get(isSeeded)) {
                isSeeded.set(true)
            }
        },
        ignoreConditions: {},
        ignoreExpiries: {}
    });

    data.composite({
        key: 'sync:all-force',
        keys: [
            'seed:build',
            'sync:monitors',
            'sync:blocklists',
            'sync:checks',
            'sync:checks:disabled',
            'sync:checks:backfill',
            'sync:operators',
            'sync:live',
            'sync:nip11s',
            'validate:nip11s'
        ],
        // condition: async () => !get(doBootstrap),
        priority: -10,
        fn: async () => {
            isBootstrapping.set(true)
            startBootActivity('sync:network', 'Syncing from network');
            return true;
        },
        onComplete: async () => {
            completeBootActivity('sync:network');
            isBootstrapping.set(false)
            isBootstrapped.set(true)
            // Ensure isSeeded is set so UI can progress even without seed files
            if (!get(isSeeded)) {
                isSeeded.set(true)
            }
        },
        ignoreConditions: {
            'sync:monitors': true,
            'sync:blocklists': true,
            'sync:checks': true,
            'sync:checks:disabled': true,
            'sync:checks:backfill': true,
            'sync:nip11s': true,
            'sync:operators': true
        },
        ignoreExpiries: {
            'sync:monitors': true,
            'sync:blocklists': true,
            'sync:checks': true,
            'sync:checks:disabled': true,
            'sync:checks:backfill': true,
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

    completeBootActivity('data:register');

    startBootActivity('data:ready', 'Preparing database');
    await (await instance()).ready()
    completeBootActivity('data:ready');

    await delay(20)
    data.unlock();

    // Initialize dimensions worker for off-thread derivations
    initDimensionsWorker();
}
