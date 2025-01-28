<script lang="ts">
	import { readable, type Readable, type Writable } from "svelte/store";
	import type { DataViewMapViews } from "../DataTableTypes";
	import MapBasic from "./MapBasic.svelte";
	import MapHeat from "./MapHeat.svelte";
	import MapViewSelector from "./MapViewSelector.svelte";

    export let data: Readable<any[]> | undefined;

    let activeView: Writable<DataViewMapViews>;

</script>

<MapViewSelector enabledViews={['bubble', 'markers', 'heatmap', 'choropleth']} bind:activeView />

{#if data}

    {#if $activeView === 'bubble'}
        <MapBasic {data} />
    {/if}

    {#if $activeView === 'heatmap'}
        <MapHeat {data} />
    {/if}

{/if}