<script lang="ts">
	import { relayCheckAggregates, overrideRelayChecksActiveKeys, relayChecksActiveKeys } from '$lib/stores/checks.js';
	import { onDestroy, onMount } from 'svelte';
	import { derived, get, writable, type Readable, type Unsubscriber, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/route66';
	import { type default as DataViewType } from '$lib/components/data-view/DataViewRoot.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';
	import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
	import RelayDimensions from './relay-dimensions.svelte';
	import type { DataTableConfig, DataViewViews } from '$lib/components/data-view/DataTableTypes';
	import { dataRegister } from '$stores/data-register';
	import RelayDataViewShortcut from '$lib/components/shortcuts/RelayDataViewShortcut.svelte';
	import { deterministicHash } from '@nostrwatch/route66/utils';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { linkableState } from '$utils/linkable-state';
	import { decompress } from 'compress-json';
	import { replace } from 'lodash';
	import { ConfigDefaults } from '@nostrwatch/nocap';
	import { DataTable } from '$lib/components/@Careswitch/svelte-data-table';
	import { delay } from '@nostrwatch/utils';
	import { fade } from 'svelte/transition';

	const TRANSITION_DURATION = 100;

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
	const configUnsub: Unsubscriber = config.subscribe(($config) => {
		if(!$config) return;
		const oldKeys = [...get(overrideRelayChecksActiveKeys)]
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
	})
		

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
		configUnsub()
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

	let onFilterChange: (config: DataTableConfig) => void = (config) => { console.log('function was not bound') }

	let showDataView = true; // Controls opacity transition

	const loadPreset = (path: string) => { 
			const hash = path.split('#')?.[1]
			if(!hash) return;
			replaceState(`#${hash}`, $page.state)
			const linkableData = decompress(JSON.parse(atob(hash))) as Partial<DataTableConfig>
			replaceState(``, $page.state)

			showDataView = false;
			delay(TRANSITION_DURATION).then(() => {
				config.update( (currentConfig: DataTableConfig) => {
					return { ...currentConfig, ...linkableData }
				}) 
				delay(1).then(() => {
					if(!$config) return;
					onFilterChange($config)
				})
				delay(TRANSITION_DURATION).then(() => {
					showDataView = true;
					delay(1).then(() => {
						if(!$config) return;
						onFilterChange($config)
					})
				})
			})
			//trigger a pseudo transition 
		}

		let activeView: Writable<'table' | 'map' | 'grid'>;

</script>

<!-- <pre class="mt-20">{JSON.stringify($shapeshift, null, 2)}</pre> -->

<main class="mt-20"> 
	{#if $ready}
	
	<RelayDimensions />
	<RelayDataViewShortcut 
		class="ml-3 my-4 opacity-70" 
		buttonClass=" py-1 px-2 mr-2 text-sm bg-transparent hover:bg-white/20"
		buttonActiveClass="bg-white/20"
		buttonVariant="secondary" 
		buttonSize="sm" 
		onClick={loadPreset}
		label="Filter Presets"
		/>
	<!-- I need this to fade in and out every time I trigger pseudo transition, without unmounting the component -->
	<div
		style="opacity: {showDataView || $activeView !== 'table' ? 1 : 0}; transition: opacity {TRANSITION_DURATION}ms ease-in-out;"
			>
		<DataView 
			bind:onFilterChange
			data={relayCheckAggregates} 
			{config} 
			key={dataKey} 
			{enabledViews} 
			bind:activeView
			/>
	</div>
	<!-- <Stats /> -->
	<!-- <DataTable data={relayCheckAggregates} {config} {dataKey} /> -->
	{/if}
</main>
