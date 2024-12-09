<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
    import RelayInsights from "../RelayInsights.svelte";

    export let relayAggregate;
    let actions
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>Insights</Card.Title>  
        <Card.Description></Card.Description>
    </Card.Header>  
    <Card.Content>
        <RelayInsights {relayAggregate} />
    </Card.Content>
    <Card.Footer>
        <Button>More Stats</Button>
    </Card.Footer>
</Card.Root>