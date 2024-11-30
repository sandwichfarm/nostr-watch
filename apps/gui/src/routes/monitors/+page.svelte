<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
    import Stats from '$lib/components/blocks/Stats.svelte';
    import DataTable from '$lib/components/blocks/table/DataTable.svelte';
	
    import { monitors, monitorRows } from '$lib/stores/monitors.js';
	export const prerender = true;

    import config from '$lib/components/blocks/table/monitors-config.js';

	let val: string='';

	onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    });
</script>
<!-- <main class="mt-20 pt-10"> -->
    {#if $monitors.length}
        <DataTable data={monitorRows} {config} />
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