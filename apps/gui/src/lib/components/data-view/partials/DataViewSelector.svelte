<script lang="ts">
	import { writable, type Writable } from "svelte/store";
	import type { DataViewViews } from "../DataTableTypes";
	import DropdownSelect, { type DropdownSelectOption } from "$lib/components/partials/DropdownSelect.svelte";
	import { cn } from "$lib/utils/ui.js";

	export let enabledViews: DataViewViews[] | undefined = ["table"];
	export let activeView: Writable<DataViewViews> = writable(
		enabledViews?.length === 1 ? enabledViews[0] : "table"
	);

	const viewLabels: Record<DataViewViews, string> = {
		table: "Table",
		grid: "Grid",
		map: "Map",
	};

	$: viewOptions = (enabledViews || []).map((view) => {
		return {
			value: view,
			label: viewLabels[view] ?? view,
		} satisfies DropdownSelectOption<DataViewViews>;
	});

	let className: string | undefined = undefined;
	export { className as class };
</script>

{#if enabledViews && enabledViews.length > 1}
	<DropdownSelect
		class={cn(className)}
		label="View"
		value={$activeView}
		options={viewOptions}
		on:change={(e) => {
			const next = e.detail.value as DataViewViews | null;
			if (!next) return;
			activeView.set(next);
		}}
	/>
{/if}
