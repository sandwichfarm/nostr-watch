<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import type { Nip66Event } from '@nostrwatch/route66/models';
	import RelayIsp from '../RelayIsp.svelte';
    
    export let aggregate: any;

    $: isp = aggregate?.isp ?? null;
    $: ipv4 = aggregate?.ipv4 ?? null;
    $: ipv6 = aggregate?.ipv6 ?? null;

</script>

{#if isp}
<Card.Root class="relay-card">
    <Card.Header>
        <Card.Title>Network</Card.Title>  
        <Card.Description>Card Description</Card.Description>
    </Card.Header>  
    <Card.Content>
        <div id="isp">
            {#if isp}
                <div class="mt-1 py-1 block">
                    <span class="text-white/80 font-bold text-xl ">
                        {isp}
                    </span>
                </div>
            {/if}
        </div>
        <div id="ipv4">
            {#if ipv4?.length}
                {#each ipv4 as ip}
                <!-- <div class="mt-1 py-1 block"> -->
                    <span class="text-white/80 font-bold text-lg block mt-3">
                        {ip}
                    </span>
                <!-- </div> -->
                {/each}
            {/if}
        </div>
        <div id="isp">
            {#if ipv6?.length}
                {#each ipv6 as ip}
                <div class="mt-1 py-1 block">
                    <span class="text-white/80 font-bold text-xl ">
                        {ip}
                    </span>
                </div>
                {/each}
            {/if}
        </div>
    </Card.Content>
    <Card.Footer>
    </Card.Footer>
</Card.Root>
{/if}