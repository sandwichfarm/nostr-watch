<script lang="ts">
    import { type Monitor, type PubkeyProfile } from '@nostrwatch/nip66/models';
    import { PFP } from '$lib/utils/pfp.js';

    export let pubkey: string;
    export let profile: PubkeyProfile;
</script>

<div class="flex">
    <div class="flex-shrink-0 mr-2">
        {#if profile?.photo}
            <span class="overflow-hidden max-w-8 h-auto">
                <img src={profile.photo} alt={profile.photo} class="w-8 h-8 rounded-full" />
            </span>
        {:else}
            <span class="rounded-full overflow-hidden inline-block">
                <img src={PFP.generate(pubkey)} alt="${pubkey} photo" class="w-8 h-8" />
            </span>
        {/if}
    </div>
    <div class="">
        {#if profile?.name}
            <div class="text-sm">{profile.name}</div>
        {/if}
        <div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis">{pubkey}</div>
    </div>
</div>
