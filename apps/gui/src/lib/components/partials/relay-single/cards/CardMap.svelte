<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import type { Writable } from 'svelte/store';
	import RelayMap from '../../RelayMap.svelte';
	import type { Monitor, Nip66Event } from '@nostrwatch/route66/models';
    
    export let relay: string;
    export let monitors: Writable<Monitor[]>
    export let checks: Writable<Nip66Event[]>
    export let aggregate: any[]
</script>



<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Checks Map</Card.Title>  
        <Card.Description>A map showing where monitors reported from</Card.Description>
    </Card.Header>  
    <Card.Content class="p--6">
        {#if $monitors.length && $checks.length}
        <RelayMap {relay} {monitors} {checks} {aggregate} />
        {:else}
        <span class="block m-4">loading....</span>
        {/if}
    </Card.Content>
</Card.Root>
