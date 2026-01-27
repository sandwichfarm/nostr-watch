<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import { capitalize } from "$lib/utils/strings";
    import { formatSeconds } from "$lib/utils/time.js"

    type FeesObject = Record<string, FeesArray[]>
    type FeesArray = {
        amount: number,
        unit: string,
        period?: number
    } 

    export let fees: any[] | Record<string, any[]> = [];

    $: type = Array.isArray(fees) ? 'array' : 'object';
</script>

{#if fees}
    {#if type === 'object'}
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
                    {fee?.period? formatSeconds(fee?.period): ''}
                </Table.Cell>
            </Table.Row>
            {/each}
            {/if}
        </Table.Body>
    </Table.Root>
    {/each}
    {/if}
{/if}