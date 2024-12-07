<script lang="ts">
    import { ispPercentages, ispCounts } from '$lib/stores/isps.js'

    export let isp: string;

    $: usagePercentageIsp = $ispPercentages.get(isp)? $ispPercentages.get(isp): null
    $: usageCountIsp = $ispCounts.get(isp)? $ispCounts.get(isp): null;
</script>

<div id="isp">
    {#if isp}
        <div class="mt-1 py-1 block">
            <span class="text-white/80 font-bold text-xl ">
                {isp}
            </span>
        </div>
    {/if}
    {#if isp}
        <div class="mt-1 py-1 block">
            {#if usagePercentageIsp || usageCountIsp}
                <span class="text-green-300/50 font-bold italic ">
                    {#if usageCountIsp}
                        {#if usageCountIsp === 1}
                            only this relay uses this ISP
                        {:else}
                            {usageCountIsp} relays use this ISP
                            {#if usagePercentageIsp}
                                ({ usagePercentageIsp }% of relays)
                            {/if}
                        {/if}
                    {/if}
                </span>
            {/if}
        </div>
    {/if}
</div>
