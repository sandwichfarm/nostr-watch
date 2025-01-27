<script lang="ts">
    import { derived, writable, type Readable, type Writable } from 'svelte/store';
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
    let monitor: Readable<Monitor | undefined> = derived(monitorsMap, (map) => map.get(data?.pubkey));
    
    const disabled = writable(false);

    // if(view === 'cell') {

    // }

    let toggleEnableMonitor: () => void; 

    onMount(() => {
        toggleEnableMonitor = async () => {
            disabled.set(true);
            const { publishEventsToMemoryRelay } = await import('$lib/stores/events-helpers.js');
            const resumer = await pauseLiveSync();
            if(!$monitor) return;
            if($monitor?.enabled) {
                $monitor.disable();
                ([...$eventsArray] as IEvent[]).filter( event => event.pubkey === $monitor.pubkey).forEach( event => {
                    const key = eventKey(event);
                    $events.delete(key)
                });
                events.set($events);
                await resumer();
                disabled.set(false);
            } 
            else {
                $monitor?.enable()
                const options = {
                    filters: [ $monitor.checkFilter ],
                    options: {
                        stream: true,
                        returnResults: true,
                        cache: true,
                        sync: true,
                        batch: 25
                    },
                    relays: [ ...($route66?.services?.monitors?.nip66Relays || []), ...$monitor.relays ],
                    priority: 20
                }
                const onevents = publishEventsToMemoryRelay
                await $route66?.services?.monitors?.subscribe(options, { onevents })
                await resumer();
                disabled.set(false);

            }
            $route66?.services?.monitors?.manager?.updateMonitor?.($monitor)
        }
    })

    $: checked = $monitor?.enabled
</script>

{#if view === 'cell'}
    <Table.Cell>
        {#if $monitor?.pubkey}
        <Checkbox disabled={$disabled} id="toggle-${$monitor.pubkey.slice(0,21)}" bind:checked aria-labelledby="terms-label" onCheckedChange={toggleEnableMonitor} />
        {/if}
    </Table.Cell>
{:else}
    <Table.Head>
        Enable
    </Table.Head>
{/if}