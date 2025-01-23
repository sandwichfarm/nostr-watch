<script lang="ts">
    import { type Monitor, type PubkeyProfile } from '@nostrwatch/route66/models';
    import { PFP } from '$lib/utils/pfp.js';
	import type { Readable } from 'svelte/store';

    export let pubkey: string;
    export let profile: Readable<PubkeyProfile>;
</script>

<div class="flex flex-nowrap">
    <div class="flex-shrink mr-2">
        {#if $profile?.photo}
            <span class="overflow-hidden">
                <img src={$profile.photo} alt={$profile.photo} class="w-10 h-10 block rounded-full" />
            </span>
        {:else}
            <span class="rounded-full overflow-hidden inline-block">
                <img src={PFP.generate(pubkey)} alt="${pubkey} photo" class="w-8 h-8" />
            </span>
        {/if}
    </div>
    <div class="flex-grow">
        {#if $profile?.name}
            <div class="text-md">{$profile.name}</div>
        {/if}
        <div class="text-xs text-gray-500 block w-full overflow-hidden overflow-ellipsis">{pubkey}</div>
    </div>
</div>
