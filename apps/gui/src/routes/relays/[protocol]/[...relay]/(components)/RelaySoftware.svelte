<script lang="ts">
    import { makeSoftwareReadable } from '$lib/synonyms/software.js';
    import { softwarePercentages, softwareCounts, softwareVersionPercentages, softwareVersionCounts } from '$lib/stores/softwares.js';
	import { relayNip11, relaySoftware$, relaySoftwareVersion, relaySoftwareVersion$ } from '$stores/helpers/helpers-nip11s';
	import { get } from 'lodash';
	import { getRelayUrl } from '../(utils)/general';

    const relayUrl = getRelayUrl();
    const version = relaySoftwareVersion$(relayUrl);  
    const software = relaySoftware$(relayUrl);
</script>

<div id="software">
    {#if $software}
        <div class="mt-1 py-1  block">
            <span class="text-black/80 dark:text-white/80 font-bold text-xl ">
                {makeSoftwareReadable($software)}{#if $version}<span class="text-black/70 dark:text-white/70">:{version}</span>{/if}
            </span>
        </div>
    {/if}
</div>