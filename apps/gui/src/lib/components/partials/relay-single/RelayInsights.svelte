<script lang="ts">
	import { onMount } from 'svelte';
	import type { Readable } from 'svelte/store';

    type CountMap = Readable<Map<string, number>>
    type PercentageMap = Readable<Map<string, number>>

    let geocodeCounts: CountMap, geocodePercentages: PercentageMap,
        ispCounts: CountMap, ispPercentages: PercentageMap,
        softwareCounts: CountMap, softwarePercentages: PercentageMap, softwareVersionCounts: CountMap, softwareVersionPercentages: PercentageMap,
        makeSoftwareReadable: (value: string) => string;

    onMount( async () => {
        import('$lib/stores/geocodes.js').then( module => {
            geocodeCounts = module.geocodeCounts
            geocodePercentages = module.geocodePercentages
        })
        import('$lib/stores/isps.js').then( module => {
            ispPercentages = module.ispPercentages
            ispCounts = module.ispCounts
        })
        import('$lib/stores/softwares.js').then( module => {
            softwareCounts = module.softwareCounts
            softwarePercentages = module.softwarePercentages
            softwareVersionCounts = module.softwareVersionCounts
            softwareVersionPercentages = module.softwareVersionPercentages
        })
        import('$lib/synonyms/software.js').then( module => {
            makeSoftwareReadable = module.makeSoftwareReadable;
        })
    } )

    export let relayAggregate: any;

    $: software = relayAggregate?.software
    $: readableSoftware = makeSoftwareReadable && makeSoftwareReadable(software)
    $: version = relayAggregate?.version
    $: usagePercentageSoftware = software && $softwarePercentages?.get(software)? $softwarePercentages.get(software): null
    $: usageCountSoftware = software && $softwareCounts?.get(software)? $softwareCounts.get(software): null;
    $: usagePercentageVersion = software && $softwareVersionPercentages?.get(software)?.get(version)? $softwareVersionPercentages.get(software)?.get(version): null
    $: usageCountVersion = software && $softwareVersionCounts?.get(software)?.get(version)? $softwareVersionCounts.get(software)?.get(version): null;

    $: isp = relayAggregate?.isp
    $: usagePercentageIsp = isp && $ispPercentages?.get(isp)? $ispPercentages.get(isp): null
    $: usageCountIsp = isp && $ispCounts?.get(relayAggregate?.isp)? $ispCounts.get(relayAggregate?.isp): null;

    $: geocode = relayAggregate?.geocode
    $: usagePercentageGeocode = geocode && $geocodePercentages?.get(geocode)? $geocodePercentages.get(geocode): null
    $: usageCountGeocode = geocode &&  $geocodeCounts?.get(geocode)? $geocodeCounts.get(geocode): null;

    $: hasInsights = usageCountSoftware || usageCountVersion || usageCountIsp || usageCountGeocode
</script>
{#if hasInsights}
<h2>Insights</h2>
<ul class="mt-1 py-1 block">
    {#if software && version}
        <li class="mt-1 py-1  block">
            {#if usagePercentageSoftware || usageCountSoftware}
            <span class="text-white/80 italic ">
                {#if usageCountSoftware}
                    {#if usageCountSoftware === 1}
                        only this relay uses this {readableSoftware}
                    {:else}
                        {usageCountSoftware} relays use {readableSoftware}
                        {#if usagePercentageSoftware}
                            ({ usagePercentageSoftware }% of relays)
                        {/if}
                    {/if}
                {/if}
            </span>
            {/if}
            {#if usagePercentageVersion || usageCountVersion}
                <span class="text-white/80 italic">
                {#if usageCountVersion}
                    {#if usageCountVersion === 1}
                    and only this relay uses {version}
                    {:else}
                    and of those, {usageCountVersion} relays use {version}
                    {#if usagePercentageVersion}
                        ({ usagePercentageVersion }%)
                    {/if}
                    {/if}
                {/if}
                </span>
            {/if}
            </li>
    {/if}

    {#if usagePercentageGeocode || usageCountGeocode}
        <li class="text-white/80 italic ">
            {#if usageCountGeocode}
                {#if usageCountGeocode === 1}
                    This is the only relay located in {geocode}
                {:else}
                    {usageCountGeocode} relays are located in {geocode}
                    {#if usagePercentageGeocode}
                        ({ usagePercentageGeocode }% of relays)
                    {/if}
                {/if}
            {/if}
        </li>
    {/if}

    {#if isp}
        <li class="mt-1 py-1 block">
            {#if usagePercentageIsp || usageCountIsp}
                <span class="text-white/80 italic ">
                    {#if usageCountIsp}
                        {#if usageCountIsp === 1}
                            This is the only known relay that uses ${isp}
                        {:else}
                            {usageCountIsp} relays use {isp}
                            {#if usagePercentageIsp}
                                ({ usagePercentageIsp }% of relays)
                            {/if}
                        {/if}
                    {/if}
                </span>
            {/if}
        </li>
    {/if}
</ul>
{/if}