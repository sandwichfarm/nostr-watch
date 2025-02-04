<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import * as Table from "$lib/components/ui/table/index.js";
;
    import { route66 } from '$lib/stores/route66';
	import { getRelayUrl } from '../../(utils)/general';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import type { nip11 } from 'nostr-tools';
	import { NIP_11_LIMITATIONS } from '$stores/nip11-meta';
    const relayUrl = getRelayUrl()

    export let checks = relayLivenessChecks$(relayUrl);
    const nip11 = relayNip11$(relayUrl);

    export let version;
    export let software;
    export let geocode;

    const defaultLimitation: nip11.Limitations = {

    }

    const formatValue = (value: any, key?: string): string => {
        if(typeof key === 'boolean'){
            return value? 'yes': 'no'
        }
        return value;
    }

    $: enabledMonitors = $route66?.initialized ? $route66?.services?.monitors.enabledMonitors: []
    $: numEnabledMonitors = enabledMonitors.length
    $: numChecks = $checks.length
    $: percentageReportingOnline = numEnabledMonitors > 0? `${Math.round(numChecks/numEnabledMonitors*100)}%`: `n/a`

    const chunkArray = (arr, chunkSize) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
        }
        return chunks;
    };

    $: limitationEntries = Object.entries($nip11?.limitation || {}).filter(
        ([key, value]) => typeof value !== 'undefined' && value !== null && value !== ''
    );

    $: limitationChunks = chunkArray(limitationEntries, 5);
        
</script>
    <!-- <Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>limitations</Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="flex flex-row">
            {#each limitationChunks as chunk, index}
            <Table.Root>
                <Table.Header>
                <Table.Row>
                    <Table.Head class="w-[100px]">Limitation</Table.Head>
                    <Table.Head>Parameter</Table.Head>
                </Table.Row>
                </Table.Header>
                <Table.Body>
                {#each chunk as [key, value]}
                    <Table.Row>
                    <Table.Cell>{key}</Table.Cell>
                    <Table.Cell>{value}</Table.Cell>
                    </Table.Row>
                {/each}
                </Table.Body>
            </Table.Root>
            {/each}
        </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root> -->
{#if limitationEntries.length}
    <Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>limitations</Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="flex flex-row">
            <Table.Root>
                <!-- <Table.Caption></Table.Caption> -->
                <Table.Header>
                <Table.Row>
                    <Table.Head class="w-[100px]">Limitation</Table.Head>
                    <Table.Head>Parameter</Table.Head>
                </Table.Row>
                </Table.Header>
                <Table.Body>
                {#each limitationEntries as [key, value]}
                    <Table.Row>
                    <Table.Cell>
                        <span class="font-mono inline-block my-1 py-1 px-2 rounded-sm bg-white/10">{key}</span>
                    </Table.Cell>
                    <Table.Cell>
                        <span class="font-mono inline-block my-1 py-1 px-2 rounded-sm bg-white/10 font-bold">{value}</span>
                    </Table.Cell>
                    <Table.Cell class="text-lg py-3 text-black/70 dark:text-white/70">
                        {$NIP_11_LIMITATIONS?.[key] || ''}
                    </Table.Cell>
                    </Table.Row>
                {/each}
                </Table.Body>
            </Table.Root>
        </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
    {/if}