<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
	import RelayFees from '../RelayFees.svelte';

    export let fees;
</script>


{#if fees}
<Card.Root class="mt-5 float-left">
    <Card.Header>
        <Card.Title>Fee Schedule</Card.Title>  
        <Card.Description></Card.Description>
    </Card.Header>  
    <Card.Content>
        <RelayFees {fees} />
    </Card.Content>
    <Card.Footer>
        <Button>
            Purchase Access
        </Button>
    </Card.Footer>
</Card.Root>
{/if}