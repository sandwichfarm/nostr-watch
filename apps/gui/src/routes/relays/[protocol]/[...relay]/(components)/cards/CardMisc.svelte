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
    
    const ips: Readable<Record<string, string[]>> = relayIps$(relayUrl)
    const livenessAggregate: Readable<any> = relayLivenessAggregate$(relayUrl)
    const software: Readable<string | undefined> = relaySoftware$(relayUrl)
    const version: Readable<string> = relaySoftwareVersion$(relayUrl)
    const countryCodes: Readable<IGeocode[]> = relayCountryCodes$(relayUrl)
    
    $: alpha2 = Array.from(new Set($countryCodes
        .filter( ({format, length}) => format === 'alpha' && length === 2 )
        .map( ({code}) => code)));
    $: countryNames = alpha2.map( code => getCountryName(code) )


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
                <div class="clamp-5">
                    {#if $ips.ipv4?.length}
                    <ul class="pl-5">
                        known ips 
                        {#each $ips.ipv4 as ip}
                            <li class="list-disc">
                                <span class="text-md py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                                    {ip}
                                </span>
                            </li>
                        {/each}
                    </ul>
                    {:else}
                        <div>no IPs</div>
                    {/if}
                </div>
                <div class="">
                    {#if countryNames?.length}
                        {#each countryNames as country, index}
                            <div class="text-2xl">{countryCodeToFlagEmoji(alpha2[index])} {country}</div>
                        {/each}
                        <span class="text-xs italic text-black/50 dark:text-white/50">
                            The geographic location of relays is a a best-guess using IP to Location databases. A variety of factors can cause this to be inaccurate.
                        </span>
                    {:else}
                        <div>No geographical location was found</div>
                    {/if}
                </div>
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