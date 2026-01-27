<script lang="ts">
    import { type Monitor } from '@nostrwatch/route66/models';
    import { PFP } from '$lib/utils/pfp.js';

    export let monitor: Monitor;
</script>

<div class="flex">
    <div class="flex-shrink-0 mr-2">
        {#if monitor?.profile?.photo}
            <span class="rounded-full overflow-hidden">
                <img src="{monitor.profile.photo}" alt={monitor.profile.photo} class="w-20 h-24" />
            </span>
        {:else}
            <span class="rounded-full overflow-hidden inline-block">
                <img src={PFP.generate(monitor.pubkey)} alt="${monitor.pubkey} photo" class="w-8 h-8" />
            </span>
        {/if}
    </div>
    <div class="">
        {#if monitor?.profile?.name}
            <div class="text-sm">{monitor.profile.name}</div>
        {/if}
        <div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis">{monitor.pubkey}</div>
    </div>
</div>
