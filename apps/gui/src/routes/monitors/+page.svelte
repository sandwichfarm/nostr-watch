<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Stats from '$lib/components/layout/Stats.svelte';
    import DataTable from '$lib/components/lists/table/DataTable.svelte';
    import MonitorsActions from '$lib/components/partials/MonitorActions.svelte';
    import * as Alert from "$lib/components/ui/alert/index.js";
    
    import { monitorRows, monitorsSorted } from '$lib/stores/monitors.js';

    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache, tabState } from '$lib/stores/app';
    import { get, writable, type Writable } from 'svelte/store';
	import type { DataViewViews } from '$lib/components/data-view/DataTableTypes';
	import { type DataTableConfig, defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
    import builtInTableConfig from '$lib/config/dataTable/monitors.js'
	import { bootstrapMonitorData } from '$utils/lifecycle';
	import { dataRegister } from '$stores/data-register';
	import DataViewRoot from '$lib/components/data-view/DataViewRoot.svelte';
	import { HeaderConfigStore } from '$stores/header-config';

    const dataKey: string = 'monitors'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);

	const enabledViews: DataViewViews[] = ['table'];
	const activeView: Writable<DataViewViews> = writable(enabledViews.length === 1 ? enabledViews[0] : 'table');

	const HEADER_SELECTORS_ID = 'monitors:list';

	const setHeaderSelectors = () => {
		HeaderConfigStore.set({
			selectors: {
				id: HEADER_SELECTORS_ID,
				className: 'ml-2',
				showPresets: false,
				showView: true,
				enabledViews,
				activeView,
			},
		});
	};

	const clearHeaderSelectors = () => {
		HeaderConfigStore.update((current) => {
			if (current.selectors?.id !== HEADER_SELECTORS_ID) return current;
			return { ...current, selectors: null };
		});
	};

	const setConfig = () => {
		
		let conf = {...defaultDataTableConfig, ...builtInTableConfig}
		const userTableConfig = StateManager.get(`preferences:${dataKey}:tableConfig`);
		
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			// Keep newly-added columns visible even when a user has an older saved table config.
			const ensureColumns = ['reportingOffline', 'likelyDead']
			conf.columnsShow = Array.isArray(conf.columnsShow)? conf.columnsShow: []
			for(const col of ensureColumns){
				if(!conf.columnsShow.includes(col)) conf.columnsShow.push(col)
			}
			config.set(conf)
		}
		else {
			config.set(conf)
		}
		ready.set(true)
	}

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
		setHeaderSelectors();
        doBootstrap.set(true)
        doAggregateCache.set(true)
        setConfig();
        const keys = ['sync:cache'];
        if (get(tabState) === 'leader') {
            keys.push('sync:monitors', 'sync:checks');
        }
        void $dataRegister
            .require(keys)
            .catch((err) => console.error('[DataRegister] require failed', err));
    });

	onDestroy(() => {
		clearHeaderSelectors();
	});

    $: countInactiveMonitorsEnabled = $monitorRows.filter((monitor: any) => { return !monitor.active && monitor.enabled }).length;
    $: countEnabledMonitors = $monitorRows.filter((monitor: any) => monitor.enabled).length;
    $: criticalHasNoMonitorsEnabled = countEnabledMonitors === 0;
    $: criticalInactiveMonitorsEnabled = countInactiveMonitorsEnabled > 0;
    $: warnHasLessThanRecommendedMonitors = countEnabledMonitors < 3;
    $: warnHasMoreThanRecommendedMonitors = countEnabledMonitors > 8;
</script>
<main class="mt-10">
<!-- {$ready? 'true': 'false'}
<pre>{countEnabledMonitors}</pre>
<pre>{JSON.stringify($monitorRows, null, 2)}</pre>
<pre>{JSON.stringify($monitorsSorted, null, 2)}</pre> -->
<!-- <pre>{JSON.stringify($monitorsSorted.map( monitor => monitor), null, 2)}</pre> -->
{#if $ready}
    {#if $monitorRows.length}
        <div class="px-10">
            {#if criticalHasNoMonitorsEnabled}
                <Alert.Root class="mb-2">
                    <Alert.Title class="text-red-500 font-bold">Critical</Alert.Title>
                    <Alert.Description class="opacity-80">
                        You have no monitors enabled, which will prevent the application from functioning correctly.
                    </Alert.Description>
                </Alert.Root>
            {:else if warnHasLessThanRecommendedMonitors}
                <Alert.Root class="mb-2">
                    <Alert.Title class="text-orange-500 font-bold">Warning</Alert.Title>
                    <Alert.Description class="opacity-80">
                        You have less than 3 monitors enabled, this could affect the completedness of your results.
                    </Alert.Description>
                </Alert.Root>
            {/if}
        
            <!-- {#if criticalInactiveMonitorsEnabled}
                <Alert.Root class="mb-2">
                    <Alert.Title class="text-orange-500 font-bold" >Warning</Alert.Title>
                    <Alert.Description class="opacity-80">
                        You have a {countInactiveMonitorsEnabled} inactive monitor{countInactiveMonitorsEnabled>1? 's': ''} enabled.
                    </Alert.Description>
                </Alert.Root>
            {/if}

            {#if warnHasMoreThanRecommendedMonitors}
                <Alert.Root class="mb-2">
                    <Alert.Title class="text-orange-500 font-bold">Warning</Alert.Title>
                    <Alert.Description class="opacity-80">
                        You have more than 8 monitors enabled, this might cause performance issues and consume extraneous bandwidth.
                    </Alert.Description>
                </Alert.Root>
            {/if} -->

        </div>
        <!-- <DataTable data={monitorRows} {config} actionsComponent={MonitorsActions} {dataKey} /> -->
         <DataViewRoot
            {config}
            data={monitorRows}
            key={dataKey}
			{enabledViews}
			{activeView}
			showViewSelector={false}
            actionsComponent={MonitorsActions}
        />
    {/if}
{/if}
</main>
