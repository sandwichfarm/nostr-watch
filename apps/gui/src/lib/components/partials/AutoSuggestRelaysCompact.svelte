<script lang="ts">
	import { relayAggregates, relaysForMiniSearch } from "$lib/stores/checks.js";
    import { StateManager } from "@nostrwatch/nip66";
	import AutoSuggest from "./AutoSuggest.svelte";
    import * as searchConfig from "$lib/stores/search-relays.js";
	import { derived } from "svelte/store";
	import type { Readable } from "svelte/store";

    export let maxResults: number | undefined;
    export let autoFocus: boolean = false;  

    let relayData: Readable<any[]> = derived([relayAggregates, relaysForMiniSearch], ([$relayAggregates, $relaysForMiniSearch]) => {
        return  $relayAggregates.length? 
                    $relayAggregates: 
                    $relaysForMiniSearch?.length? 
                        $relaysForMiniSearch:
                        []
    })
</script>

{#if $relayData.length}
    <AutoSuggest payload={$relayData} {searchConfig} {maxResults} {autoFocus} />
{:else}
Loading index...
{/if}