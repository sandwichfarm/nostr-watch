<script lang="ts">
	import { relayCheckAggregates, overrideRelayChecksActiveKeys, relayChecksActiveKeys } from '$lib/stores/checks.js';
	import { onDestroy, onMount } from 'svelte';
	import { derived, writable, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/route66';
	import { type default as DataViewType } from '$lib/components/data-view/DataViewRoot.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';
	import type { DataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
	import RelayDimensions from './relay-dimensions.svelte';
	import type { DataViewViews } from '$lib/components/data-view/DataTableTypes';
	import { dataRegister } from '$stores/data-register';

	export const prerender = true;

	const dataKey: string = "relays";
	const enabledViews: DataViewViews[] = ['table','map']

	let Stats: StatsType;
	let DataView: DataViewType;
	
	const config: Writable<DataTableConfig | null> = writable(null);
	const ready: Writable<boolean> = writable(false);

	const componentsLoaded: Writable<boolean> = writable(false);


	/***
	 * This sets active keys override, which optimizes the data view by only aggregating keys 
	 * needed by the table or filters. Huge improvement to performance, reduces clock-time
	 * of aggregate derived by ~85% in default view. The more columns/filters/monitors enabled,
	 * the worse the performance. It can be measured, and hints can be given to user.
	*/
	const availableKeys: Readable<string[]> = config.subscribe(($config) => {
		if(!$config) return;
		const { columnsShow, filtersShow, dataDependencies } = $config;
		let keys = []
		if(columnsShow?.length) {
			keys.push(...columnsShow)
		}
		if(filtersShow?.length) {
			keys.push(...filtersShow)
		}
		keys.forEach((key) => {
			if(dataDependencies?.[key]) {
				keys.unshift(...dataDependencies[key])
			}
		})
		overrideRelayChecksActiveKeys.set( Array.from(new Set(keys)) )
    });

	const loadComponents = async () => {
		const imports = [
			import('$lib/components/layout/Stats.svelte'),
			import('$lib/components/data-view/DataViewRoot.svelte')
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
	const destroy = () => {
		overrideRelayChecksActiveKeys.set([])
	}
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

<!-- <pre class="mt-20">{JSON.stringify($relayChecksActiveKeys, null, 2)}</pre> -->

<main> 
	{#if $ready}
	<RelayDimensions />
	<DataView data={relayCheckAggregates} {config} key={dataKey} {enabledViews} />
	<!-- <Stats /> -->
	<!-- <DataTable data={relayCheckAggregates} {config} {dataKey} /> -->
	{/if}
</main>
