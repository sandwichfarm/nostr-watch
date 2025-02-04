<script lang="ts">

    import { writable, type Readable, type Writable } from 'svelte/store';
    import { monitors, monitorsMap, relayChecks } from '$lib/stores';
	import { timeAgo } from '$lib/utils/time';
	import { PFP } from '$lib/utils/pfp';

    import RelayCheck from '../(components)/RelayCheck.svelte';
    import RelayMap from '../(components)/RelayMap.svelte';
	
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models';
	import type { Monitor } from '@nostrwatch/route66/models';
	import { onMount } from 'svelte';
	import { relayLivenessAggregate$, relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { getRelayUrl } from '../(utils)/general';
    
    const relay = getRelayUrl() 

    export let checks: Readable<Nip66CheckEvent[]> = relayLivenessChecks$(relay);
    export let aggregate: Readable<any> = relayLivenessAggregate$(relay);

    let selectedCheckCache: Nip66CheckEvent | null = null;
    
    export const selectedCheck: Writable<Nip66CheckEvent | null> = writable($checks?.[0] || null);
    const showMap: Writable<boolean> = writable(false)
    const showLocalCheck: Writable<boolean> = writable(false)

    const toggleMap = () => {
        if($showMap) {
            showMap.set(false)
            selectedCheck.set(selectedCheckCache)
        }
        else {
            selectedCheckCache = $selectedCheck
            selectedCheck.set(null)
            showMap.set(true)
            if($showLocalCheck) showLocalCheck.set(false)
        }
    }

    const toggleLocalCheck = () => {
        if($showLocalCheck) {
            showLocalCheck.set(false)
            selectedCheck.set(selectedCheckCache)
        }
        else {
            selectedCheckCache = $selectedCheck
            selectedCheck.set(null)
            showLocalCheck.set(true)
            if($showMap) showMap.set(false)
        }
    }

    onMount(() => {
        if($checks.length) {
            selectedCheck.set($checks[0])
        }
    })
    
    $: validChecks = $checks.filter(Boolean);
</script>

{#if validChecks.length}
<!-- <p>Reported <em>online</em> by <Badge class="rounded-full">{validChecks.length}</Badge> monitors</p> -->
<div class="flex">
    <div class=" w-1/4 border-r overflow-y-auto flex-none">
        <button class="block w-full py-3 px-3 text-left {$showMap? 'bg-black/10 dark:bg-white/10': ''}" on:click={toggleMap}>
            <span class="inline-block">
                <span class="inline-block text-2xl mr-2">🌎</span>
                <span class="relative -top-1"> Map</span>
            </span> 
        </button>
        <button class="block w-full py-3 px-3 text-left {$showLocalCheck? 'bg-black/10 dark:bg-white/10': ''}" on:click={toggleLocalCheck}>
            <span class="inline-block">
                <span class="inline-block text-2xl mr-2">🫵</span>
                <span class="relative -top-1"> Run check locally</span>
            </span> 
        </button>
        {#each validChecks as check}
            {#if check?.pubkey}
            <button class="block w-full py-3 px-3 text-left {$selectedCheck && check.id === $selectedCheck?.id? 'bg-black/10 dark:bg-white/10': ''}" on:click={() => { selectedCheck.set(check); showMap.set(false); showLocalCheck.set(false) }}>
                <img src="{$monitorsMap.get(check?.pubkey)?.photo ?? PFP.generate(check?.pubkey)}" alt="{$monitorsMap.get(check?.pubkey)?.name}'s profile photo" class="h-6 w-6 mr-2 overflow-hidden rounded-full inline-block" /> <span class="inline-block">
                    {$monitorsMap.get(check?.pubkey)?.name}
                    <span class="text-sm text-black/70 dark:text-white/70 italic">{timeAgo((check.created_at as number)*1000)}</span>
                </span> 
            </button>
            {/if}
        {/each}
    </div>

    <div class="flex-1 h-full py-4 px-8">
        {#if $showMap}
            <RelayMap {relay} {checks} {monitors} {aggregate} />
        {:else}    
            {#if $selectedCheck}
                <RelayCheck check={$selectedCheck} />
            {:else}
                <p class="text-gray-500">Select a monitor from the list.</p>
            {/if}
        {/if}
    </div>
</div>
{/if}

<style>
.flex {
    display: flex;
    height: calc(100vh - 4rem);
}
.w-64 {
    width: 16rem;
}
.flex-1 {
    flex: 1;
}
</style>
