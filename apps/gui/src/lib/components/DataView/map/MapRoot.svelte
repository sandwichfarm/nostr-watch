<script lang="ts">
	import { readable, type Readable, type Writable } from "svelte/store";
	import type { DataViewMapViews } from "../DataTableTypes";
	import MapBasic from "./MapBasic.svelte";
	import MapHeat from "./MapHeat.svelte";
	import MapViewSelector from "./MapViewSelector.svelte";
	import { pauseLiveSync } from "$utils/lifecycle";
	import { onMount } from "svelte";

    export let data: Readable<any[]> | undefined;
    export let filters: Writable<{}>;

    let activeView: Writable<DataViewMapViews>;

    // onMount(() => {
        // const resumer = pauseLiveSync()
        // return async () => {
        //   (await resumer)()
        // }
    // })

</script>

<MapViewSelector enabledViews={['bubble', 'markers', 'heatmap', 'choropleth']} bind:activeView />

{#if data}

    {#if $activeView === 'bubble'}
        <MapBasic {data} />
    {/if}

    {#if $activeView === 'heatmap'}
        <MapHeat {data} {filters} />
    {/if}

{/if}