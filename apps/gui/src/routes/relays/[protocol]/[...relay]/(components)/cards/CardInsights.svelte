<script lang="ts">
    import { onMount } from 'svelte';
	import { readable, type Readable } from 'svelte/store';
    import { goto } from '$app/navigation';

	import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
	import CountCard from '$routes/(components)/CountCard.svelte';
    import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

	import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
	import { generateRelayPathFromUrl, generateRelayUrlFromPath } from '$utils/routing';

    import { relayLivenessAggregate$ } from '$stores/helpers/helpers-relay';
	import { relayInsightsCardView, setRelayInsightsCardView, type RelayInsightsCardView } from '$lib/stores/preferences';

    const relayUrl = generateRelayUrlFromPath() as string;

    let relayAggregate: Readable<any | undefined> = readable(undefined, () => {})

    type CountMap = Readable<Map<string, number>>
    type PercentageMap = Readable<Map<string, number>>

    let geocodeCounts: CountMap, geocodePercentages: PercentageMap,
        ispCounts: CountMap, ispPercentages: PercentageMap,
        softwareCounts: CountMap, softwarePercentages: PercentageMap, softwareVersionCounts: CountMap, softwareVersionPercentages: PercentageMap,
        makeSoftwareReadable: (value: string) => string;

    onMount( async () => {
        await import('$lib/stores/geocodes.js').then( module => {
            geocodeCounts = module.geocodeCounts
            geocodePercentages = module.geocodePercentages
        })
        await import('$lib/stores/isps.js').then( module => {
            ispPercentages = module.ispPercentages
            ispCounts = module.ispCounts
        })
        await import('$lib/stores/softwares.js').then( module => {
            softwareCounts = module.softwareCounts
            softwarePercentages = module.softwarePercentages
            softwareVersionCounts = module.softwareVersionCounts
            softwareVersionPercentages = module.softwareVersionPercentages
        })
        await import('$lib/synonyms/software.js').then( module => {
            makeSoftwareReadable = module.makeSoftwareReadable;
        })
        relayAggregate = relayLivenessAggregate$(relayUrl);
    } )

    const changeBubbleType = (type: string) => {
		if (type === 'percent' || type === 'count' || type === 'chart') {
			setRelayInsightsCardView(type satisfies RelayInsightsCardView);
		}
	}

    $: software = $relayAggregate?.software
    $: readableSoftware = software && makeSoftwareReadable && makeSoftwareReadable(software)
    $: version = $relayAggregate?.version
    $: usagePercentageSoftware = software && $softwarePercentages?.get(software)? $softwarePercentages.get(software): null
    $: usageCountSoftware = software && $softwareCounts?.get(software)? $softwareCounts.get(software): null;
    $: usagePercentageVersion = software && $softwareVersionPercentages?.get(software)?.get(version)? $softwareVersionPercentages.get(software)?.get(version): null
    $: usageCountVersion = software && $softwareVersionCounts?.get(software)?.get(version)? $softwareVersionCounts.get(software)?.get(version): null;

    $: isp = $relayAggregate?.isp
    $: usagePercentageIsp = isp && $ispPercentages?.get(isp)? $ispPercentages.get(isp): null
    $: usageCountIsp = isp && $ispCounts?.get($relayAggregate?.isp)? $ispCounts.get($relayAggregate?.isp): null;

    $: geocode = $relayAggregate?.geocode
    $: usagePercentageGeocode = geocode && $geocodePercentages?.get(geocode)? $geocodePercentages.get(geocode): null
    $: usageCountGeocode = geocode &&  $geocodeCounts?.get(geocode)? $geocodeCounts.get(geocode): null;

    $: hasInsights = usageCountSoftware || usageCountVersion || usageCountIsp || usageCountGeocode
</script>

{#if hasInsights}
<Card.Root 
    class="
    w-full bg-black/20 border-white/10 rounded-[3px]
    "
    >
    <Card.Header>
        <Card.Title class="flex flex-nowrap">
            <span  class='font-mono text-white/80 flex'>
                insights
            </span>
            <ToggleGroup.Root type="single" size="lg" class="ml-auto flex-shrink relative -top-3" value={$relayInsightsCardView} onValueChange={(value: string) => changeBubbleType(value)}>
                <ToggleGroup.Item value="percent" aria-label="Percent">
                %
                </ToggleGroup.Item>
                <ToggleGroup.Item value="count" aria-label="Count">
                #
                </ToggleGroup.Item>
                <ToggleGroup.Item value="chart" aria-label="Chart">
				◔
				</ToggleGroup.Item>
            </ToggleGroup.Root>     
        </Card.Title>  
        <Card.Description></Card.Description>
    </Card.Header>  
    <Card.Content>
        <div id="relay-insights" class="
            grid 
            grid-cols-1 
            md:grid-cols-2 
            lg:grid-cols-3 
            xl:grid-cols-4
            mt-1 pb-4 text-black/90 dark:text-white/90 text-xl min-h-96">

            {#if software}
                <CountCard
                    topText=""
                    display={$relayInsightsCardView === 'chart' ? 'donut' : 'text'}
                    donutPercent={usagePercentageSoftware}
                    donutTitle={usagePercentageSoftware == null || !readableSoftware ? undefined : `${usagePercentageSoftware}% of relays use ${readableSoftware}`}
                    value={readable($relayInsightsCardView === 'count'? `${usageCountSoftware}`: `${usagePercentageSoftware}%`)}
                    index={0}
                    innerClass="gradient-purple"
                    >
                    <svelte:fragment slot="bottomText">
                        {$relayInsightsCardView === 'count' ? '' : 'of '}relays use {readableSoftware}
                    </svelte:fragment>
                </CountCard>
            {/if}

            {#if software && version}
                <CountCard
                    topText=""
                    display={$relayInsightsCardView === 'chart' ? 'donut' : 'text'}
                    donutPercent={usagePercentageVersion}
                    donutTitle={usagePercentageVersion == null || !readableSoftware || !version ? undefined : `${usagePercentageVersion}% of ${readableSoftware} relays use ${version}`}
                    value={readable($relayInsightsCardView === 'count'? `${usageCountVersion}`: `${usagePercentageVersion}%`)}
                    index={1}
                    innerClass="gradient-purple"
                    >
                    <svelte:fragment slot="bottomText">
                        {$relayInsightsCardView === 'count' ? '' : 'of '} <em>{readableSoftware}</em> relays use {version}
                    </svelte:fragment>
                </CountCard>
            {/if}

            {#if usagePercentageGeocode || usageCountGeocode}
                <CountCard
                    topText=""
                    display={$relayInsightsCardView === 'chart' ? 'donut' : 'text'}
                    donutPercent={usagePercentageGeocode}
                    donutTitle={usagePercentageGeocode == null || !geocode ? undefined : `${usagePercentageGeocode}% of relays are located in ${geocode}`}
                    value={readable($relayInsightsCardView === 'count'? `${usageCountGeocode}`: `${usagePercentageGeocode}%`)}
                    index={2}
                    innerClass="gradient-purple"
                    >
                    <svelte:fragment slot="bottomText">
                        of relays are located in {geocode} {countryCodeToFlagEmoji(geocode)}
                    </svelte:fragment>
                </CountCard>
            {/if}

            {#if isp}
                <CountCard
                    topText=""
                    display={$relayInsightsCardView === 'chart' ? 'donut' : 'text'}
                    donutPercent={usagePercentageIsp}
                    donutTitle={usagePercentageIsp == null || !isp ? undefined : `${usagePercentageIsp}% of relays use ${isp} as their ISP`}
                    value={readable($relayInsightsCardView === 'count'? `${usageCountIsp}`: `${usagePercentageIsp}%`)}
                    index={3}
                    innerClass="gradient-purple"
                    >
                    <svelte:fragment slot="bottomText">
                        of relays use {isp} as their ISP
                    </svelte:fragment>
                </CountCard>
            {/if}

        </div>
    </Card.Content>
    <Card.Footer>

        <Button 
            variant="secondary" 
            class="ml-8"
            on:click={ () => goto(`/relays/${generateRelayPathFromUrl(relayUrl)}insights`) }
            >
            more insights
        </Button>

    </Card.Footer>
</Card.Root>
{/if}

<style lang="postcss">
    #relay-insights > li {
        @apply pb-6 leading-10;
    }
    
    #relay-insights > li span.value {
        @apply font-bold inline py-1 px-2 rounded-sm;
    }
    </style>
