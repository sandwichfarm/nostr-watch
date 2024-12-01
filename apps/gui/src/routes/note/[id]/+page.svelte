<script lang="ts">
    import type Nip66 from '@nostrwatch/nip66';
    import type { IEvent } from '@nostrwatch/nip66/models';
    import { nip19, type Filter } from 'nostr-tools';
    import { page } from '$app/stores';
    import { instance } from '$lib/utils/lifecycle.js';
	import type { AddressPointer, DecodeResult, NAddr } from 'nostr-tools/nip19';
	import { onMount } from 'svelte';
	import { readable, writable, type Readable, type Writable } from 'svelte/store';
    let id = $page.params.id;
    let data: DecodeResult | undefined;
    
    const acceptedKinds: Readable<number[]> = readable([30166, 10166]);
    const foundEvent: Writable<IEvent> = writable(null);
    const looking: Writable<boolean> = writable(true);
    const error: Writable<string | null> = writable(null);
    const filters: Writable<Filter[] | null> = writable(null);
    const relays: Writable<string[]> = writable(['wss://relaypag.es', 'wss://relay.nostr.watch`']);

    onMount(async () => {
        const nip66: Nip66 = await instance();
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
            if(event) foundEvent.set(event)
            looking.set(false)
        }
        if(!$filters) return 
        const result = await nip66.websocketAdapter.subscribe({
            filters: $filters,
            relays: $relays,
            options: {
                stream: false,
                cache: false,
                keepAlive: false,
                returnResults: true,
            }
        })
        console.log('result', result)
        foundEvent.set(result)
        looking.set(false)
    })
    
</script>
{#if !error}
 Error: ${$error}
{:else if $looking}
    <p>Looking for event...</p>
{:else}
    {#if $foundEvent}
        <pre>{JSON.stringify($foundEvent, null, 2)}</pre>
    {:else}
        <p>No event found.</p>
    {/if}
{/if}