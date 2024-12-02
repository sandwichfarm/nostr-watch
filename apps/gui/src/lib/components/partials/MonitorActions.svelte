<script lang="ts">
    import { ExitFullScreen } from "svelte-radix";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import * as Table from '$lib/components/ui/table/index.js'

    import { monitorsMap } from "$lib/stores/monitors.js";
    import type { Monitor } from '@nostrwatch/nip66/models';

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
        <Checkbox id="toggle-${monitor.pubkey.slice(0,21)}" bind:checked aria-labelledby="terms-label" onCheckedChange={toggleEnableMonitor} />
    </Table.Cell>
{:else}
    <Table.Head>
        Enable
    </Table.Head>
{/if}