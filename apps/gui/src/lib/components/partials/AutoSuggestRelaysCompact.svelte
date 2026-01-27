<script lang="ts">
	import { relayCheckAggregates, relaysForMiniSearch } from "$lib/stores/checks.js";
    import { StateManager } from "@nostrwatch/route66";
	import AutoSuggest from "./AutoSuggest.svelte";
    import * as searchConfig from "$lib/stores/search-relays.js";
	import { derived } from "svelte/store";
	import type { Readable } from "svelte/store";

    export let maxResults: number | undefined;
    export let autoFocus: boolean = false; 

    export let inputClass: string | undefined; 
    export let resultWrapperClass: string | undefined;
    export let placeholderText: string | undefined;

    let relayData: Readable<any[]> = derived([relayCheckAggregates, relaysForMiniSearch], ([$relayCheckAggregates, $relaysForMiniSearch]) => {
        const onlineFromLive = $relayCheckAggregates
            .filter((item: any) => item?.liveness === 'online')
            .map((item: any) => ({
                relay: item.relay,
                operatorPubkey: item.operatorPubkey,
                isp: item.isp,
                supportedNips: item.supportedNips,
                id: item.relay,
            }));

        return onlineFromLive.length
            ? onlineFromLive
            : $relaysForMiniSearch?.length
                ? $relaysForMiniSearch
                : [];
    })
</script>

{#if $relayData.length}
    <AutoSuggest 
        payload={$relayData} 
        {searchConfig} 
        {maxResults} 
        {autoFocus} 
        {inputClass} 
        {resultWrapperClass} 
        {placeholderText} 
        />
{:else}
Loading index...
{/if}
