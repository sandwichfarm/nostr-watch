<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import RelayIsp from '../RelayIsp.svelte';
    
    export let isp;

</script>

{#if isp}
<Card.Root>
    <Card.Header>
        <Card.Title>Network</Card.Title>  
        <Card.Description>Card Description</Card.Description>
    </Card.Header>  
    <Card.Content>
        <RelayIsp {isp} />
    </Card.Content>
    <Card.Footer>
        <p>Card Footer</p>
    </Card.Footer>
</Card.Root>
{/if}