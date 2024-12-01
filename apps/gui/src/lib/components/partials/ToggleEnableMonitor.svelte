<script lang="ts">
    import { monitorsMap } from "$lib/stores/monitors.js";
    export let monitor: any;

    console.log('togglenablemonitor', monitor);

    const toggleEnableMonitor = () => {
        console.log('toggling', monitor.registration.pubkey);
        monitorsMap.update((map) => {
            console.log('toggling', monitor.registration.pubkey);
            const mon = map.get(monitor.registration.pubkey)
            mon.enabled = !mon.enabled;
            map.set(monitor.registration.pubkey, mon);
        });
    }
</script>

{#if monitor}
    <input type="checkbox" on:change={toggleEnableMonitor} />
    {monitor.enabled ? 'enabled' : 'disabled'}
{/if}
