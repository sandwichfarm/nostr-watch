<script lang="ts">
    import { geocodeCounts, geocodePercentages } from '$lib/stores/geocodes.js'

    export let geocode: string;

    $: usagePercentageGeocode = $geocodePercentages.get(geocode)? $geocodePercentages.get(geocode): null
    $: usageCountGeocode = $geocodeCounts.get(geocode)? $geocodeCounts.get(geocode): null;
</script>

<div id="geocode">
    {#if geocode}
        <div class="mt-1 py-1 block">
            <span class="text-white/80 font-bold text-xl ">
                {geocode}
            </span>
        </div>
        <div class="mt-1 py-1 block">
            {#if usagePercentageGeocode || usageCountGeocode}
                <span class="text-green-300/50 font-bold italic ">
                    {#if usageCountGeocode}
                        {#if usageCountGeocode === 1}
                            only this relay is located in this country
                        {:else}
                            {usageCountGeocode} relays are located in this country
                            {#if usagePercentageGeocode}
                                ({ usagePercentageGeocode }% of relays)
                            {/if}
                        {/if}
                    {/if}
                </span>
            {/if}
        </div>
    {/if}
</div>
