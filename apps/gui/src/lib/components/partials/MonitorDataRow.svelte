<script lang="ts">
    import { type Monitor } from '@nostrwatch/route66/models';
    import { monitorChecksCount } from '$lib/stores/monitors.js';
    import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { PFP } from '$lib/utils/pfp.js';
    import Time from "svelte-time";
    export let monitor: Monitor;

    $: photo = monitor?.profile?.photo || monitor?.profile?.picture;
    $: checksCount = $monitorChecksCount?.[monitor.pubkey]
    $: lastActive = monitor?.lastActive
    $: relays = monitor?.relays
    $: checks = monitor?.checks
</script>

<section class="mb-10">
<div class="flex items-center text-gray-300">
    <div class="flex-shrink-0">
        {#if monitor?.profile?.photo}
            <span class="rounded-full overflow-hidden">
                <img src="{photo}" alt={photo} class="w-20 h-24" />
            </span>
        {:else}
            <span class="rounded-full overflow-hidden">
                <img src={PFP.generate(monitor.pubkey)} alt={photo} class="w-20 h-20" />
            </span>
        {/if}
    </div>
    <div class="ml-4">
        <div class="flex items-center mb-1">
            <span class="font-bold opacity-90 text-white">
                {#if monitor?.profile?.name}
                    {monitor.profile.name}
                {:else}
                    <span class="text-sm">{monitor.pubkey.slice(0, 21)}...</span>
                {/if}
            </span>
            {#if monitor?.profile?.nip05}
                <span class="ml-2 text-gray-400 text-sm font-bold">{monitor.profile.nip05}</span>
            {/if}
            {#if lastActive}
                <span class="ml-2 text-gray-600 text-sm font-bold">last active <Time relative timestamp={lastActive * 1000} /></span>
            {/if}
        </div>
        <div class="mb-1">
            {#if checksCount}
                <span class="text-sm">reporting <Badge size="default" variant="secondary">{checksCount}</Badge> relays online</span>
            {/if}
        </div>
        <div class="mb-1">
            <span class="text-sm">checks</span>
            {#if checks}
                {#each checks as check}
                    <Badge size="small" variant="secondary" class="ml-2">{check}</Badge>
                {/each}
            {/if}
        </div>
        <div class="text-sm text-gray-600">
            {#if monitor?.profile?.lud16}
                {monitor.profile.lud16}
            {/if}
            {#if relays?.length}
                Publishes to {relays.length} relays {relays.join(', ')}
            {/if}
        </div>
    </div>
</div>
</section>