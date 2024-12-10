<script lang="ts">
    import { writable } from 'svelte/store';
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import * as Table from '$lib/components/ui/table/index.js'

    import { monitorsMap } from "$lib/stores/monitors.js";
    import type { IEvent, Monitor } from '@nostrwatch/nip66/models';
    import { events, eventsArray } from '$lib/stores/events.js';

    import { nip66 } from '$lib/stores';
    import type Nip66 from '@nostrwatch/nip66';
	import { onMount } from 'svelte';
	import { eventKey } from '$lib/utils/event-keys';
	import { activeMonitorChecksCount } from '$lib/stores';

    export let data: any;
    export let view: 'head' | 'cell' = 'cell';
    let monitor: Monitor;
    
    const disabled = writable(false);

    if(view === 'cell') {
        if(data?.pubkey) {
            monitorsMap.subscribe((map) => monitor = map.get(data?.pubkey));
        }
    }

    let toggleEnableMonitor: () => void; 

    onMount(() => {
        toggleEnableMonitor = async () => {
            const { addEventsToStore } = await import('$lib/stores/events-helpers.js');
            disabled.set(true);
            if(monitor?.enabled) {
                monitor.disable();
                ([...$eventsArray] as IEvent[]).filter( event => event.pubkey === monitor.pubkey).forEach( event => {
                    const key = eventKey(event);
                    $events.delete(key)
                });
                events.set($events);
            } 
            else {
                monitor.enable()
                addEventsToStore(await $nip66?.services?.monitors?.fetchMonitorChecksFromCache(monitor.pubkey) || []);
                await $nip66?.services.monitors?.countMonitorChecksFromCache(monitor.pubkey).then( (count: number) => {
                    activeMonitorChecksCount.update((value: Record<string, number>) => {
                        return {
                            ...value,
                            [monitor.pubkey]: count
                        }
                    })
                })

            }
            disabled.set(false);
        }
    })

    $: checked = monitor?.enabled
</script>

{#if view === 'cell'}
    <Table.Cell>
        {#if monitor?.pubkey}
        <Checkbox disabled={$disabled} id="toggle-${monitor.pubkey.slice(0,21)}" bind:checked aria-labelledby="terms-label" onCheckedChange={toggleEnableMonitor} />
        {/if}
    </Table.Cell>
{:else}
    <Table.Head>
        Enable
    </Table.Head>
{/if}