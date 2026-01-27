<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { route66 } from '$lib/stores/route66';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayCountryCodes$, relayIps$, relayLivenessAggregate$, relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { relayNip11$, relaySoftware$, relaySoftwareVersion$ } from '$stores/helpers/helpers-nip11s';
	import { type Readable } from 'svelte/store';
	import type { IGeocode } from '@nostrwatch/route66/models/Geocode';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';
	import { getCountryName } from '$stores/iso3166';
	import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
	import { makeSoftwareReadable } from '$lib/synonyms/software';
    
    const relayUrl = generateRelayUrlFromPath()

    
    const nip11: Readable<Nip11> = relayNip11$(relayUrl);
    export let checks: Readable<Nip66CheckEvent[]> = relayLivenessChecks$(relayUrl);

    const software: Readable<string | undefined> = relaySoftware$(relayUrl)
    const version: Readable<string> = relaySoftwareVersion$(relayUrl)


    const formatValue = (value: any, key?: string): string => {
        if(typeof key === 'boolean'){
            return value? 'yes': 'no'
        }
        return value;
    }


    // $: supportedNips = $nip11?.supportedNips? $nip11.supportedNips: [];
    $: enabledMonitors = $route66?.initialized ? $route66?.services?.monitors.enabledMonitors: []
    $: numEnabledMonitors = enabledMonitors.length
    $: numChecks = $checks.length
    $: percentageReportingOnline = numEnabledMonitors > 0? `${Math.round(numChecks/numEnabledMonitors*100)}%`: `n/a`
    $: readableSoftware = $software? makeSoftwareReadable($software): undefined;

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

    // $: limitationChunks = chunkArray(limitationEntries, 5);
    // $: nipsChunks = chunkArray(supportedNips, 5);
        
</script>
{#if $nip11}
    <Card.Root class="w-full bg-black border-white/10 rounded-[3px]">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>general</Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="grid grid-cols-3 gap-4">
                {#if readableSoftware}
                <div class="bg-purple-500/10 dark:bg-purple-500/10 p-4 rounded-md">
                    
                    <div class="text-md leading-loose font-mono">
                        
                        <div class="">
                            Software: 
                            <span class="inline-block mb-2 py-1 px-3 rounded-sm bg-black/10 dark:bg-white/10">
                                { readableSoftware }
                            </span>
                        </div>
                        {#if $version}
                        <div class="">
                            Version: 
                            <span class="inline-block py-1 px-3 rounded-lg bg-black/10 dark:bg-white/10">
                                {$version}
                            </span> 
                        </div>
                        {/if}
                    </div>
                </div>
                {/if}
                <div class="clamp-5">
                    This relay 
                    {#if $nip11.requiresPayment}
                    requires payment
                    {:else}
                    does not require payment
                    {/if}
                    and 
                    {#if $nip11.requiresAuth}
                    requires NIP-40 auth
                    {:else}
                    does not require NIP-40 auth.
                    {/if}
                </div>
                {#if $nip11.supportedNips.length}
                <div class="">
                    This relay supports {$nip11.supportedNips.length} NIPs
                </div>
                {/if}
                {#if Object.keys($nip11?.limitation || {})?.length}
                <div class="">
                    This relay has a {Object.keys($nip11.limitation).length} limitations
                </div>
                {/if}
            </div>
            
            <!-- <pre>{JSON.stringify(get(relayLivenessAggregate$(relayUrl)),null, 2)}</pre> -->
 
            <!-- <pre>{JSON.stringify(,null, 2)}</pre> -->
            <!-- {checks.length}/{enabledMonitors.length}
            [{percentageReportingOnline}]
            of your enabled monitors are reporting {relayUrl} online
            <RelaySoftware />
            <RelayCountry /> -->
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}