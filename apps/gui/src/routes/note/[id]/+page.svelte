<script lang="ts">
    import { nip19, type Filter } from 'nostr-tools';
    import { page } from '$app/stores';
    import { instance } from '$lib/utils/lifecycle.js';
	
	import { onMount } from 'svelte';
	import { derived, readable, writable, type Readable, type Writable } from 'svelte/store';
    import { Nip66CheckEvent, Monitor, type IEvent } from '@nostrwatch/route66/models'
    import { route66 } from '$lib/stores/route66.js';
    import Nip66Check from '$lib/components/partials/Nip66Check.svelte'
    import MonitorProfileCompact from '$lib/components/partials/MonitorProfileCompact.svelte'

    import type Route66 from '@nostrwatch/route66';
    
    import type { AddressPointer, DecodeResult, NAddr } from 'nostr-tools/nip19';
	import { doBootstrap } from '$lib/stores/routines.js';
	import { formatRelayUrl } from '$lib/utils/routing.js';

    let id = $page.params.id;
    let data: DecodeResult | undefined;
    let nip66Instance: Route66;
    let monitorPubkey: string | undefined;

    const acceptedKinds: Readable<number[]> = readable([30166, 10166]);
    const foundEvent: Writable<Nip66CheckEvent> = writable(null);
    const looking: Writable<boolean> = writable(true);
    const error: Writable<string | null> = writable(null);
    const filters: Writable<Filter[] | null> = writable(null);
    const relays: Writable<string[]> = writable(['wss://relaypag.es', 'wss://relay.nostr.watch`']);
    const checks: Writable<Nip66CheckEvent[]> = writable([]);

    const getNip66EventFromNip19OrHex = async () => {
        try {
            data = nip19.decode(id)
        }
        catch(e){""}
        
        if(!data || data.type === 'note'){
            if(data && data?.type === 'note') {
                id = data.data as string;
            }
            relays.set(['wss://relaypag.es', 'wss://relay.nostr.watch`'])
            filters.set([{ ids: [id] }])
        }
        else {
            const { pubkey, kind, identifier } = data.data as AddressPointer;
            if(data.type === 'naddr'){
                if(!$acceptedKinds.includes(kind)) {
                    return error.set(`This app does not support kind ${kind}`);
                }
            }
            else {
                return error.set(`This app does not support type ${data.type}`);
            }
            filters.set([{ authors: [pubkey], kinds: [kind], '#d': [identifier] }],)
            if(data.data?.relays && data.data.relays.length > 0){
                relays.set(data.data.relays)
            }
        }
        if(!$filters) return 
        const result: IEvent[] = await nip66Instance.websocketAdapter.subscribe({
            filters: $filters,
            relays: $relays,
            options: {
                stream: false,
                cache: true,
                keepAlive: false,
                returnResults: true,
            }
        })
        ////console.log('result', result)
        const event = result[0]
        if(result.length > 0) {
            foundEvent.set(new Nip66CheckEvent(event))
        }
        looking.set(false)
    }

    const getMonitorWhoPublishedEvent = async () => {
        if(!$foundEvent) return
        await nip66Instance.services.relay.monitorInstancesFromChecks([$foundEvent])
    }

    const getSupplementaryData = async () => {
        if(!$foundEvent) return
        const [ch] = await nip66Instance.services.relay.getRelayData($foundEvent.relay)
        checks.set(ch)
    }

    onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(false);
        nip66Instance = $route66? $route66: await instance();
        await nip66Instance.ready()
        await getNip66EventFromNip19OrHex()
        await getSupplementaryData()
    })
    $: relayUrl = $foundEvent && $foundEvent?.relay? $foundEvent?.relay: undefined;
    $: monitor = nip66Instance?.initialized && $foundEvent? nip66Instance.services.monitors.array.find( (monitor: Monitor) => monitor.pubkey === $foundEvent.pubkey ): undefined;
    $: otherMonitors = nip66Instance?.initialized && $foundEvent? nip66Instance.services.monitors.array.filter( (monitor: Monitor) => monitor.pubkey !== $foundEvent.pubkey && $checks.some(check => check.pubkey === monitor.pubkey) ): []
</script>
<header>
    <h1 class="text-2xl min-w-28 overflow-hidden overflow-ellipsis mb-10 w-1/2">${id}</h1>
</header>

{#if !error}
 Error: ${$error}
{:else if $looking}
    <p>Looking for event...</p>
{:else}
    {#if $foundEvent}
        <MonitorProfileCompact {monitor} />

        {#if otherMonitors?.length}
            Seen by {otherMonitors.length} other monitors
        {/if}

        <a href="/relays/{formatRelayUrl(relayUrl)}">Check out ${relayUrl}'s page for more information</a>
       <Nip66Check check={$foundEvent} />
    {:else}
        <p>No event found.</p>
    {/if}
{/if}