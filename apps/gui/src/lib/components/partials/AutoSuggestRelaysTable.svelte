<script lang="ts">
	import { relayAggregates, relaysForMiniSearch } from "$lib/stores/checks.js";
    import { StateManager } from "@nostrwatch/route66";
	import AutoSuggest from "./AutoSuggest.svelte";
    import * as searchConfig from "$lib/stores/search-relays.js";

    let bootstrapped: boolean = false;

    StateManager.on('bootstrap:checks:complete', () => {
        bootstrapped = true;
    });

    $: miniSearchData = bootstrapped? $relayAggregates: $relaysForMiniSearch?.length? $relaysForMiniSearch: null
</script>

{#if miniSearchData}
    <AutoSuggest mode="table" payload={miniSearchData} {searchConfig} />
<!-- {:else} -->
    <!-- <p>Loading search...</p> -->
{/if}