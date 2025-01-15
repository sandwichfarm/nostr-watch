<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import RelaySoftware from '../RelaySoftware.svelte';
    import RelayCountry from '../RelayCountry.svelte';
    import { route66 } from '$lib/stores/route66';
	import { Monitor } from '@nostrwatch/route66/models';
    
    export let relayUrl;
    export let checks;
    export let version;
    export let software;
    export let geocode;

    $: enabledMonitors = $route66?.initialized ? $route66?.services?.monitors.enabledMonitors: []
    $: numEnabledMonitors = enabledMonitors.length
    $: numChecks = checks.length
    $: percentageReportingOnline = numEnabledMonitors > 0? `${Math.round(numChecks/numEnabledMonitors*100)}%`: `n/a`
</script>

{#if version || geocode}
    <Card.Root class="relay-card">
        <Card.Header>
            <Card.Title>General</Card.Title>  
            <Card.Description>Card Description</Card.Description>
        </Card.Header>  
        <Card.Content>
            
            {enabledMonitors.length}/{checks.length}
            [{percentageReportingOnline}]
            of your enabled monitors are reporting {relayUrl} online
            <RelaySoftware {version} {software} />
            <RelayCountry {geocode} />
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}