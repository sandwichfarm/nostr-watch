<script lang="ts">
	import type { page } from '$app/stores';
	import * as Card from '$lib/components/ui/card';
	// import {  } from '$stores/helpers/helpers-nip11s';
	import { relayOperatorProfile$, relayOperatorRelayList$, relayOperatorPubkey$ } from '$stores/helpers/helpers-relay';
	import { monitors } from '$stores/monitors';
	import Button from '$ui/button/button.svelte';
	import { onMount } from 'svelte';
	import CardOperator from './(components)/cards/CardOperator.svelte';
	import { getRelayUrl } from './(utils)/general';
	import { instance } from '$utils/lifecycle';
	import type { PubkeyProfile } from '@nostrwatch/route66/models/PubkeyProfile';
	import { readable, type Readable } from 'svelte/store';
	import type { PubkeyRelays } from '@nostrwatch/route66/models/PubkeyRelays';
	import CardInsights from './(components)/cards/CardInsights.svelte';
	import CardGeneral from './(components)/cards/CardGeneral.svelte';
	import CardNips from './(components)/cards/CardNips.svelte';
	import CardLimitation from './(components)/cards/CardLimitation.svelte';

    export let relayData: any;

    const relayUrl = getRelayUrl();

    let operatorPubkey: Readable<string | undefined> = relayOperatorPubkey$(relayUrl)
    let operatorProfile: Readable<PubkeyProfile | undefined> = relayOperatorProfile$(relayUrl)
    let operatorRelays: Readable<PubkeyRelays | undefined> = relayOperatorRelayList$(relayUrl)

    export let relayAggregate: any | undefined;

    onMount(async () => {
        const route66 = await instance();
        await route66.ready();
        // operatorPubkey = 
        // operatorProfile = 
        // operatorRelays = 
    })
</script>

<div class="space-y-6">
    <CardGeneral />

    {#if $operatorPubkey}
    <CardOperator 
        {relayUrl} 
        pubkey={$operatorPubkey} 
        />
    {/if}

    <CardLimitation />

    <CardNips />

    <CardInsights />

    <Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>checks</Card.Title>  
        </Card.Header>  
        <Card.Content>

        </Card.Content>
        <Card.Footer>
            <!-- <Button>
                Details
            </Button> -->
        </Card.Footer>
    </Card.Root>

    <Card.Root class="w-full bg-gray-900/5 border-white/10 rounded-[3px]">
        <Card.Header>
            <Card.Title class='font-mono text-white/80'>issues</Card.Title>  
        </Card.Header>  
        <Card.Content>

        </Card.Content>
        <Card.Footer>
            <!-- <Button>
                Details
            </Button> -->
        </Card.Footer>
    </Card.Root>


</div>