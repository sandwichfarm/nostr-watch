<script lang="ts">
	import type { page } from '$app/stores';
	import * as Card from '$lib/components/ui/card';
	// import {  } from '$stores/helpers/helpers-nip11s';
	import { relayOperatorProfile$, relayOperatorRelayList$, relayOperatorPubkey$ } from '$stores/helpers/helpers-relay';
	// import { monitors } from '$stores/monitors';
	// import Button from '$ui/button/button.svelte';
	import { onMount } from 'svelte';
	import CardOperator from './(components)/cards/CardOperator.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { instance } from '$utils/lifecycle';
	// import type { PubkeyProfile } from '@nostrwatch/route66/models/PubkeyProfile';
	import { readable, type Readable } from 'svelte/store';
	// import type { PubkeyRelays } from '@nostrwatch/route66/models/PubkeyRelays';
	import CardInsights from './(components)/cards/CardInsights.svelte';
	import CardGeneral from './(components)/cards/CardGeneral.svelte';
	// import CardNips from './(components)/cards/CardNips.svelte';
	// import CardLimitation from './(components)/cards/CardLimitation.svelte';
	// import CardNip11 from './(components)/cards/CardNip11.svelte';
    import CardFees from './(components)/cards/CardFees.svelte';
	import CardChecks from './(components)/cards/CardChecks.svelte';
	import { fade } from 'svelte/transition';
	// import CardIssues from './(components)/cards/CardIssues.svelte';

    const relayUrl = generateRelayUrlFromPath() as string;
    let operatorPubkey: Readable<string | undefined> = readable(undefined)

    onMount(async () => {
        const route66 = await instance();
        await route66.ready();
		operatorPubkey = relayOperatorPubkey$(relayUrl)
    })
</script>

<div class="space-y-6">
    <!-- <CardIssues /> -->
	<div in:fade out:fade>
    <CardGeneral />
	</div>
    <CardFees />
    {#if $operatorPubkey}
    <CardOperator pubkey={$operatorPubkey} />
    {/if}
    <CardInsights />	
    <CardChecks />
</div>