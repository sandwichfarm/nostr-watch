<script lang="ts">
	import { readable, type Readable, type Writable } from "svelte/store";
	import type { DataViewMapViews } from "../DataTableTypes";
	import MapBasic from "./MapBasic.svelte";
	import MapHeat from "./MapHeat.svelte";
	import MapViewSelector from "./MapViewSelector.svelte";

    export let data: Readable<any[]> | undefined;
    export let filters: Writable<{}>;

    let activeView: Writable<DataViewMapViews>;

</script>

<MapViewSelector enabledViews={['bubble', 'heatmap']} bind:activeView />

{#if data}

    {#if $activeView === 'bubble'}
        <MapBasic {data} />
    {/if}

    {#if $activeView === 'heatmap'}
        <MapHeat {data} {filters} />
    {/if}

{/if}