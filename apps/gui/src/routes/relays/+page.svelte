<script lang="ts">
	import { relayAggregates } from '$lib/stores/checks.js';
	import { doBootstrap } from '$lib/stores/routines';
	import { doAggregateCache } from '$lib/stores/app';
	import { onMount } from 'svelte';
	import { derived, writable, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/nip66';
	import { Nip66Event } from '@nostrwatch/nip66/models';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import type { Formatters } from 'src/lib/config/dataTable/monitors';
	import { type default as DataTableType } from '$lib/components/lists/table/DataTable.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';

	export const prerender = true;

	let Stats: StatsType;
	let DataTable: DataTableType;
	let defaultTableConfig: any;

	type DataTableConfig = { 
		columnsDisable: string[]
        columnsShow: string[]
        filtersDisable: string[]
        filtersShow: string[]
        humanReadableNames: Record<string, string>
        formatters: Formatters
        tableFormatters: Formatters 
        filterFormatters: Formatters
		availableColumnKeys: string[]
        availableFilterKeys: string[]
        tableRowStyler: (row: any) => string
	}
	
	const config: Writable<DataTableConfig | null> = writable(null);
	const ready: Writable<boolean> = writable(false);

	const componentsLoaded: Writable<boolean> = writable(false);

	const loadComponents = async () => {
		const imports = [
			import('$lib/components/layout/Stats.svelte'),
			import('$lib/components/lists/table/DataTable.svelte'),
			import('$lib/config/dataTable/relays.js')
		];

		const results = await Promise.allSettled(imports);
		[ Stats, DataTable, defaultTableConfig ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));
		componentsLoaded.set(true);
	}

	const setConfig = () => {
		const userTableConfig = StateManager.get('preferences:relays:tableConfig');
		if(userTableConfig) {
			config.set({...defaultTableConfig, ...userTableConfig})
		}
		else {
			config.set({...defaultTableConfig})
		}
		ready.set(true)
	}

	const mount = async ( ) => {
		doBootstrap.set(true)
		doAggregateCache.set(true)
		loadComponents().then(setConfig);
	}

	onMount(mount)

    
</script>

<main> 
	{#if $ready}
	<Stats />
	<DataTable data={relayAggregates} {config} tableKey="relays" />
	{/if}
</main>
