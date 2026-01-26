<script lang="ts">
	import { relayCheckAggregates, overrideRelayChecksActiveKeys, relayChecksActiveKeys } from '$lib/stores/checks.js';
	import { onDestroy, onMount } from 'svelte';
	import { derived, get, writable, type Readable, type Unsubscriber, type Writable } from 'svelte/store';
	import { StateManager } from '@nostrwatch/route66';
	import { type default as DataViewType } from '$lib/components/data-view/DataViewRoot.svelte';
	import { type default as StatsType } from '$lib/components/layout/Stats.svelte';
	import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
	import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
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
	import { tabState } from '$lib/stores/app';

  import RelayDimensions from '$routes/relays/relay-dimensions.svelte';
	import DataViewSelector from '$lib/components/data-view/partials/DataViewSelector.svelte';

  	import AutoSuggestRelaysCompact from '$lib/components/partials/AutoSuggestRelaysCompact.svelte';
	import Counts from '$routes/(components)/Counts.svelte';
	// import RelayDataViewShortcut from '$lib/components/shortcuts/RelayDataViewShortcut.svelte';

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
	let activeKeysTimeout: ReturnType<typeof setTimeout> | null = null;
	const configUnsub: Unsubscriber = config.subscribe(($config) => {
		if(!$config) return;

		// Debounce to avoid cascading re-aggregations during init
		if (activeKeysTimeout) clearTimeout(activeKeysTimeout);
		activeKeysTimeout = setTimeout(() => {
			const { columnsShow, filtersShow, dataDependencies } = $config;
			let keys: string[] = []
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
		}, 50);
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
			// Ensure newly-added relay liveness filter exists even for older saved configs.
			conf.filtersShow = Array.isArray(conf.filtersShow)? conf.filtersShow: [];
			if(!conf.filtersShow.includes('liveness')) conf.filtersShow.unshift('liveness');

			conf.filtersActive = (conf.filtersActive && typeof conf.filtersActive === 'object')? conf.filtersActive: {};
			if(!conf.filtersActive?.liveness) conf.filtersActive.liveness = ['online'];

			////console.log('setting config with user config', conf)
			config.set(conf)
		}
		else {
			conf.filtersShow = Array.isArray(conf.filtersShow)? conf.filtersShow: [];
			if(!conf.filtersShow.includes('liveness')) conf.filtersShow.unshift('liveness');

			conf.filtersActive = (conf.filtersActive && typeof conf.filtersActive === 'object')? conf.filtersActive: {};
			if(!conf.filtersActive?.liveness) conf.filtersActive.liveness = ['online'];

			////console.log('setting config without user config', conf)
			config.set(conf)
		}
		ready.set(true)
	}

  	onMount(() => {
        
  });

  $: isHomepage = $page.url.pathname === '/'

	const mount = async ( ) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if(!isHomepage) return;
		loadComponents().then(setConfig);
		const keys = ['sync:cache'];
		if (get(tabState) === 'leader') keys.push('sync:all');
		void $dataRegister
			.require(keys)
			.catch((err) => console.error('[DataRegister] require failed', err));
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

	let onFilterChange: (config: DataTableConfig) => void = (_config) => {}
	let onPresetSave: () => void = () => {}

	let showDataView = true; // Controls opacity transition

	const activeView: Writable<DataViewViews> = writable(enabledViews.length === 1 ? enabledViews[0] : 'table');

	// Reference to the shortcut component to reload presets
	let shortcutComponent: any;

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
</script>


<main class="mt-12"> 
	{#if $ready}

  <!-- <Counts /> -->
	<!-- <div class="flex flex-wrap items-center gap-3 px-3 pt-2">
		<RelayDimensions />
		<RelayDataViewShortcut
			bind:this={shortcutComponent}
			onClick={loadPreset}
			label="Presets"
		/>
		<DataViewSelector {enabledViews} {activeView} />
	</div> -->

	<!-- I need this to fade in and out every time I trigger pseudo transition, without unmounting the component -->
	<div
		style="opacity: {showDataView || $activeView !== 'table' ? 1 : 0}; transition: opacity {TRANSITION_DURATION}ms ease-in-out;"
			>
		<DataView
			bind:onFilterChange
			onPresetSave={() => shortcutComponent?.reloadPresets?.()}
			data={relayCheckAggregates}
			{config}
			key={dataKey}
			{enabledViews}
			{activeView}
			showViewSelector={false}
		/>
	</div>

	<!-- <Stats /> -->
	<!-- <DataTable data={relayCheckAggregates} {config} {dataKey} /> -->
	{/if}
</main>
