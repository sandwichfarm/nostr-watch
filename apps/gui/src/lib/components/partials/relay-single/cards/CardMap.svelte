<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import RelayMap from '../../RelayMap.svelte';
    
    export let relay: string;
    export let monitors: any[]
    export let checks: any[]
    export let aggregate: any[]
</script>


{#if monitors.length && checks.length}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Checks Map</Card.Title>  
        <Card.Description>A map showing where monitors reported from</Card.Description>
    </Card.Header>  
    <Card.Content class="p--6">
        <RelayMap {relay} {monitors} {checks} {aggregate} />
    </Card.Content>
</Card.Root>
{/if}