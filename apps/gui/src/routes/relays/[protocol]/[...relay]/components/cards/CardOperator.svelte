
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    
    import * as Card from '$lib/components/ui/card';
	import ProfileCompact from '$lib/components/partials/ProfileCompact.svelte';
	
	import { route66 } from '$lib/stores';

	import type { PubkeyProfile, PubkeyRelays } from '@nostrwatch/route66/models';
	import { Monitor } from '@nostrwatch/route66/models';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import type { Readable } from 'svelte/store';
	import OperatorRelays from '$lib/components/partials/OperatorRelays.svelte';

    export let pubkey: string;
    export let relays: Readable<PubkeyRelays>;
    export let profile: Readable<PubkeyProfile>;
    export let relayUrl: string;
    export let monitors: Monitor[];

    let otherRelaysCount: number;

    const mount = async () => {
        if(!$route66) return;
        await $route66.ready();
    }

    const destroy = () => {}

    onMount(mount)
    onDestroy(destroy)

    $: name = $profile?.name ?? undefined
</script>
{#if pubkey}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Operator</Card.Title>  
        <!-- <Card.Description>A map showing where monitors reported from</Card.Description> -->
    </Card.Header>  
    <Card.Content class="">
        {#if $profile && pubkey}
        <ProfileCompact {pubkey} {profile}  />
            {#if $profile?.about}
            <p class="mt-2 p-4 bg-black/5 dark:bg-white/5 line-clamp-6">{$profile?.about}</p>
            {/if}
        {/if}
        {#if otherRelaysCount > 0}
        <div class="text-black/80 dark:text-white/80 my-6">
            <span class="bg-black/5 dark:bg-white/5 py-1 px-2 rounded-sm">{name}</span> operates <Badge class="rounded-full">{otherRelaysCount}</Badge> other relays
        </div>
        {/if}
        <OperatorRelays {pubkey} {relayUrl} {monitors} bind:otherRelaysCount />
    </Card.Content>
</Card.Root>
{/if}