<script lang="ts">
    import { ispPercentages, ispCounts } from '$lib/stores/isps.js'

    export let isp: string;
</script>

<div id="isp">
    {#if isp}
        <div class="mt-1 py-1 block">
            <span class="text-white/80 font-bold text-xl ">
                {isp}
            </span>
        </div>
    {/if}
    
</div>
