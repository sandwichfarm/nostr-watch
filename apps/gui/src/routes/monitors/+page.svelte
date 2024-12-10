<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
    import Stats from '$lib/components/blocks/Stats.svelte';
    import DataTable from '$lib/components/blocks/table/DataTable.svelte';
    import MonitorsActions from '$lib/components/partials/MonitorActions.svelte';
    import * as Alert from "$lib/components/ui/alert/index.js";
    import { type Monitor } from "@nostrwatch/nip66/models"
	
    import { monitorsSorted, monitorRows, inactiveDisabledMonitorChecksCount } from '$lib/stores/monitors.js';

    import config from '$lib/config/dataTable/monitors.js';
	import { StateManager } from '@nostrwatch/nip66';
	import { nip05s, validNip05s } from '$lib/stores/nip05s.js';
	import { nip66 } from '$lib/stores';
    import type { Filter } from 'nostr-tools'
	import { activeMonitorChecksCount } from '$lib/stores';

	let val: string='';

    StateManager.on('monitor:update:lastActive', (value: any) => { console.log('monitor:lastActive', value) })

	onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        const activeMonitors = $nip66?.services?.monitors?.activeMonitors
        if(activeMonitors?.length){
            console.log('activeMonitors', activeMonitors)   
            activeMonitors.forEach(async (monitor: Monitor) => {
                console.log('activeMonitors monitor', monitor)
                const count = await $nip66?.services.monitors?.countMonitorChecksFromCache(monitor.pubkey)
                activeMonitorChecksCount.update((value: Record<string, number>) => {
                    console.log('activeMonitors monitor value', value)
                    return {
                        ...value,
                        [monitor.pubkey]: count
                    }
                })
            })
        }
    });

    $: countInactiveMonitorsEnabled = $monitorRows.filter((monitor: any) => { return !monitor.active && monitor.enabled }).length;
    $: countEnabledMonitors = $monitorRows.filter((monitor: any) => monitor.enabled).length;
    $: criticalHasNoMonitorsEnabled = countEnabledMonitors === 0;
    $: criticalInactiveMonitorsEnabled = countInactiveMonitorsEnabled > 0;
    $: warnHasLessThanRecommendedMonitors = countEnabledMonitors < 3;
    $: warnHasMoreThanRecommendedMonitors = countEnabledMonitors > 8;
</script>
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

        <DataTable data={monitorRows} {config} actionsComponent={MonitorsActions} />
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