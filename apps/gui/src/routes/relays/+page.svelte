<script lang="ts">
	import { relayAggregates } from '$lib/stores/checks.js';
	import { doBootstrap } from '$lib/stores/routines';
	import { doAggregateCache } from '$lib/stores/app';
	import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	export const prerender = true;

	let Stats 
	let DataTable
	let tableConfig

	const componentsLoaded: Writable<boolean> = writable(false);

	const loadComponents = async () => {
		const imports = [
			import('$lib/components/blocks/Stats.svelte'),
			import('$lib/components/blocks/table/DataTable.svelte'),
			import('$lib/config/dataTable/relays.js')
		];

		const results = await Promise.allSettled(imports);
		[ Stats, DataTable, tableConfig ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));
		componentsLoaded.set(true);
	}

	const mount = async ( ) => {
		doBootstrap.set(true)
		doAggregateCache.set(true)
		loadComponents()
	}

	onMount(mount)
</script>

<main>
	{#if $componentsLoaded}
	<Stats />
	<DataTable data={relayAggregates} config={tableConfig} />
	{/if}
</main>
