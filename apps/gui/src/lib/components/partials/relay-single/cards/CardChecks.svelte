<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
import * as Card from '$lib/components/ui/card';
	import SummarizeRelayChecks from '../SummarizeRelayChecks.svelte';

    export let checks;
</script>

{#if checks.length}
<Card.Root>
    <Card.Header>
        <Card.Title>Checks</Card.Title>  
        <!-- <Card.Description>Card Description</Card.Description> -->
    </Card.Header>  
    <Card.Content>
        <SummarizeRelayChecks {checks} />
    </Card.Content>
    <Card.Footer>
        <Button>
            Details
        </Button>
    </Card.Footer>
</Card.Root>
{/if}