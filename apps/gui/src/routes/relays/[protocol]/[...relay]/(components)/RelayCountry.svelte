<script lang="ts">
    import { geocodeCounts, geocodePercentages } from '$lib/stores/geocodes.js'

    const geocode = ''
</script>

<div id="geocode">
    {#if geocode}
        <div class="mt-1 py-1 block">
            <span class="text-black/80 dark:text-white/80 font-bold text-xl ">
                {geocode}
            </span>
        </div>
    {/if}
</div>