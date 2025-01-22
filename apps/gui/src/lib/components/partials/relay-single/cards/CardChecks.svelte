<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
	import type { Writable } from 'svelte/store';
	import SummarizeRelayChecks from '../SummarizeRelayChecks.svelte';

    export const prerender = true;

    export let checks;
    export let activeTab: Writable<string>;
</script>

{#if checks.length}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Checks</Card.Title>  
        <!-- <Card.Description>Card Description</Card.Description> -->
    </Card.Header>  
    <Card.Content>
        <SummarizeRelayChecks {checks} />
    </Card.Content>
    <Card.Footer>
        <Button on:click={() => { activeTab.set('checks') }}>
            Details
        </Button>
    </Card.Footer>
</Card.Root>
{/if}