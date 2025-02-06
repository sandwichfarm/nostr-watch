<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { route66 } from '$lib/stores/route66';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayCountryCodes$, relayIps$, relayIsp$, relayLivenessAggregate$, relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { relayNip11$, relaySoftware$, relaySoftwareVersion$ } from '$stores/helpers/helpers-nip11s';
	import { readable, type Readable } from 'svelte/store';
	import type { IGeocode } from '@nostrwatch/route66/models/Geocode';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';
	import { getCountryName } from '$stores/iso3166';
	import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
	import { makeSoftwareReadable } from '$lib/synonyms/software';
	import isps from '$lib/config/dataTable/isps';
	import { onMount } from 'svelte';
	import type { Nip11 } from '@nostrwatch/route66/models/Nip11';
    
    const relayUrl = generateRelayUrlFromPath() as string

    let nip11: Readable<Nip11 | undefined> = readable(undefined);
    let checks: Readable<Nip66CheckEvent[]> = readable([]);
    
    let ips: Readable<Record<string, string[]> | undefined> = readable({});
    let livenessAggregate: Readable<any> = readable({});
    let software: Readable<string | undefined>  = readable(undefined);
    let version: Readable<string | undefined>  = readable(undefined);
    let countryCodes: Readable<IGeocode[]>  = readable([]);
    let isp: Readable<string[]> = readable([]);

    onMount( () => {
        nip11 = relayNip11$(relayUrl);
        checks = relayLivenessChecks$(relayUrl);
    
        ips = relayIps$(relayUrl)
        livenessAggregate = relayLivenessAggregate$(relayUrl)
        software= relaySoftware$(relayUrl)
        version= relaySoftwareVersion$(relayUrl)
        countryCodes = relayCountryCodes$(relayUrl)
        isp = relayIsp$(relayUrl)
    })
    
    $: alpha2 = $countryCodes 
        ? Array.from(new Set($countryCodes
            .filter( ({format, length}) => format === 'alpha' && length === 2 )
            .map( ({code}) => code)))
        : [];
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
    $: numChecks = $checks?.length || 0
    $: percentageReportingOnline = numEnabledMonitors > 0? `${Math.round(numChecks/numEnabledMonitors*100)}%`: `n/a`
    $: readableSoftware = $software? makeSoftwareReadable($software): undefined;
    $: ipsFlat = Object.values($ips).flat()

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
    <Card.Root>
        <Card.Header>
            <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>general</Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="grid grid-cols-3 gap-8">
                {#if $nip11}
                <div class="border p-4 rounded-md ">
                    
                    <div class="text-md leading-loose font-mono">
                        <span class='my-4 font-bold text-sm [text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                            nip-11
                        </span>
                        <div class="mb-2">
                            {#if $nip11?.paymentRequired}
                                <span class="inline-block mb-2 mr-2 py-1 px-3 rounded-lg bg-red-600/30 dark:bg-red-600/30">
                                    payment required
                                </span> 
                            {/if}
                            {#if $nip11?.authRequired}
                                <span class="inline-block mb-2 mr-2 py-1 px-3 rounded-lg  bg-red-600/30 dark:bg-red-600/30">
                                    auth required
                                </span>
                            {/if}
                            {#if $nip11?.restrictedWrites === true}
                                <span class="inline-block mb-2 mr-2 py-1 px-3 rounded-lg bg-red-600/30 dark:bg-red-600/30">
                                    writes restricted
                                </span> 
                            {/if}
                            {#if $nip11?.requiresPow === true}
                                <span class="inline-block mb-2 mr-2 py-1 px-3 rounded-lg bg-red-600/30 dark:bg-red-600/30">
                                    writes restricted
                                </span> 
                            {/if}
                            {#if $nip11?.powRequired === true}
                                <span class="inline-block mb-2 mr-2 py-1 px-3 rounded-lg bg-red-600/30 dark:bg-red-600/30">
                                    pow required <span>[{$nip11.minPowDifficulty}]</span>
                                </span>
                            {/if}
                        </div>
                        {#if readableSoftware}
                        <div class="">
                            Software: 
                            <span class="inline-block mb-2 py-1 px-3 rounded-sm bg-black/10 dark:bg-white/10">
                                { readableSoftware }
                            </span>
                        </div>
                        {#if $version}
                        <div class="">
                            Version: 
                            <span class="inline-block mb-2 py-1 px-3 rounded-lg bg-black/10 dark:bg-white/10">
                                {$version}
                            </span> 
                        </div>
                        {/if}
                        {/if}
                        {#if $nip11?.supportedNips?.length}
                        <div class="">
                            NIPs Supported
                            <span class="inline-block mb-2 py-1 px-3 rounded-lg bg-black/10 dark:bg-white/10">
                                {$nip11.supportedNips.length}
                            </span> 
                        </div>
                        {/if}
                        {#if Object.keys($nip11?.limitation || {})?.length}
                        <div class="">
                            Limitations:
                            <span class="inline-block mb-2 py-1 px-3 rounded-lg bg-black/10 dark:bg-white/10">
                                {Object.keys($nip11?.limitation || {})?.length}
                            </span> 
                        </div>
                        {/if}
                    </div>
                    
                </div>
                {/if}

                <div class="border p-4 rounded-md ">
                    {#if ipsFlat.length}
                    <ul class="pl-5">
                        <span class='block my-4 font-bold text-sm [text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                            known ips
                        </span>
                        {#each ipsFlat as ip, index}
                            {#if index < 3}
                            <li class="list-disc">
                                <span class="font-mono text-lg py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                                    {ip}
                                </span>
                            </li>
                            {:else if index === ipsFlat.length-1} 
                            <span>+{ipsFlat.length-3} more</span>
                            {/if}
                        {/each}
                        <span class='block my-4 font-bold text-sm [text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                            known ISPs
                        </span>
                        <span class="font-mono text-lg py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                            {$isp}
                        </span>
                        
                    </ul>
                    {:else}
                        <div>no IPs</div>
                    {/if}
                </div>
                <div class="border p-4 rounded-md ">
                    <span class='block my-4 font-bold text-sm [text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                        network
                    </span>
                    <span class="font-mono text-lg py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                        {$livenessAggregate?.networks}
                    </span>
                    {#if countryNames?.length || $livenessAggregate?.geohash || $livenessAggregate?.dd}
                    <span class='block my-2 font-bold text-sm [text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                        geographical location
                    </span>
                    {#if countryNames?.length}
                        {#each countryNames as country, index}
                            <div class="text-3xl my-2">{countryCodeToFlagEmoji(alpha2[index])} {country}</div>
                        {/each}
                        
                    {:else}
                        <div>No geographical location was found</div>
                    {/if}
                    <span class="font-mono py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                        Geohash: {$livenessAggregate?.geohash}
                    </span>
                    {#if $livenessAggregate?.dd?.lat && $livenessAggregate?.dd?.lon}
                    <span class="font-mono py-1 px-2 bg-white/10 rouned-lg inline-block mb-2">
                        lat/lon: {$livenessAggregate?.dd.lat.toFixed(5)}, {$livenessAggregate?.dd.lon.toFixed(5)}
                    </span>
                    {/if}
                    <span class="block text-xs italic text-black/50 dark:text-white/50">
                        The geographic location of relays is a a best-guess using IP to Location databases. A variety of factors can cause this to be inaccurate.
                    </span>
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