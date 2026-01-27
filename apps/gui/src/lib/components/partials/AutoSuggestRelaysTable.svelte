<script lang="ts">
	import { relayCheckAggregates, relaysForMiniSearch } from "$lib/stores/checks.js";
    import { StateManager } from "@nostrwatch/route66";
	import AutoSuggest from "./AutoSuggest.svelte";
    import * as searchConfig from "$lib/stores/search-relays.js";

    let bootstrapped: boolean = false;

    StateManager.on('bootstrap:checks:complete', () => {
        bootstrapped = true;
    });

    $: miniSearchData = bootstrapped
        ? $relayCheckAggregates
            .filter((item: any) => item?.liveness === 'online')
            .map((item: any) => ({
                relay: item.relay,
                operatorPubkey: item.operatorPubkey,
                isp: item.isp,
                supportedNips: item.supportedNips,
                id: item.relay,
            }))
        : $relaysForMiniSearch?.length
            ? $relaysForMiniSearch
            : null
</script>

{#if miniSearchData}
    <AutoSuggest mode="table" payload={miniSearchData} {searchConfig} />
<!-- {:else} -->
    <!-- <p>Loading search...</p> -->
{/if}
