<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { debounce } from "lodash";

	import { events, nip11s, nip11sLocal, operatorPubkeys,  operatorPubkeysInvalid, operatorPubkeysValid , relayCheckAggregates } from "$lib/stores";
	import { isLivesyncing } from "$lib/stores/app";
	import { doBootstrap } from "$lib/stores/routines";
	import { appState, isBootstrapping, isSeeded, tabState, isIdle } from "$lib/stores/app";
	import { get, writable, type Writable } from "svelte/store";
	import { route66 } from "$lib/stores";
	import { Value } from "svelte-radix";
	import { shouldSync as _shouldSync } from "$lib/stores/app";
	import { eventsStoreMemoryRelay } from "$lib/stores/memory-relays/memory-relay-events";
	import { calculateSize, type ObjectSizeType } from "$lib/utils/cache";
	import { relaysWithNip11s$, relaysWithoutNip11s$ } from "$stores/helpers/helpers-nip11s";
    import { relayChecksDerivationStats } from "$lib/stores/checks";
    import { getSignatureVerificationService } from "$lib/services/SignatureVerificationService";
    import { getLeaderTabRpcClient } from "$lib/runtime/leader-tab-client";


    const debug: Writable<Map<string, any>> = writable(new Map());
    const shouldSync: Writable<boolean> = writable(false);

    const subs = [];

    export const addDebug = (key: string, value: any) => {
        debug.update((d) => {
            d.set(key, value);
            return d;
        });
    };
    
    export const removeDebug = (key: string) => {
        debug.update((d) => {
            d.delete(key);
            return d;
        });
    };

    export const clearDebug = () => {
        debug.set(new Map());
    };

    subs.push(shouldSync.subscribe((value) => {
        addDebug('shouldSync', value);
    }));

    subs.push(doBootstrap.subscribe((value) => {
        addDebug('doBootstrap', value);
    }));

    subs.push(isBootstrapping.subscribe((value) => {
        addDebug('isBootstrapping', value);
    }));

    subs.push(isSeeded.subscribe((value) => {
        addDebug('isSeeded', value);
    }));

    subs.push(appState.subscribe((value) => {
        addDebug('appState', value);
    }));

    subs.push(tabState.subscribe((value) => {
        addDebug('tabState', value);
    }));

    subs.push(isIdle.subscribe((value) => {
        addDebug('isIdle', value);
    }));

    subs.push(isLivesyncing.subscribe((value) => {
        addDebug('isLivesyncing', value);
    }));

    subs.push(relayCheckAggregates.subscribe((value) => {
        addDebug('relayCheckAggregates', value.length);
    }));

    subs.push(relayChecksDerivationStats.subscribe((value) => {
        addDebug('relayChecksDerivation', value);
    }));

    subs.push(nip11s.subscribe((value) => {
        addDebug('nip11s', Array.from(value)?.length || 0);
    }));

    subs.push(nip11sLocal.subscribe((value) => {
        addDebug('nip11sLocal', Array.from(value)?.length || 0);
    }));

    subs.push(operatorPubkeys.subscribe((value) => {
        addDebug('operatorPubkeys', value.length);
    }));

    subs.push(operatorPubkeysValid.subscribe((value) => {
        addDebug('operatorPubkeysValid', value.length);
    }));

    subs.push(operatorPubkeysInvalid.subscribe((value) => {
        addDebug('operatorPubkeysInvalid', value.length);
    }));

    subs.push(relaysWithNip11s$().subscribe((value) => {
        addDebug('relaysWithNip11s', value.length);
    }));

    subs.push(relaysWithoutNip11s$().subscribe((value) => {
        addDebug('relaysWithoutNip11s', value.length);
    }));

    // eventsChecks.subscribe((events) => {
    //     addDebug('store:eventsChecks', $eventsChecks);
    // });

    const debugStores = () => {
        const eventKeys = Array.from($events?.keys?.()) ?? []; 
        const eventsArray = Array.from(eventKeys);
        const measure: ObjectSizeType = calculateSize($events)

        addDebug('store:events', eventKeys?.length || 0);
        addDebug('store:events:size', `${measure.size.toFixed(2)}${measure.unit}`);

        [0,1,3,10002,10166, 30166].forEach( kind => {
            addDebug(`store:events:${kind}`, eventsArray.filter( (key: string) => { 
                const parts = key.split(':');
                return parts[1] === kind.toString();
            }).length);
        });

        addDebug('store:events:tor', Array.from($events.values()).filter(event => event.tags.find(tag => tag[0] === 'n' && tag[1] === 'tor')).length)
        addDebug('store:events:clearnet', Array.from($events.values()).filter(event => event.tags.find(tag => tag[0] === 'n' && tag[1] === 'clearnet')).length)

        addDebug('store:memoryRelay:all', get(eventsStoreMemoryRelay).count([{kinds: [30166]}]));
        addDebug('store:memoryRelay:clearnet', get(eventsStoreMemoryRelay).count([{kinds: [30166], "#n": ["clearnet"]}]));
        addDebug('store:memoryRelay:tor', get(eventsStoreMemoryRelay).count([{kinds: [30166], "#n": ["tor"]}]));
    }

    
    const debugRoute66 = () => {
        shouldSync.set(_shouldSync());
        addDebug('route66:cacheAdapter', $route66?.cacheAdapter.isReady? true: false);
        addDebug('route66:websocketAdapter', $route66?.websocketAdapter.isReady? true: false);
        addDebug('route66:initialized', $route66?.initialized? true: false);
        addDebug('route66:numSubscriptions', $route66?.websocketAdapter?.subscriptions.size);
        // addDebug('route66:subscriptions', Array.from($route66?.websocketAdapter?.subscriptions));

        const leaderInfo = getLeaderTabRpcClient().getLeaderInfo?.();
        if (leaderInfo) {
            addDebug('leader:termId', leaderInfo.termId);
            addDebug('leader:serverId', leaderInfo.serverId);
        } else {
            addDebug('leader:termId', null);
            addDebug('leader:serverId', null);
        }

        const verifier = getSignatureVerificationService({ create: false });
        addDebug('sigverify:verified', verifier?.verifiedCount ?? 0);
        addDebug('sigverify:invalid', verifier?.invalidCount ?? 0);
    }

    const debugCacheAdapter = async () => {
        await $route66?.cacheAdapter?.ready();
        addDebug('cacheAdapter:countAll', await $route66?.cacheAdapter?.COUNT([{}]));
        addDebug('cacheAdapter:count10166', await $route66?.cacheAdapter?.COUNT([{ kinds: [10166]}]));
        addDebug('cacheAdapter:count30166', await $route66?.cacheAdapter?.COUNT([{ kinds: [30166]}]));
        addDebug('cacheAdapter:count0', await $route66?.cacheAdapter?.COUNT([{ kinds: [0]}]));
        addDebug('cacheAdapter:count10002', await $route66?.cacheAdapter?.COUNT([{ kinds: [10002]}]));

        addDebug('cacheAdapter:count1', await $route66?.cacheAdapter?.COUNT([{ kinds: [1]}]));
        addDebug('cacheAdapter:count1111', await $route66?.cacheAdapter?.COUNT([{ kinds: [1111]}]));
        addDebug('cacheAdapter:9735,9321', await $route66?.cacheAdapter?.COUNT([{ kinds: [9735, 9321] }]));

        addDebug('cacheAdapter:tor', await $route66?.cacheAdapter?.COUNT([{ "#n": ["tor"] }]));
        addDebug('cacheAdapter:clearnet', await $route66?.cacheAdapter?.COUNT([{ "#n": ["clearnet"] }]));

        try {
            addDebug('cacheAdapter:nip11s', await $route66?.cacheAdapter?.countNip11s());
        } catch (e) {
            console.warn('countNip11s not available:', e);
        }
        
        try {
            addDebug('cacheAdapter:nip11sUnique', await $route66?.cacheAdapter?.countUniqueNip11s());
        } catch (e) {
            console.warn('countUniqueNip11s not available:', e);
        }
    }


    
    onMount( async () => {
        await $route66?.cacheAdapter?.ready()
        try {
            await ($route66 as any)?.cacheAdapter?.relay?.debug?.();
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 1000));
        debugRoute66()
        debugCacheAdapter()
        debugStores()

        return () => {
            subs.forEach((unsub) => unsub());
        }
    })

    const debugRoute66IntervalId = setInterval(() => {
        try {
            debugRoute66()
        } catch {}
    }, 1000*1);

    const debugCacheAdapterIntervalId = setInterval(() => {
        void debugCacheAdapter().catch(() => {})
    }, 1000*60);

    onDestroy(() => {
        clearInterval(debugRoute66IntervalId)
        clearInterval(debugCacheAdapterIntervalId)
    })

    $: iterableDebug = Array.from($debug);

</script>

<div class="fixed bottom-10 right-0 p-4 bg-gray-800 text-white font-mono text-sm z-[9999]">

{#if $debug}
<table>
    <tbody>
    {#each iterableDebug as [key, value]}
    <tr>
        <td>{key}</td>
        <td>
            {#if Array.isArray(value)}
                {#each value as v}
                    {#if typeof v === 'object'}
                        <pre>{JSON.stringify(v, null, 2)}</pre>
                    {:else if typeof v === 'string'}
                        {v.length > 42 ? v.slice(0, 42) + '...' : v}<br />
                    {:else}
                        {v}
                    {/if}
                {/each}
            {:else if typeof value === 'object'}
                <pre>{JSON.stringify(value, null, 2)}</pre>
            {:else}
                {value}
            {/if}
        </td>
    </tr>
    {/each}
    </tbody>
</table>
{/if}

</div>
