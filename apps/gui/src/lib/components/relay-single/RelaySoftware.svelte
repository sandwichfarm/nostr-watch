<script lang="ts">
    import { makeSoftwareReadable } from '$lib/synonyms/software.js';
    import { softwarePercentages, softwareCounts, softwareVersionPercentages, softwareVersionCounts } from '$lib/stores/softwares.js';

    export let version;
    export let software; 

    $: usagePercentageSoftware = $softwarePercentages.get(software)? $softwarePercentages.get(software): null
    $: usageCountSoftware = $softwareCounts.get(software)? $softwareCounts.get(software): null;
    $: usagePercentageVersion = $softwareVersionPercentages.get(software)?.get(version)? $softwareVersionPercentages.get(software)?.get(version): null
    $: usageCountVersion = $softwareVersionCounts.get(software)?.get(version)? $softwareVersionCounts.get(software)?.get(version): null;
</script>

<div id="software">
    {#if software}
        <div class="mt-1 py-1  block">
            <span class="text-white/80 font-bold text-xl ">
                {makeSoftwareReadable(software)}{#if version}<span class="text-white/50">:{version}</span>{/if}
            </span>
        </div>
    {/if}
    {#if software && version}
        <div class="mt-1 py-1  block">
            {#if usagePercentageSoftware || usageCountSoftware}
            <span class="text-green-300/50 font-bold italic ">
                {#if usageCountSoftware}
                    {#if usageCountSoftware === 1}
                        only this relay uses this sofware 
                    {:else}
                        {usageCountSoftware} relays use this software
                        {#if usagePercentageSoftware}
                            ({ usagePercentageSoftware }% of relays)
                        {/if}
                    {/if}
                {/if}
            </span>
            {/if}
            {#if usagePercentageVersion || usageCountVersion}
                <span class="text-green-300/50 font-bold italic">
                {#if usageCountVersion}
                    {#if usageCountVersion === 1}
                    and only this relay uses this version 
                    {:else}
                    and of those, {usageCountVersion} relays use this version
                    {#if usagePercentageVersion}
                        ({ usagePercentageVersion }%)
                    {/if}
                    {/if}
                {/if}
                </span>
            {/if}
        </div>
    {/if}
</div>