<script lang="ts">
    import { makeSoftwareReadable } from '$lib/synonyms/software.js';
    import { softwarePercentages, softwareCounts, softwareVersionPercentages, softwareVersionCounts } from '$lib/stores/softwares.js';

    export let version;
    export let software; 
</script>

<div id="software">
    {#if software}
        <div class="mt-1 py-1  block">
            <span class="text-white/80 font-bold text-xl ">
                {makeSoftwareReadable(software)}{#if version}<span class="text-white/50">:{version}</span>{/if}
            </span>
        </div>
    {/if}
    
</div>