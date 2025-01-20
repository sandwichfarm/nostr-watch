<script lang="ts">
	import { nip11s, nip11sLocal, operatorPubkeys,  operatorPubkeysInvalid, operatorPubkeysValid , relayAggregates, relaysWithNip11s, relaysWithoutNip11s } from "$lib/stores";
	import { isLivesyncing } from "$lib/stores/app";
	import { doBootstrap } from "$lib/stores/routines";
	import { appState, isBootstrapping, isSeeded, tabState, isIdle } from "$lib/stores/app";
	import { writable, type Writable } from "svelte/store";
	import { route66 } from "$lib/stores";
	import { Value } from "svelte-radix";
	import { shouldSync as _shouldSync } from "$lib/stores/app";
	import { onMount } from "svelte";

    const debug: Writable<Map<string, any>> = writable(new Map());
    const shouldSync: Writable<boolean> = writable(false);

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

    shouldSync.subscribe((value) => {
        addDebug('shouldSync', value);
    });

    doBootstrap.subscribe((value) => {
        addDebug('doBootstrap', value);
    });

    isBootstrapping.subscribe((value) => {
        addDebug('isBootstrapping', value);
    });

    isSeeded.subscribe((value) => {
        addDebug('isSeeded', value);
    });

    appState.subscribe((value) => {
        addDebug('appState', value);
    });

    tabState.subscribe((value) => {
        addDebug('tabState', value);
    });

    isIdle.subscribe((value) => {
        addDebug('isIdle', value);
    });

    isLivesyncing.subscribe((value) => {
        addDebug('isLivesyncing', value);
    });

    relayAggregates.subscribe((value) => {
        addDebug('relayAggregates', value.length);
    });

    nip11s.subscribe((value) => {
        addDebug('nip11s', Array.from(value)?.length || 0);
    });

    nip11sLocal.subscribe((value) => {
        addDebug('nip11sLocal', Array.from(value)?.length || 0);
    });

    operatorPubkeys.subscribe((value) => {
        addDebug('operatorPubkeys', value.length);
    });

    operatorPubkeysValid.subscribe((value) => {
        addDebug('operatorPubkeysValid', value.length);
    });

    operatorPubkeysInvalid.subscribe((value) => {
        addDebug('operatorPubkeysInvalid', value.length);
    });

    relaysWithNip11s.subscribe((value) => {
        addDebug('relaysWithNip11s', value.length);
    });

    relaysWithoutNip11s.subscribe((value) => {
        addDebug('relaysWithoutNip11s', value.length);
    });
    
    const debugRoute66 = () => {
        shouldSync.set(_shouldSync());
        addDebug('route66:cacheAdapter', $route66?.cacheAdapter.isReady? true: false);
        addDebug('route66:websocketAdapter', $route66?.websocketAdapter.isReady? true: false);
        addDebug('route66:initialized', $route66?.initialized? true: false);
        addDebug('route66:numSubscriptions', $route66?.websocketAdapter?.subscriptions.size);
        addDebug('route66:subscriptions', Array.from($route66?.websocketAdapter?.subscriptions));
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

        addDebug('cacheAdapter:nip11s', await $route66?.cacheAdapter?.countNip11s());
        addDebug('cacheAdapter:nip11sUnique', await $route66?.cacheAdapter?.countUniqueNip11s());
    }

    

    onMount( async () => {
        await $route66?.cacheAdapter?.ready()
        // await $route66?.cacheAdapter?.relay.debug();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        debugRoute66()
        debugCacheAdapter()
    })

    setInterval(debugRoute66, 1000*1);

    setInterval( () => {
        debugCacheAdapter()
    }, 1000*60);

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