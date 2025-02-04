<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import * as Table from "$lib/components/ui/table/index.js";

    import RelaySoftware from '../RelaySoftware.svelte';
    import RelayCountry from '../RelayCountry.svelte';
    import { route66 } from '$lib/stores/route66';
	import { getRelayUrl } from '../../(utils)/general';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { relayNip11$ } from '$stores/helpers/helpers-nip11s';
	import { nipLeadingZero } from '$utils/nostr';
	import { NIP_NAMES } from '$stores/nip11-meta';
	import { formatNip } from '@nostrwatch/auditor';
	import { values } from 'lodash';
    
    const relayUrl = getRelayUrl()

    export let checks = relayLivenessChecks$(relayUrl);
    const nip11 = relayNip11$(relayUrl);

    export let version;
    export let software;
    export let geocode;

    const formatValue = (value: any, key?: string): string => {
        if(typeof key === 'boolean'){
            return value? 'yes': 'no'
        }
        return value;
    }

    $: supportedNips = $nip11?.supportedNips? $nip11.supportedNips: [];
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
    $: nipsChunks = chunkArray(supportedNips, 5);
        
</script>
<Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
    <Card.Header>
        <Card.Title class='font-mono text-white/80'>nips</Card.Title>  
    </Card.Header>  
    <Card.Content>
        <div class="flex flex-row">
            {#if supportedNips?.length}
            {#each nipsChunks as chunk}
            <Table.Root>
                <!-- <Table.Caption></Table.Caption> -->
                <Table.Header>
                <Table.Row>
                    <Table.Head class="w-[100px]">NIP</Table.Head>
                    <Table.Head>Description</Table.Head>
                </Table.Row>
                </Table.Header>
                <Table.Body>
                {#each chunk as nip}
                    <Table.Row>
                    <Table.Cell>
                        <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/{nipLeadingZero(nip)}.md" 
                            class="font-bold text-black/80 hover:text-black/90 py-1 px-2 bg-black/5 dark:bg-white/10 rounded-sm  dark:text-white/70">
                            {formatNip(nip)}
                        </a>
                    </Table.Cell>
                    <Table.Cell><span class="text-black/70 dark:text-white/70">{ $NIP_NAMES[ nipLeadingZero(nip).toString() ] }</span></Table.Cell>
                    </Table.Row>
                {/each}
                </Table.Body>
            </Table.Root>
            {/each}
            <!-- {#each supportedNips as nip}
                <span class="block mb-2">
                    <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/{nipLeadingZero(nip)}.md" 
                        class="font-bold text-black/80 hover:text-black/90 py-1 px-2 bg-black/5 dark:bg-white/10 rounded-sm  dark:text-white/70">
                        {formatNip(nip)}
                    </a>
                    <span class="text-black/70 dark:text-white/70">{ $NIP_NAMES[ nipLeadingZero(nip).toString() ] }</span>
                </span>
            {/each} -->
            {/if}
        </div>
    </Card.Content>
    <Card.Footer>
        <!-- <Button>
            Details
        </Button> -->
    </Card.Footer>
</Card.Root>
