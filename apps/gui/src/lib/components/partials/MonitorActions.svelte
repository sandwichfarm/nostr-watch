<script lang="ts">
    import { writable } from 'svelte/store';
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import * as Table from '$lib/components/ui/table/index.js'

    import { monitorsMap } from "$lib/stores/monitors.js";
    import type { IEvent, Monitor } from '@nostrwatch/route66/models';
    import { events, eventsArray } from '$lib/stores/events.js';

    import { route66 } from '$lib/stores';
    import type Route66 from '@nostrwatch/route66';
	import { onMount } from 'svelte';
	import { eventKey } from '$lib/utils/event-keys';
	import { activeMonitorChecksCount } from '$lib/stores';
	import { pauseLiveSync } from '$lib/utils/lifecycle';

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
            const { publishEventsToMemoryRelay } = await import('$lib/stores/events-helpers.js');
            const resumer = await pauseLiveSync();
            disabled.set(true);
            if(monitor?.enabled) {
                monitor.disable();
                ([...$eventsArray] as IEvent[]).filter( event => event.pubkey === monitor.pubkey).forEach( event => {
                    const key = eventKey(event);
                    $events.delete(key)
                });
                events.set($events);
                disabled.set(false);
                await resumer();
                
            } 
            else {
                monitor.enable()
                const options = {
                    filters: [ monitor.checkFilter ],
                    options: {
                        stream: true,
                        returnResults: true,
                        cache: true,
                        sync: true,
                        batch: 25
                    },
                    relays: [ ...($route66?.services?.monitors?.nip66Relays || []), ...monitor.relays ],
                    priority: 20
                }
                const onevents = (events: IEvent[]) => {
                    publishEventsToMemoryRelay(events)
                }
                await $route66?.services?.monitors?.sync(options, { onevents })
                disabled.set(false);
                await resumer();

            }
            $route66?.services?.monitors?.manager?.updateMonitor?.(monitor)
            
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