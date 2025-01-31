<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Stats from '$lib/components/layout/Stats.svelte';
    import DataTable from '$lib/components/lists/table/DataTable.svelte';
    import MonitorsActions from '$lib/components/partials/MonitorActions.svelte';
    import * as Alert from "$lib/components/ui/alert/index.js";
    
    import { monitorsSorted, monitorRows, inactiveDisabledMonitorChecksCount } from '$lib/stores/monitors.js';

    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache } from '$lib/stores/app';
    import { writable, type Writable } from 'svelte/store';
	import { type DataTableConfig, defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
    import builtInTableConfig from '$lib/config/dataTable/monitors.js'
	import { bootstrapMonitorData } from '$utils/lifecycle';
	import { dataRegister } from '$stores/data-register';

    const dataKey: string = 'monitors'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);

	const setConfig = () => {
		
		let conf = {...defaultDataTableConfig, ...builtInTableConfig}
		const userTableConfig = StateManager.get(`preferences:${dataKey}:tableConfig`);
		
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			config.set(conf)
		}
		else {
			config.set(conf)
		}
		ready.set(true)
	}

    onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(true)
        doAggregateCache.set(true)
        setConfig();
        await $dataRegister.require([
        	'sync:cache',
        	'sync:monitors',
            'sync:checks',
    	]); 
    });

    $: countInactiveMonitorsEnabled = $monitorRows.filter((monitor: any) => { return !monitor.active && monitor.enabled }).length;
    $: countEnabledMonitors = $monitorRows.filter((monitor: any) => monitor.enabled).length;
    $: criticalHasNoMonitorsEnabled = countEnabledMonitors === 0;
    $: criticalInactiveMonitorsEnabled = countInactiveMonitorsEnabled > 0;
    $: warnHasLessThanRecommendedMonitors = countEnabledMonitors < 3;
    $: warnHasMoreThanRecommendedMonitors = countEnabledMonitors > 8;
</script>
<main class="pt-16">
<!-- <pre>{JSON.stringify($monitorsSorted.map( monitor => monitor), null, 2)}</pre> -->
{#if $ready}
    {#if $monitorsSorted.length}
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
        
            {#if criticalInactiveMonitorsEnabled}
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
            {/if}

        </div>
        <DataTable data={monitorRows} {config} actionsComponent={MonitorsActions} {dataKey} />
    {/if}
{/if}
</main>