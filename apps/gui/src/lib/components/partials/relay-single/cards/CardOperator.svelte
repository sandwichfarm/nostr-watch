
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    
    import * as Card from '$lib/components/ui/card';
	import ProfileCompact from '$lib/components/partials/ProfileCompact.svelte';
	
	import { nip66 } from '$lib/stores';

	import type { PubkeyProfile, PubkeyRelays } from '@nostrwatch/nip66/models';
	import { Monitor, Nip66Event } from '@nostrwatch/nip66/models';
	import Badge from '$lib/components/ui/badge/badge.svelte';
    import OperatorRelays from '../OperatorRelays.svelte';

    export let pubkey: string;
    export let relays: PubkeyRelays;
    export let profile: PubkeyProfile;
    export let relayUrl: string;
    export let monitors: Monitor[];

    let otherRelaysCount: number;

    const mount = async () => {
        if(!$nip66) return;
        await $nip66.ready();
    }

    const destroy = () => {}

    onMount(mount)
    onDestroy(destroy)

    $: name = profile?.name ?? undefined
</script>
{#if pubkey}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Operator</Card.Title>  
        <!-- <Card.Description>A map showing where monitors reported from</Card.Description> -->
    </Card.Header>  
    <Card.Content class="">
        {#if profile && pubkey}
        <ProfileCompact {pubkey} {profile}  />
        {#if profile?.about}
        <p class="mt-2 p-4 bg-white/5 line-clamp-6">{profile?.about}</p>
        {/if}
        {/if}
        {#if otherRelaysCount > 0}
        <div class="text-white/80 my-6">
            {name} operates <Badge class="rounded-full">{otherRelaysCount}</Badge> other relays
        </div>
        <OperatorRelays {pubkey} {relayUrl} {monitors} bind:otherRelaysCount />
        {/if}
    </Card.Content>
</Card.Root>
{/if}