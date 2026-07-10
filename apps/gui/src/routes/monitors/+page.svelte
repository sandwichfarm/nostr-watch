<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import MonitorsActions from '$lib/components/partials/MonitorActions.svelte';
    import * as Alert from "$lib/components/ui/alert/index.js";
    
    import { livenessReady, monitorRows, monitorSelectionLocked, monitors } from '$lib/stores/monitors.js';

    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache, tabState } from '$lib/stores/app';
    import { get, writable, type Writable } from 'svelte/store';
	import type { DataViewViews } from '$lib/components/data-view/DataTableTypes';
	import { type DataTableConfig, defaultDataTableConfig } from '$lib/components/data-view/DataTableTypes';
    import builtInTableConfig from '$lib/config/dataTable/monitors.js'
	import { dataRegister } from '$stores/data-register';
	import DataViewRoot from '$lib/components/data-view/DataViewRoot.svelte';
	import { HeaderConfigStore } from '$stores/header-config';

    const dataKey: string = 'monitors'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);
    const pageDataReady: Writable<boolean> = writable(false);
    const pageDataError: Writable<Error | null> = writable(null);

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
        pageDataReady.set(false);
        pageDataError.set(null);
        monitorSelectionLocked.set(true);
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
            .then(() => pageDataReady.set(true))
            .catch((err) => {
                pageDataError.set(err instanceof Error ? err : new Error(String(err)));
                console.error('[DataRegister] require failed', err);
            });
    });

	onDestroy(() => {
		clearHeaderSelectors();
        monitorSelectionLocked.set(true);
	});

    $: countInactiveMonitorsEnabled = $monitorRows.filter((monitor: any) => { return !monitor.active && monitor.enabled }).length;
    $: countEnabledMonitors = $monitorRows.filter((monitor: any) => monitor.enabled).length;
    $: criticalHasNoMonitorsEnabled = countEnabledMonitors === 0;
    $: criticalInactiveMonitorsEnabled = countInactiveMonitorsEnabled > 0;
    $: warnHasLessThanRecommendedMonitors = countEnabledMonitors < 3;
    $: warnHasMoreThanRecommendedMonitors = countEnabledMonitors > 8;
    $: hasRealLivenessData = $monitorRows.some((monitor: any) =>
        [monitor.reportingOnline, monitor.reportingOffline, monitor.likelyDead].some((value) => typeof value === 'number' && value > 0)
    );
    $: monitorPageHydrated =
        $ready &&
        $pageDataReady &&
        !$pageDataError &&
        $livenessReady &&
        $monitorRows.length > 0 &&
        hasRealLivenessData;
    $: monitorSelectionLocked.set(!monitorPageHydrated);
    $: showMonitorWarnings = monitorPageHydrated;
</script>
<main class="mt-10">
{#if $ready}
    {#if $monitorRows.length}
        <div class="px-10">
            {#if showMonitorWarnings && criticalHasNoMonitorsEnabled}
                <Alert.Root class="mb-2">
                    <Alert.Title class="text-red-500 font-bold">Critical</Alert.Title>
                    <Alert.Description class="opacity-80">
                        You have no monitors enabled, which will prevent the application from functioning correctly.
                    </Alert.Description>
                </Alert.Root>
            {:else if showMonitorWarnings && warnHasLessThanRecommendedMonitors}
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
    {:else if $pageDataReady && $livenessReady && !$monitors.length}
        <div class="px-10 mt-20 text-center">
            <p class="text-gray-500 text-lg">No monitors found</p>
        </div>
    {/if}
{/if}
</main>

<style>
  :global(.liveness-pending) {
    transition: color 500ms ease, opacity 500ms ease;
  }
  :global(.liveness-fresh) {
    transition: color 500ms ease;
    animation: none;
  }
</style>
