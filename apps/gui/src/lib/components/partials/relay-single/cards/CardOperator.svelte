
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { derived } from 'svelte/store';
    
    import * as Card from '$lib/components/ui/card';
	import ProfileCompact from '../../ProfileCompact.svelte';
	
	import { events, eventsArray, nip66 } from '$lib/stores';

	import { formatRelayUrl } from '$lib/utils/routing';
	import type { PubkeyProfile } from '@nostrwatch/nip66/models/PubkeyProfile';
	import type { PubkeyRelays } from '@nostrwatch/nip66/models/PubkeyRelays';
	import type { Nip66Event } from '@nostrwatch/nip66/models/Nip66Event';
	import Badge from '$lib/components/ui/badge/badge.svelte';

    export let pubkey: string;
    export let relays: PubkeyRelays;
    export let profile: PubkeyProfile;
    export let relayUrl: string;

    const operatorRelays = derived(eventsArray, ($eventsArray) => {
        return $eventsArray.filter((event: Nip66Event) => {
            return  event?.operatorPubkey 
                    && event.operatorPubkey === pubkey 
                    && event?.relay !== relayUrl;
        })
    });

    $: otherRelaysCount = $operatorRelays?.length ?? 0
    $: name = profile?.name ?? undefined

    const mount = async () => {
        if(!$nip66) return;
        await $nip66.ready();
    }

    const destroy = () => {}

    onMount(mount)
    onDestroy(destroy)
</script>
{#if pubkey}
<Card.Root>
    <Card.Header>
        <Card.Title>Operator</Card.Title>  
        <!-- <Card.Description>A map showing where monitors reported from</Card.Description> -->
    </Card.Header>  
    <Card.Content class="">
        {#if profile && pubkey}
        <ProfileCompact {pubkey} {profile}  />
        {/if}
        {#if otherRelaysCount > 0}
        <div class="text-white/80 my-6">
            {name} operates <Badge class="rounded-full">{otherRelaysCount}</Badge> other relays
        </div>
        {#each $operatorRelays as event}
            {#if event?.relay}
            <div>
                <span class="inline-block mr-1 w-3 h-3 bg-green-500 rounded-full"></span>
                <a href="/reload/relays/{formatRelayUrl(event.relay)}">
                {event?.relay}
            </div>
            {/if}
        {/each}
        {/if}
    </Card.Content>
</Card.Root>
{/if}