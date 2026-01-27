
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { derived, writable, type Writable } from 'svelte/store';
    
	
	import { eventsArray, route66, type StoreEventType } from '$lib/stores';
	import { type IEvent, Monitor, Nip66CheckEvent } from '@nostrwatch/route66/models';
	import OperatorRelay from './OperatorRelay.svelte';

    export let pubkey: string;
    export let relayUrl: string;
    export let otherRelaysCount: number = 0;
    export let monitors: Monitor[];

    const deadRelays: Writable<Nip66CheckEvent[]> = writable([])

    const deduplicate = (events: Nip66CheckEvent[]): Nip66CheckEvent[] => {
        return events.reduce( (acc: Nip66CheckEvent[], event: Nip66CheckEvent) => {
            if(acc.find( (e: Nip66CheckEvent) => e.relay === event.relay)) return acc;
            return [...acc, event]
        }, [])
    }

    const fetchDeadRelays = async () => {
        const dead = await $route66.services.monitors.fetchOperatorRelaysNotOnline(pubkey) || []
        dead?.forEach( (event: IEvent) => {
            const deadInstance = new Nip66CheckEvent(event)
            if(deadInstance.relay === relayUrl) return;
            if($onlineRelays.find((e: Nip66CheckEvent) => e.relay === deadInstance.relay)) return;
            deadRelays.update( ( events: Nip66CheckEvent[] ): Nip66CheckEvent[] => {
                return [...events, deadInstance]
            })
        })
    }

    const onlineRelays = derived(eventsArray, ($eventsArray) => {
        return deduplicate($eventsArray.filter( (event: StoreEventType) => {
            return  (event as Nip66CheckEvent)?.operatorPubkey 
                    && (event as Nip66CheckEvent).operatorPubkey === pubkey 
                    && (event as Nip66CheckEvent)?.relay !== relayUrl;
        }) as Nip66CheckEvent[])
    });

    const allOperatorRelays = derived([onlineRelays, deadRelays], ([$onlineRelays, $deadRelays]) => {
        const all = [...$onlineRelays, ...$deadRelays]
        otherRelaysCount = $onlineRelays.length
        return deduplicate(all)
    });

    const mount = async () => {
        if(!$route66) return;
        await $route66.ready();
        fetchDeadRelays()
    }

    const destroy = async () => {
        // await $route66.shutdown()
    }

    onMount(mount)
    onDestroy(destroy)
</script>
<!-- <pre>{JSON.stringify($allOperatorRelays, null, 2)}</pre> -->
{#if pubkey}
    {#each $allOperatorRelays as event}
        <OperatorRelay {event} {route66} />
    {/each}
{/if}