<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
    import { formatSeconds } from "$lib/utils/time.js"
	import CountCard from '$routes/components/CountCard.svelte';
	import { relayFees$, relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import { get, readable, type Readable } from 'svelte/store';
	import { getRelayUrl } from '../../(utils)/general';
	import RelayFeeItem from '../partials/RelayFeeItem.svelte';

    type FeesObject = Record<string, FeesArray[]>
    type FeesArray = {
        amount: number,
        unit: string,
        period?: number
    } 


    const relayUrl = getRelayUrl();
    const fees: Readable<FeesObject> = relayFees$(relayUrl);
    const nip11 = relayNip11$(relayUrl)

    // export let fees: Record<string, any[]> | null = null;
    // export let paymentUrl: string | undefined;

    const commaOrAnd = (index: number, length: number) => {
        if(index === length - 1){
            return ' and ';
        }
        return length > 2? ', ': '';
    }


    $: paymentsUrl = $nip11?.paymentsUrl || undefined;
    $: type = Array.isArray(fees) ? 'array' : typeof $fees;
    $: feeKeys = type === 'object' && fees? Object.keys($fees): [];
    $: keysLength = feeKeys.length;
</script>
{#if keysLength > 0}
    <Card.Root class="relay-card">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>fee schedule</Card.Title>  
        </Card.Header>  
        <Card.Content class="flex flex-row">
            <div class="w-1/3 flex-shrink-0 text-2xl leading-relaxed p-10 text-center">
                <p class="block mb-10">
                This relay charges a fee for 
                {#each feeKeys as key, index}
                {commaOrAnd(index, keysLength)}<span class="bg-black/5 dark:bg-white/10 py-1 px-2 rounded-sm">{key}</span>
                {/each} 
                </p>

                {#if paymentsUrl}
                <Button 
                    size="lg"
                    class="text-lg py-1.5 font-mono inline-block gradient-orange" 
                    href="{paymentsUrl}" 
                    target="_blank">
                    purchase access
                </Button>
                {/if}

            </div>
            <div class="w-2/3 grid grid-cols-3">
                {#if $fees && type === 'object'}
                {#each Object.entries($fees as FeesObject) as [key, keyfees]}
                    {#if keyfees}
                    {#each (keyfees as FeesArray[]) as fee}      
                        <RelayFeeItem {key} {fee} />
                    {/each}
                    {/if}
                {/each}
                {/if}
            </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>            
    </Card.Root>
{/if}

<!-- 
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
{/if} -->