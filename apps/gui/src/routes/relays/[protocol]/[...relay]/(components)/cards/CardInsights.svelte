<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
    import RelayInsights from "../RelayInsights.svelte";

    import { onMount } from 'svelte';
	import { readable, writable, type Readable, type Writable } from 'svelte/store';
    import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
	import { relayLivenessAggregate$ } from '$stores/helpers/helpers-relay';
	import { getRelayUrl } from '../../(utils)/general';
	import CountCard from '$routes/components/CountCard.svelte';
	import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
	import { formatRelayUrl } from '$utils/routing';
	import { goto } from '$app/navigation';

    const relayUrl = getRelayUrl()

    const relayAggregate: Readable<any> | undefined = relayLivenessAggregate$(relayUrl);

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

    
    let actions

    const bubbleType: Writable<'percent' | 'count'> = writable('percent')

    const changeBubbleType = (type: 'percent' | 'count') => {
        ////console.log('ACTIVITY')
        bubbleType.set(type)
    }

    $: software = $relayAggregate?.software
    $: readableSoftware = makeSoftwareReadable && makeSoftwareReadable(software)
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
<Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
    <Card.Header>
        <Card.Title class="flex flex-nowrap">
            <span class="flex">
                Insights
            </span>
            <ToggleGroup.Root type="single" size="lg" class="ml-auto flex-shrink relative -top-3" onValueChange={(value: string) => changeBubbleType(value)}>
                <ToggleGroup.Item value="percent" aria-label="Toggle bold">
                %
                </ToggleGroup.Item>
                <ToggleGroup.Item value="count" aria-label="Toggle italic">
                #
                </ToggleGroup.Item>
            </ToggleGroup.Root>     
        </Card.Title>  
        <Card.Description></Card.Description>
    </Card.Header>  
    <Card.Content>
        <ul id="relay-insights" class="flex mt-1 py-4 px-10 text-black/90 dark:text-white/90 text-xl">

            {#if software}
                <CountCard 
                    topText="" 
                    value={readable($bubbleType === 'percent'? `${usagePercentageSoftware}%`: `${usageCountSoftware}`)} 
                    bottomText={`${$bubbleType === 'percent'? 'of ': ''}relays use ${readableSoftware}`} 
                    index={0} 
                    class="w-full md:w-1/4" 
                    />
            {/if}

            {#if software && version}
                <CountCard 
                    topText="" 
                    value={readable($bubbleType === 'percent'? `${usagePercentageVersion}%`: `${usageCountVersion}`)} 
                    bottomText={`${$bubbleType === 'percent'? 'of ': `<em>${readableSoftware}</em> `}relays use ${version}`} 
                    index={1} 
                    class="w-full md:w-1/4" 
                    />
            {/if}

            {#if usagePercentageGeocode || usageCountGeocode}
                <CountCard 
                    topText="" 
                    value={readable(`${usagePercentageGeocode}%`)} 
                    bottomText={`of relays are located in ${geocode} ${countryCodeToFlagEmoji(geocode)}`} 
                    index={2} 
                    class="w-full md:w-1/4" 
                    />
            {/if}

            {#if isp}
                <CountCard 
                    topText="" 
                    value={readable(`${usagePercentageIsp}%`)} 
                    bottomText={`of relays use ${isp} as their ISP`} 
                    index={3} 
                    class="w-full md:w-1/4" 
                    />
            {/if}

        </ul>
    </Card.Content>
    <Card.Footer>
        <Button on:click={ () => goto(`/relays/${formatRelayUrl(relayUrl)}insights`) }>more insights</Button>
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