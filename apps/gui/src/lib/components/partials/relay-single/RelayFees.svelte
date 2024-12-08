<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
    import { formatSeconds } from "$lib/utils/time.js"

    export let fees: any[] = [];
</script>

{#if fees?.length}
    <h2>Fee Schedule</h2>
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
            {#each fees as fee}
            <Table.Row>
                <Table.Cell>
                    {fee.amount}
                </Table.Cell>
                <Table.Cell>
                    {fee.unit}
                </Table.Cell>
                <Table.Cell>
                    {formatSeconds(fee.period)}
                </Table.Cell>
            </Table.Row>
            {/each}
        </Table.Body>
    </Table.Root>    
{/if}

