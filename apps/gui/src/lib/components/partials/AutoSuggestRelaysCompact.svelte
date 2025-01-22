<script lang="ts">
	import { relayCheckAggregates, relaysForMiniSearch } from "$lib/stores/checks.js";
    import { StateManager } from "@nostrwatch/route66";
	import AutoSuggest from "./AutoSuggest.svelte";
    import * as searchConfig from "$lib/stores/search-relays.js";
	import { derived } from "svelte/store";
	import type { Readable } from "svelte/store";

    export let maxResults: number | undefined;
    export let autoFocus: boolean = false;  

    let relayData: Readable<any[]> = derived([relayCheckAggregates, relaysForMiniSearch], ([$relayCheckAggregates, $relaysForMiniSearch]) => {
        return  $relayCheckAggregates.length? 
                    $relayCheckAggregates: 
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