<script lang="ts">
    import { page } from '$app/stores';
    import { onDestroy, onMount } from 'svelte';
    import { doBootstrap } from '$lib/stores/routines.js';
    import { instance } from '$lib/utils/lifecycle.js';
    import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { Nip66Event, type Monitor} from '@nostrwatch/nip66/models';
	import { relayCheckAggregator } from '$lib/stores/checks.js';
	import { StateManager } from '@nostrwatch/nip66';
	import { nip11s } from '$lib/stores/nip11s.js';
    import { eventsArray } from '$lib/stores/events.js'
    import RelayMap from '$lib/components/partials/RelayMap.svelte'
	import Nip66Check from '$lib/components/partials/Nip66Check.svelte';
	import type { NostrEvent } from 'nostr-tools';
    import type Nip66 from '@nostrwatch/nip66';

    export let params: { protocol: string; relay: string };

    const monitors: Writable<Monitor[]> = writable([])

    const freshChecks: Writable<Nip66Event[]> = writable([])
    
    const existingChecks: Readable<Nip66Event[]> = derived(eventsArray, $eventsArray => {
        return $eventsArray.filter( event => new URL(event.relay).toString() === new URL(relayUrl).toString() )
    });

    const checks: Readable<Nip66Event[]> = derived(
        [freshChecks, existingChecks],
        ([$freshChecks, $existingChecks]) => {
            const relayMap = new Map<string, Nip66Event>();
            if($freshChecks.length) {
                $freshChecks.forEach((event: Nip66Event) => {
                    if (!event.relay) console.error('Invalid relay:', event);
                    relayMap.set(event.pubkey, event);
                });
            }
            if($existingChecks.length) {
                $existingChecks.forEach((event: Nip66Event) => {
                    if (!event.relay) console.error('Invalid relay:', event);
                    if (!relayMap.has(event.relay)) {
                        relayMap.set(event.pubkey, event);
                    }
                });
            }
            return Array.from(relayMap.values());
        }
    );

    let currentRelay: string = '';
    let loading: boolean = true;
    let nip66Instance: Nip66;

    const relayAggregate: Readable<any[]> = derived(checks, ($checks) => {
        const aggregate = relayCheckAggregator($checks)
        return Object.entries(aggregate).map(([relay, item], index) => ({
            relay,
            ...item.aggregate,
            id: index,
        }));
    });

    const reset = () => {
        if (currentRelay === relayUrl) return;
        freshChecks.set([]);
        monitors.set([])
    };

    const loadRelayData = async () => {
        reset();
        nip66Instance = await instance();
        const res = (await nip66Instance.services.relay.getRelayData(relayUrl));
        if(!res) return 
        const [data, mons] = res;
        freshChecks.set(data);
        console.log('typeof total checks', typeof data,  data.length, data)
        console.log('typeof mons', typeof mons, mons)
        monitors.set(Array.from(mons?.values() || new Set()))
        currentRelay = relayUrl;
        loading = false;
    };

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(false)
    });

    $: relayUrl = `${$page.params.protocol}://${$page.params.relay}`;
    $: if (relayUrl !== currentRelay) {
        loadRelayData().then(() => {
            StateManager.emit(`${relayUrl}:hydrated`)
            console.log('load relay + load monitors')
        });
    }
    onDestroy(() => {
        reset();
    });

    $: banner = $checks?.length? ($nip11s.get(relayUrl) || []).find( (nip11: any) => nip11?.banner ): undefined
    $: timesSeen = $checks.length;
</script>

<header class="relative">
    {#if banner}
        <img alt="${relayUrl}'s banner image from nip-11" src="${banner}" class="absolute top-0 left-0 right-0" />
    {/if}
    <h1 class="text-6xl">{relayUrl}</h1>
</header>

{#if !$checks.length}
    <p>Loading...</p>
{:else}
    {JSON.stringify($checks)}
    Monitors Length: {$monitors.length} <br />
    Fresh Checks Length: {$freshChecks.length} <br />
    Existing Checks Length: {$existingChecks.length} <br />
    Derived Checks Legnth: {$checks.length} <br />
    {#if false && $monitors.length && $checks.length}
    <RelayMap relay={relayUrl} monitors={$monitors} checks={$checks} aggregate={$relayAggregate} />
    {/if}
    {#if $relayAggregate.length}
        <ul>
            {#each $relayAggregate as check}
                <li>{JSON.stringify(check)}</li>
            {/each}
        </ul>
    {:else}
        <p>No checks available.</p>
    {/if}
{/if}
