<script lang="ts">
	import { relayAggregates } from '$lib/stores/checks.js';
	import { doBootstrap } from '$lib/stores/routines';
	import { doAggregateCache } from '$lib/stores/app';
	import { onDestroy, onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/nip66';
	import { type default as DataTableType } from '$lib/components/lists/table/DataTable.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';
	import type { DataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
	import { userService } from '$lib/stores/user';

	export const prerender = true;

	const tableKey: string = "relays";

	let Stats: StatsType;
	let DataTable: DataTableType;
	
	const config: Writable<DataTableConfig | null> = writable(null);
	const ready: Writable<boolean> = writable(false);

	const componentsLoaded: Writable<boolean> = writable(false);

	const loadComponents = async () => {
		const imports = [
			import('$lib/components/layout/Stats.svelte'),
			import('$lib/components/lists/table/DataTable.svelte')
		];

		const results = await Promise.allSettled(imports);
		[ Stats, DataTable ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));
		componentsLoaded.set(true);
	}

	const setConfig = () => {
		
		let conf = {...defaultDataTableConfig, ...relaysTableConfig}
		const userTableConfig = StateManager.get(`preferences:${tableKey}:tableConfig`);
		
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			console.log('setting config with user config', conf)
			config.set(conf)
		}
		else {
			console.log('setting config without user config', conf)
			config.set(conf)
		}
		ready.set(true)
	}

	const mount = async ( ) => {
		doBootstrap.set(true)
		doAggregateCache.set(true)
		loadComponents().then(setConfig);
	}
	const destroy = () => {}
	onMount(mount)  
	onDestroy(destroy)  
</script>

<main> 
	{#if $ready}
	<Stats />
	<DataTable data={relayAggregates} {config} {tableKey} />
	{/if}
</main>
