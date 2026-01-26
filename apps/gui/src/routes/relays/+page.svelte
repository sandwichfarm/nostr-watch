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
	import { deterministicHash } from '@nostrwatch/route66/utils';
	import { decompress } from 'compress-json';
	import { replace } from 'lodash';
	import { ConfigDefaults } from '@nostrwatch/nocap';
	import { DataTable } from '$lib/components/@Careswitch/svelte-data-table';
	import { delay } from '@nostrwatch/utils';
	import { fade } from 'svelte/transition';
	import { tabState } from '$lib/stores/app';
	import { HeaderConfigStore } from '$stores/header-config';

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
			setHeaderSelectors('full');
		}

		const mount = async ( ) => {
			setHeaderSelectors('dimension');
			loadComponents().then(setConfig);
			const keys = ['sync:cache'];
			if (get(tabState) === 'leader') keys.push('sync:all');
			void $dataRegister
			.require(keys)
			.catch((err) => console.error('[DataRegister] require failed', err));
	}

		const destroy = () => {
			overrideRelayChecksActiveKeys.set([])
			clearHeaderSelectors();
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

	const HEADER_SELECTORS_ID = 'relays:list';

	const setHeaderSelectors = (mode: 'dimension' | 'full' = 'full') => {
		HeaderConfigStore.set({
			selectors: {
				id: HEADER_SELECTORS_ID,
				className: 'ml-2',
				showDimension: true,
				showPresets: mode === 'full',
				showView: mode === 'full',
				enabledViews,
				activeView,
				onPresetSelect: loadPreset,
			},
		});
	};

	const clearHeaderSelectors = () => {
		HeaderConfigStore.update((current) => {
			if (current.selectors?.id !== HEADER_SELECTORS_ID) return current;
			return { ...current, selectors: null };
		});
	};

	const loadPreset = (path: string) => { 
			const hash = path.split('#')?.[1]
			if(!hash) return;
			let linkableData: Partial<DataTableConfig> | null = null;
			try {
				linkableData = decompress(JSON.parse(atob(hash))) as Partial<DataTableConfig>;
			} catch {
				return;
			}

			showDataView = false;
			delay(TRANSITION_DURATION).then(() => {
				config.update((currentConfig: DataTableConfig | null) => {
					if (!currentConfig || !linkableData) return currentConfig;
					const merged = { ...currentConfig, ...linkableData } as DataTableConfig;
					const filtersActive =
						merged.filtersActive && typeof merged.filtersActive === 'object' ? merged.filtersActive : {};
					const filtersShow = Array.isArray(merged.filtersShow) ? [...merged.filtersShow] : [];
					for (const key of Object.keys(filtersActive)) {
						if (!filtersShow.includes(key)) filtersShow.push(key);
					}
					return { ...merged, filtersShow };
				});
				delay(TRANSITION_DURATION).then(() => {
					showDataView = true;
				})
			})
			//trigger a pseudo transition 
		}

</script>


<main class="mt-12"> 
	{#if $ready}
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
			{activeView}
			showViewSelector={false}
		/>
	</div>

	<!-- <Stats /> -->
	<!-- <DataTable data={relayCheckAggregates} {config} {dataKey} /> -->
	{/if}
</main>
