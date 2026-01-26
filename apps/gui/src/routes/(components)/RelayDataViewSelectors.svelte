<script lang="ts">
	import type { Writable } from "svelte/store";
	import type { DataViewViews } from "$lib/components/data-view/DataTableTypes";
	import DataViewSelector from "$lib/components/data-view/partials/DataViewSelector.svelte";
	import RelayDataViewShortcut from "$lib/components/shortcuts/RelayDataViewShortcut.svelte";
	import RelayDimensions from "$routes/relays/relay-dimensions.svelte";
	import { cn } from "$lib/utils/ui.js";

	export let showDimension: boolean = false;
	export let showPresets: boolean = false;
	export let showView: boolean = false;

	export let enabledViews: DataViewViews[] | undefined = undefined;
	export let activeView: Writable<DataViewViews> | undefined = undefined;

	export let onPresetSelect: ((path: string) => void) | undefined = undefined;
	export let presetLabel: string = "Presets";

	let className: string | undefined = undefined;
	export { className as class };
</script>

<!-- NOTE: Avoid `overflow-x-auto` here; it clips absolutely-positioned dropdown panels. -->
<div class={cn("flex flex-nowrap items-center gap-3 px-3 overflow-visible", className)}>
	{#if showDimension}
		<RelayDimensions />
	{/if}
	{#if showPresets}
		<RelayDataViewShortcut onClick={onPresetSelect ?? (() => {})} label={presetLabel} />
	{/if}
	{#if showView && activeView}
		<DataViewSelector {enabledViews} {activeView} />
	{/if}
</div>
