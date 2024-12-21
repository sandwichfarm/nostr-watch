<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Stats from '$lib/components/layout/Stats.svelte';
    import DataTable from '$lib/components/lists/table/DataTable.svelte';
    import MonitorsActions from '$lib/components/partials/MonitorActions.svelte';
    import * as Alert from "$lib/components/ui/alert/index.js";
    import { type Monitor } from "@nostrwatch/nip66/models"
    
    import { monitorsSorted, monitorRows, inactiveDisabledMonitorChecksCount } from '$lib/stores/monitors.js';

    import defaultTableConfig from '$lib/config/dataTable/monitors.js';
    import { StateManager } from '@nostrwatch/nip66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache } from '$lib/stores/app';
    import { writable, type Writable } from 'svelte/store';
    import type { Formatters } from '$lib/config/dataTable/monitors';
    import { nip66 } from '$lib/stores';
	import { nip66Ready } from '$lib/stores/app';

    type DataTableConfig = { 
        columnsDisable: string[]
        columnsShow: string[]
        filtersDisable: string[]
        filtersShow: string[]
        humanReadableNames: Record<string, string>
        formatters: Formatters
        tableFormatters: Formatters 
        filterFormatters: Formatters
        tableRowStyler: (row: any) => string
    }

    let val: string='';
    let countIntVal: ReturnType<typeof setInterval>;

    const tableKey: string = 'monitors'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);
    

    StateManager.on('monitor:update:lastActive', (value: any) => { console.log('monitor:lastActive', value) })

    const setConfig = () => {
        console.log('set config.')
        const userTableConfig = StateManager.get(`preferences:${tableKey}:tableConfig`);
        if(userTableConfig) {
            config.set({...defaultTableConfig, ...userTableConfig})
        }
        else {
            config.set({...defaultTableConfig})
        }
        ready.set(true)
    }

    onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(true)
        doAggregateCache.set(true)
        setConfig();
        // nip66Ready().then( () => $nip66.services.monitors.ensureMonitorsActive()  )
    });

    onDestroy(() => {
        clearInterval(countIntVal);
    });

    $: countInactiveMonitorsEnabled = $monitorRows.filter((monitor: any) => { return !monitor.active && monitor.enabled }).length;
    $: countEnabledMonitors = $monitorRows.filter((monitor: any) => monitor.enabled).length;
    $: criticalHasNoMonitorsEnabled = countEnabledMonitors === 0;
    $: criticalInactiveMonitorsEnabled = countInactiveMonitorsEnabled > 0;
    $: warnHasLessThanRecommendedMonitors = countEnabledMonitors < 3;
    $: warnHasMoreThanRecommendedMonitors = countEnabledMonitors > 8;
</script>
{#if $ready}
<!-- <main class="mt-20 pt-10"> -->
    {#if $monitorsSorted.length}
        {#if criticalHasNoMonitorsEnabled}
            <Alert.Root class="mb-2">
                <Alert.Title>Critical</Alert.Title>
                <Alert.Description>
                    You have no monitors enabled, which will prevent the application from functioning correctly.
                </Alert.Description>
            </Alert.Root>
        {:else if warnHasLessThanRecommendedMonitors}
            <Alert.Root class="mb-2">
                <Alert.Title>Warning</Alert.Title>
                <Alert.Description>
                    You have less than 3 monitors enabled, this could affect the completedness of your results.
                </Alert.Description>
            </Alert.Root>
        {/if}
    
        {#if criticalInactiveMonitorsEnabled}
            <Alert.Root class="mb-2">
                <Alert.Title>Warning</Alert.Title>
                <Alert.Description>
                    You have a {countInactiveMonitorsEnabled} inactive monitor{countInactiveMonitorsEnabled>1? 's': ''} enabled.
                </Alert.Description>
            </Alert.Root>
        {/if}

        {#if warnHasMoreThanRecommendedMonitors}
            <Alert.Root class="mb-2">
                <Alert.Title>Warning</Alert.Title>
                <Alert.Description>
                    You have more than 8 monitors enabled, this might cause performance issues and consume extraneous bandwidth.
                </Alert.Description>
            </Alert.Root>
        {/if}

        <DataTable data={monitorRows} {config} actionsComponent={MonitorsActions} {tableKey} />
        <!-- <ul>
        {#each $monitors as monitor (monitor?.registration?.pubkey)}
            {#if monitor?.lastActive && monitor.lastActive > 0}
            <li>
                <MonitorDataRow {monitor} />
            </li>
            {/if}
        
        {/each}
    </ul> -->

    {/if}
<!-- </main> -->

<Stats />

{/if}