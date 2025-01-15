
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { derived, writable, type Writable } from 'svelte/store';
    
	
	import { eventsArray, nip66 } from '$lib/stores';
	import { type IEvent, Monitor, Nip66Event } from '@nostrwatch/nip66/models';
	import OperatorRelay from './OperatorRelay.svelte';

    export let pubkey: string;
    export let relayUrl: string;
    export let otherRelaysCount: number = 0;
    export let monitors: Monitor[];

    const deadRelays: Writable<Nip66Event[]> = writable([])

    const fetchDeadRelays = async () => {
        if(!$nip66) return;
        const deadRelays = await $nip66.services.monitors.fetchOperatorRelaysNotOnline(pubkey) || []
        //console.log('dead relays fetched:', deadRelays.length)
        deadRelays?.forEach( (event: IEvent) => {
            deadRelays.update( ( events: Nip66Event[] ): Nip66Event[] => {
                return [...events, new Nip66Event(event)]
            })
        })
    }
    const operatorRelays = derived([eventsArray, deadRelays], ([$eventsArray, $deadRelays]) => {
        const online =  $eventsArray.filter((event: Nip66Event) => {
            return  event?.operatorPubkey 
                    && event.operatorPubkey === pubkey 
                    && event?.relay !== relayUrl;
        })
        const all = [...online, ...$deadRelays]
        otherRelaysCount = all.length
        return all
    });

    const mount = async () => {
        if(!$nip66) return;
        await $nip66.ready();
        fetchDeadRelays()
    }

    const destroy = async () => {
        // await $nip66.shutdown()
    }

    onMount(mount)
    onDestroy(destroy)
</script>
{#if pubkey}
    {#each $operatorRelays as event}
        <OperatorRelay {event} {nip66} />
    {/each}
{/if}