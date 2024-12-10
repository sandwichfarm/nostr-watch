<script lang="ts">
    import Badge from '$lib/components/ui/badge/badge.svelte';
	import ProfileCompact from '../ProfileCompact.svelte';
    import RelayCheck from './RelayCheck.svelte';
    import { writable, type Writable } from 'svelte/store';
    import { monitorsMap } from '$lib/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { PFP } from '$lib/utils/pfp';
	import RelayMap from '../RelayMap.svelte';
	import type { Nip66Event } from '@nostrwatch/nip66/models/Nip66Event';
	import type { Monitor } from '@nostrwatch/nip66/models/Monitor';
	import { onMount } from 'svelte';
    
    export let checks: Nip66Event[];
    export let relay: string;
    export let monitors: Monitor[];
    export let aggregate: any;

    let selectedCheckCache: Nip66Event | null = null;
    
    export const selectedCheck: Writable<Nip66Event | null> = writable(checks[0] || null);
    const showMap: Writable<boolean> = writable(false)

    const toggleMap = () => {
        if($showMap) {
            showMap.set(false)
            selectedCheck.set(selectedCheckCache)
        }
        else {
            selectedCheckCache = $selectedCheck
            selectedCheck.set(null)
            showMap.set(true)
        }
    }

    onMount(() => {
        if(checks.length) {
            selectedCheck.set(checks[0])
        }
    })
    
    $: validChecks = checks.filter(Boolean);
</script>

{#if validChecks.length}
<!-- <p>Reported <em>online</em> by <Badge class="rounded-full">{validChecks.length}</Badge> monitors</p> -->
<div class="flex">
    <div class="w-1/4 border-r overflow-y-auto">
        <button class="block w-full py-3 px-3 text-left {$showMap? 'bg-white/10': ''}" on:click={toggleMap}>
            🌎 <span class="inline-block">
                View Map
            </span> 
        </button>
        {#each validChecks as check}
            {#if check?.pubkey}
            <button class="block w-full py-3 px-3 text-left {$selectedCheck && check.id === $selectedCheck?.id? 'bg-white/10': ''}" on:click={() => { selectedCheck.set(check); showMap.set(false) }}>
                <img src="{$monitorsMap.get(check?.pubkey)?.photo ?? PFP.generate(check?.pubkey)}" alt="{$monitorsMap.get(check?.pubkey)?.name}'s profile photo" class="h-6 w-6 mr-2 overflow-hidden rounded-full inline-block" /> <span class="inline-block">
                    {$monitorsMap.get(check?.pubkey)?.name}
                    <span class="text-sm text-white/50 italic">{timeAgo((check.created_at as number)*1000)}</span>
                </span> 
            </button>
            {/if}
        {/each}
    </div>

    <div class="flex-1 overflow-y-auto p-4">
        {#if $showMap}
        map
            <RelayMap {checks} {relay} {monitors} {aggregate} />
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
