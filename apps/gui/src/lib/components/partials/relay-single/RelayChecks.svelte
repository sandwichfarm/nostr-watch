<script lang="ts">
    import Badge from '$lib/components/ui/badge/badge.svelte';
	import ProfileCompact from '../ProfileCompact.svelte';
    import RelayCheck from './RelayCheck.svelte';
    import { writable } from 'svelte/store';
    import { monitorsMap } from '$lib/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { PFP } from '$lib/utils/pfp';
    
    export let checks: any[];
    
    export const selectedCheck = writable(checks[0] || null);
    
    $: validChecks = checks.filter(Boolean);
</script>

{#if validChecks.length}
<h2>Checks</h2>
<p>Reported <em>online</em> by <Badge class="rounded-full">{validChecks.length}</Badge> monitors</p>
<div class="flex">
    <div class="w-1/4 border-r overflow-y-auto">
        {#each validChecks as check}
            {#if check?.pubkey}
            <button class="block w-full py-3 px-3 text-left {$selectedCheck && check.id === $selectedCheck?.id? 'bg-white/10': ''}" on:click={() => { selectedCheck.set(check)}}>
                <img src="{$monitorsMap.get(check?.pubkey)?.photo ?? PFP.generate(check?.pubkey)}" alt="{$monitorsMap.get(check?.pubkey)?.name}'s profile photo" class="h-6 w-6 mr-2 overflow-hidden rounded-full inline-block" /> <span class="inline-block">
                    {$monitorsMap.get(check?.pubkey)?.name}
                    <span class="text-sm text-white/50 italic">{timeAgo(check.created_at*1000)}</span>
                </span> 
            </button>
            {/if}
        {/each}
    </div>

    <div class="flex-1 overflow-y-auto p-4">
        {#if $selectedCheck}
            <RelayCheck check={$selectedCheck} />
        {:else}
            <p class="text-gray-500">Select a monitor from the list.</p>
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
