<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import RelaySoftware from '../RelaySoftware.svelte';
    import RelayCountry from '../RelayCountry.svelte';
    
    export let version;
    export let software;
    export let geocode;    
</script>

{#if version || geocode}
    <Card.Root class="relay-card">
        <Card.Header>
            <Card.Title>General</Card.Title>  
            <Card.Description>Card Description</Card.Description>
        </Card.Header>  
        <Card.Content>
            <RelaySoftware {version} {software} />
            <RelayCountry {geocode} />
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}