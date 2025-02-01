<script lang="ts">
    import { type Monitor, type PubkeyProfile } from '@nostrwatch/route66/models';
    import { PFP } from '$lib/utils/pfp.js';
	import type { Readable } from 'svelte/store';
	import PubkeyPhoto from './PubkeyPhoto.svelte';
    import PubkeyZap from './PubkeyZap.svelte';
	import { truncateWithEllipsis } from '$utils/strings';
	import { onMount } from 'svelte';
	import { nip05ResultsByPubkey, nip05Service } from '$stores/nip05s';

    export let pubkey: string;
    export let profile: Readable<PubkeyProfile | undefined>;

    $: nip05Valid = $profile?.nip05? $nip05ResultsByPubkey.get(pubkey)?.valid === true: false;

    onMount(async () => {
        if($profile?.nip05){
            $nip05Service.check(pubkey, $profile?.nip05)
        }
    })
</script>

<div class="flex flex-nowrap">
    <div class="flex-shrink mr-2">
        <PubkeyPhoto pubkey={pubkey} size={20} />
    </div>
    <div class="flex-grow">
        
        {#if $profile?.name}
            <div class="text-lg bg-black/5 dark:bg-white/10 rounded-md inline-block py-2 px-3">
                {$profile.name}
            </div>
        {/if}

        {#if $profile}
        <PubkeyZap pubkey={pubkey}/>
        {/if}

        {#if $profile?.nip05}
            <div class="text-md {nip05Valid? 'text-green-500': 'text-red-500'}">
                {$profile.nip05}
            </div>
        {/if}

        <div class="text-xs text-gray-500 block w-full overflow-hidden overflow-ellipsis">
            {truncateWithEllipsis(pubkey, 21)}
        </div>

    </div>
</div>
