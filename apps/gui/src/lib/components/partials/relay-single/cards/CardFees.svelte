<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
    import * as Table from "$lib/components/ui/table/index.js";
	import { capitalize } from "$lib/utils/strings";
    import { formatSeconds } from "$lib/utils/time.js"

    export let fees: Record<string, any[]> | null = null;
    export let paymentUrl: string | undefined;

    type FeesObject = Record<string, FeesArray[]>
    type FeesArray = {
        amount: number,
        unit: string,
        period?: number
    } 

    $: type = Array.isArray(fees) ? 'array' : typeof fees;
    $: keysLength = type === 'object' && fees? Object.keys(fees).length: 0;
</script>


{#if keysLength > 0}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Fee Schedule</Card.Title>  
        <Card.Description></Card.Description>
    </Card.Header>  
    <Card.Content>
        {#if fees && type === 'object'}
        {#each Object.entries(fees as FeesObject) as [key, keyfees]}
        <h2>{capitalize(key)}</h2>
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>
                        Amount
                    </Table.Head>
                    <Table.Head>
                        Unit
                    </Table.Head>
                    <Table.Head>
                        Period
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#if keyfees}
                {#each (keyfees as FeesArray[]) as fee}                
                <Table.Row>
                    <Table.Cell>
                        {fee.amount}
                    </Table.Cell>
                    <Table.Cell>
                        {fee.unit}
                    </Table.Cell>
                    <Table.Cell>
                        {fee?.period? formatSeconds(fee?.period): 'n/a'}
                    </Table.Cell>
                </Table.Row>
                {/each}
                {/if}
            </Table.Body>
        </Table.Root>
        {/each}
        {/if}
    </Card.Content>
    <Card.Footer>
        {#if paymentUrl}
        <Button class="bg-orange-400 hover:bg-orange-500" href="{paymentUrl}" target="_blank">
            Purchase Access
        </Button>
        {/if}
    </Card.Footer>
</Card.Root>
{/if}