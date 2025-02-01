<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, type Readable, type Writable } from 'svelte/store';
    import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

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

    const bubbleType: Writable<'percent' | 'count'> = writable('percent')

    const changeBubbleType = (type: 'percent' | 'count') => {
        ////console.log('ACTIVITY')
        bubbleType.set(type)
    }

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
<ToggleGroup.Root type="single" size="lg" onValueChange={(value: string) => changeBubbleType(value)}>
    <ToggleGroup.Item value="percent" aria-label="Toggle bold">
      %
    </ToggleGroup.Item>
    <ToggleGroup.Item value="count" aria-label="Toggle italic">
      #
    </ToggleGroup.Item>
</ToggleGroup.Root>     

<ul id="relay-insights" class="mt-1 py-1 block text-white/90 text-xl">
    {#if software}
        <li class="flex">
            <div class="flex-shrink mr-5">
                {#if $bubbleType == 'percent'}
                    <span class="flex items-center justify-center text-2xl rounded-full py-4 text-center bg-blue-500 w-24 h-24">{usagePercentageSoftware}%</span>
                {:else}
                    <span class="flex items-center justify-center text-4xl rounded-full py-4 text-center bg-blue-500 w-24 h-24">{usageCountSoftware}</span>
                {/if}
                
            </div>
            <div class="flex-grow">
            {#if usagePercentageSoftware || usageCountSoftware}
                {#if usageCountSoftware}
                    {#if usageCountSoftware === 1}
                        only this relay uses this <span class="value">{readableSoftware}</span>
                    {:else}
                        {#if $bubbleType == 'percent'}of {/if}
                        relays use <span class="value">{readableSoftware}</span>
                        <!-- {#if usagePercentageSoftware}
                            or <span class="value">{ usagePercentageSoftware }%</span>
                        {/if} -->
                    {/if}
                {/if}
            {/if}
            </div>
        </li>
    {/if}
    {#if software && version}
        <li class="flex">
            <div class="flex-shrink mr-5">
                {#if $bubbleType == 'percent'}
                    <span class="flex items-center justify-center text-2xl rounded-full text-center bg-purple-600 w-24 h-24">
                        {usagePercentageVersion}%
                    </span>
                {:else}
                    <span class="flex items-center justify-center text-4xl rounded-full py-4 text-center bg-purple-600 w-24 h-24">{usageCountVersion}</span>
                {/if}
                
            </div>
            <div class="flex-grow">
                {#if usagePercentageVersion || usageCountVersion}
                    {#if usageCountVersion}
                        {#if usageCountVersion === 1}
                            relay (this one) uses <span class="value">{readableSoftware}</span> version <span class="value">{version}</span>
                        {:else}
                            {#if $bubbleType == 'percent'}of {/if}
                            <span class="value">{readableSoftware}</span> relays are on version <span class="value">{version}</span>
                            <!-- {#if usagePercentageVersion}
                                or <span class="value">{ usagePercentageVersion }%</span>
                            {/if} -->
                        {/if}
                    {/if}
                {/if}
            </div>  
        </li>
    {/if}

    {#if usagePercentageGeocode || usageCountGeocode}
    <li class="flex">
        <div class="flex-shrink mr-5">
            {#if $bubbleType == 'percent'}
                <span class="flex items-center justify-center text-2xl rounded-full text-center bg-orange-400/90 w-24 h-24">{usagePercentageGeocode}%</span>
            {:else}
                <span class="flex items-center justify-center text-4xl rounded-full text-center bg-orange-400/90 w-24 h-24">{usageCountGeocode}</span>
            {/if}
            
        </div>
        <div class="flex-grow">
            {#if usageCountGeocode}
            {#if usageCountGeocode === 1}
                relay (this one) uses <span class="value">{geocode}</span>
            {:else}
                {#if $bubbleType == 'percent'}of {/if}
                relays are located in <span class="value">{geocode}</span>
                <!-- {#if usagePercentageGeocode}
                    or <span class="value">{ usagePercentageGeocode }%</span>
                {/if} -->
            {/if}
        {/if}
        </div>  
    </li>
    {/if}

    {#if isp}
        <li class="flex">
            <div class="flex-shrink mr-5">
                {#if $bubbleType == 'percent'}
                    <span class="flex items-center justify-center text-2xl rounded-full bg-red-500 w-24 h-24">{usagePercentageIsp}%</span>
                {:else}
                    <span class="flex items-center justify-center text-4xl rounded-full bg-red-500 w-24 h-24">{usageCountIsp}</span>
                {/if}
            </div>
            <div class="flex-grow">
            {#if usagePercentageIsp || usageCountIsp}
                {#if usageCountIsp}
                    {#if usageCountIsp === 1}
                        This is the only known relay that uses the ISP <span class="value">{isp}</span>
                    {:else}
                        {#if $bubbleType == 'percent'}of {/if}
                        relays have <span class="value">{isp}</span> as their ISP 
                        <!-- {#if usagePercentageIsp}
                            or <span class="value">{ usagePercentageIsp }%</span>
                        {/if} -->
                    {/if}
                {/if}
            {/if}
            </div>  
        </li>
        <li class="mt-1 py-1 block">
            
        </li>
    {/if}
</ul>
{/if}

<style>
#relay-insights > li {
    @apply pb-6 leading-10;
}

#relay-insights > li span.value {
    @apply text-white font-bold inline py-1 px-2 bg-black/5 dark:bg-white/5 rounded-sm;
}
</style>