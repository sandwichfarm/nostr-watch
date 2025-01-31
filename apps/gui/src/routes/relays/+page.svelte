<script lang="ts">
	import { relayCheckAggregates } from '$lib/stores/checks.js';
	import { onDestroy, onMount } from 'svelte';
	import { derived, writable, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/route66';
	import { type default as DataViewType } from '$lib/components/DataView/DataViewRoot.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';
	import type { DataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
	import RelayDimensions from './relay-dimensions.svelte';
	import type { DataViewViews } from '$lib/components/DataView/DataTableTypes';
	import { dataRegister } from '$stores/data-register';

	export const prerender = true;

	const dataKey: string = "relays";
	const enabledViews: DataViewViews[] = ['table','map']

	let Stats: StatsType;
	let DataView: DataViewType;
	
	const config: Writable<DataTableConfig | null> = writable(null);
	const ready: Writable<boolean> = writable(false);

	const componentsLoaded: Writable<boolean> = writable(false);

	const loadComponents = async () => {
		const imports = [
			import('$lib/components/layout/Stats.svelte'),
			import('$lib/components/DataView/DataViewRoot.svelte')
		];

		const results = await Promise.allSettled(imports);
		[ Stats, DataView ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));
		componentsLoaded.set(true);
	}

	const setConfig = () => {
		let conf = {...defaultDataTableConfig, ...relaysTableConfig}
		const userTableConfig = StateManager.get(`preferences:${dataKey}:tableConfig`);
		
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			////console.log('setting config with user config', conf)
			config.set(conf)
		}
		else {
			////console.log('setting config without user config', conf)
			config.set(conf)
		}
		ready.set(true)
	}

	const mount = async ( ) => {
		loadComponents().then(setConfig);
		await $dataRegister.require([
			'sync:cache',
			'sync:all'
		])
	}
	const destroy = () => {}
	onMount(mount)  
	onDestroy(destroy)  
	const view: Writable<'table' | 'map'> = writable('table');

	// const data = derived(relayCheckAggregates, ($relayCheckAggregates) => {
	// 	return $relayCheckAggregates.map((relayCheckAggregate) => {
	// 		const { relay:id, dd } = relayCheckAggregate;
	// 		if( !dd ) return undefined
	// 		const { lat, lon } = dd;
	// 		if( !lat || !lon ) return undefined
	// 		return { id, lat, lon };
	// 	}).filter( res => res !== undefined );
	// });
</script>

<main> 
	
	
	

	{#if $ready}
	<RelayDimensions />
	<DataView data={relayCheckAggregates} {config} key={dataKey} {enabledViews} />
	<!-- <Stats /> -->
	<!-- <DataTable data={relayCheckAggregates} {config} {dataKey} /> -->
	{/if}
</main>
