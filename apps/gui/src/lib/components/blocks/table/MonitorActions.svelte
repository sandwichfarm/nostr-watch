<script lang="ts">
    import { monitorsMap } from "$lib/stores/monitors.js";
    import * as Table from '$lib/components/ui/table/index.js'
    import type { Monitor } from '@nostrwatch/nip66/models';
	import { ExitFullScreen } from "svelte-radix";
    export let data: any;
    export let view: 'head' | 'cell' = 'cell';
    let monitor: Monitor;
    

    if(view === 'cell') {
        if(data?.pubkey) {
            monitorsMap.subscribe((map) => monitor = map.get(data?.pubkey));
        }
    }
    
    const toggleEnableMonitor = () => {
        console.log('toggling', data.pubkey);
        monitor?.enabled? monitor.disable() : monitor.enable()
    }

    $: checked = monitor?.enabled
</script>

{#if view === 'cell'}
    <Table.Cell>
        <input type="checkbox" {checked} on:change={toggleEnableMonitor} />
        {checked ? 'enabled' : 'disabled'}
    </Table.Cell>
{:else}
    <Table.Head>
        Enable
    </Table.Head>
{/if}