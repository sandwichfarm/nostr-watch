<script lang="ts">
    import { page } from '$app/stores';
    import { onDestroy, onMount } from 'svelte';
    import { doBootstrap } from '$lib/stores/routines.js';
    import { instance } from '$lib/utils/lifecycle.js';
    import { derived, writable, type Readable, type Writable } from 'svelte/store';
    import { Nip66Event, PubkeyProfile, PubkeyRelays, type Monitor, type INip11} from '@nostrwatch/nip66/models';
	import { relayAggregates, relayCheckAggregator } from '$lib/stores/checks.js';
	import { StateManager } from '@nostrwatch/nip66';
	import { nip11s, nip11Service, nip11sLocal } from '$lib/stores/nip11s.js';
    import { eventsArray } from '$lib/stores/events.js'
    import RelayMap from '$lib/components/partials/RelayMap.svelte'
	import type { nip11 as Nip11, NostrEvent } from 'nostr-tools';
    import type Nip66 from '@nostrwatch/nip66';
	import ProfileCompact from '$lib/components/partials/ProfileCompact.svelte';
	import { formatNip, isHex } from '$lib/utils/nostr.js';
	import { relayScores } from '$lib/stores/score-relays-decentralization.js';

    import Badge from '$lib/components/ui/badge/badge.svelte';
    import RelaySoftware from '$lib/components/partials/relay-single/RelaySoftware.svelte'
    import RelayIsp from '$lib/components/partials/relay-single/RelayIsp.svelte'
    import RelayCountry from '$lib/components/partials/relay-single/RelayCountry.svelte'
    import RelayInsights from '$lib/components/partials/relay-single/RelayInsights.svelte';
    import RelayFees from '$lib/components/partials/relay-single/RelayFees.svelte';
	import Nip66Check from '$lib/components/partials/Nip66Check.svelte';
	import RelayChecks from '$lib/components/partials/relay-single/RelayChecks.svelte';

    export let params: { protocol: string; relay: string };

    const nip11: Writable<Nip11.RelayInformation | null> = writable(null)
        
    const operatorProfile: Writable<PubkeyProfile | null> = writable(null)
    const operatorRelays: Writable<PubkeyRelays | null> = writable(null)

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
                $freshChecks.forEach((check: Nip66Event) => {
                    if (!check.relay) console.error('Invalid relay:', check);
                    relayMap.set(check.pubkey, check);
                });
            }
            if($existingChecks.length) {
                $existingChecks.forEach((check: Nip66Event) => {
                    if (!check.relay) console.error('Invalid relay:', check);
                    if (!relayMap.has(check.relay)) {
                        relayMap.set(check.pubkey, check);
                    }
                });
            }
            return Array.from(relayMap.values());
        }
    );

    let currentRelay: string = '';
    let loading: boolean = true;
    let nip66Instance: Nip66;

    const relayAggregate: Readable<any | undefined> = derived(checks, ($checks) => {
        let aggregate = relayCheckAggregator($checks)
        if(aggregate) {
            return Object.entries(aggregate).map(([relay, item], index) => ({
                relay,
                ...item.aggregate,
                id: index,
            }))?.[0];
        }
        else {
            return $relayAggregates.find( (agg: any) => agg.relay === relayUrl )
        }
    });

    const reset = () => {
        if (currentRelay === relayUrl) return;
        freshChecks.set([]);
        monitors.set([])
        operatorProfile.set(null)
        operatorRelays.set(null)
        nip11.set(null)
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
        await loadNip11()
        loadOperatorMeta()
        loading = false;
    };

    const loadNip11 = async () => {
        console.log('nip11', await $nip11Service.check( relayUrl ))
        nip11sLocal.subscribe( ($n11s: any) => {
            if(operatorPubkey) return;
            const nip11arr = $n11s.get(relayUrl) || [];
            console.log('nip11arr', nip11arr)
            if(nip11arr?.length) {
                for(const n11 of nip11arr){
                    nip11.set(n11)
                    if($nip11) break;
                }
            }
        })
    }

    const loadOperatorMeta = async () => {
        if(!operatorPubkey) return;
        const metas = await nip66Instance.services.relay.fetchOperatorMeta(operatorPubkey)
        for(const meta of metas){
            if(meta.kind === 0){
                operatorProfile.set( new PubkeyProfile(meta) )
            }
            if(meta.kind === 10002){
                operatorRelays.set( new PubkeyRelays(meta) )
            }
        }
    }

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(false)
    });

    onDestroy(() => {
        reset();
    });
    $: relayUrl = `${$page.params.protocol}://${$page.params.relay}`;
    $: timesSeen = $checks.length;
    $: seenBy = $checks.map( (check: any) => check.pubkey )
    $: seenByCount = $checks.map( (check: any) => check.pubkey ).length
    $: rttAverage = $relayAggregate?.rtt
    $: ipv4 = $relayAggregate?.ipv4
    $: ipv6 = $relayAggregate?.ipv6
    $: geocode = $relayAggregate?.geocode
    $: dd = $relayAggregate?.dd
    $: isp = $relayAggregate?.isp
    $: name = $nip11?.name ?? 
        $relayAggregate?.name?
            $relayAggregate.name:
            null;
    $: description = $nip11?.description ?? 
        $relayAggregate?.description?
            $relayAggregate.description:
            null;
    $: banner = $nip11?.description ?? 
        $relayAggregate?.banner?
            $relayAggregate.banner:
            null;
    $: icon = $nip11?.icon ?? 
        $relayAggregate?.icon?
            $relayAggregate.icon:
            null;
    $: operatorPubkey = 
        $nip11?.pubkey && $nip11.pubkey.length && isHex($nip11.pubkey)? 
            $nip11.pubkey: 
            $relayAggregate?.operatorPubkey?
                $relayAggregate.operatorPubkey:
                null;
    $: supportedNips = 
        $nip11?.supported_nips && $nip11.supported_nips.length? 
            $nip11?.supported_nips: 
            $relayAggregate?.supportedNips?
                $relayAggregate.supportedNips:
                null;
    $: software = 
        $nip11?.software && $nip11.software.length? 
            $nip11.software: 
            $relayAggregate?.software?
                $relayAggregate.software:
                null;
    $: version = 
        $nip11?.version && $nip11.version.length? 
            $nip11.version: 
            $relayAggregate?.version?
                $relayAggregate.version:
                null;
    $: fees = 
        $nip11?.fees && $nip11.fees.length? 
            $nip11.fees: 
            $relayAggregate?.fees?
                $relayAggregate.fees:
                null;
    $: decentralizationScore = $relayScores.get(relayUrl) ?? -1
    $: if (relayUrl !== currentRelay) {
        loadRelayData().then(() => {
            StateManager.emit(`${relayUrl}:hydrated`)
            console.log('load relay + load monitors')
        });
    }
</script>

<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat h-64"
  style={`background-image: url('${banner}');`}
>
  <div class="absolute inset-0 bg-black opacity-50 z-0"></div>



  <div class="relative z-10 flex justify-between p-6 h-full">
    <div class="flex">
        <div class="flex-shrink-0 mr-2">
            {#if icon}
                <span class="inline-block overflow-hidden rounded-full w-20 h-20">
                    <img src="{icon}" alt="relay icon" class="inline mr-2 w-full h-auto" />
                </span>
            {/if}
        </div>
        <div class="">
            <h1 class="text-6xl text-white">
                {relayUrl}
            </h1>
            <p class="text-lg italic text-white/80">{description}</p>
        </div>
    </div>

    <!-- Operator Information -->
    {#if $operatorProfile && operatorPubkey}
      <div class="py-1 px-2 rounded-lg bg-white/5">
        <span class="text-xs uppercase">operated by:</span>
        <ProfileCompact pubkey={operatorPubkey} profile={$operatorProfile} />
      </div>
    {/if}
  </div>
</header>

<div id="subheader" class="bg-white/10 px-3 py-1 block">
    {#if $nip11}
        {#if supportedNips}
            <div>
                <!-- <span class="text-xs uppercase">supported nips:</span> -->
                {#each supportedNips as nip}
                    <Badge variant="outline" class="mr-1 bg-black/30">{formatNip(nip)}</Badge>
                {/each}
            </div>
        {/if}      
    {/if}
</div>

{#if loading}
<p>Loading...</p>
{:else}
<p>Loaded</p>
{/if}

{#if !$checks.length}
    no checks
{:else}
    

    <div>
        score: {decentralizationScore}
    </div>

    <RelayChecks checks={$checks} />
    <RelaySoftware {version} {software} />
    <RelayIsp {isp} />
    <RelayCountry {geocode} />
    <RelayInsights relayAggregate={$relayAggregate} />
    <RelayFees {fees} />

    {#if $monitors.length && $checks.length}
    <RelayMap relay={relayUrl} monitors={$monitors} checks={$checks} aggregate={$relayAggregate} />
    {/if}
    {#if $relayAggregate}
        <p>checks found</p>
    {:else}
        <p>No checks available.</p>
    {/if}
{/if}

<style lang="postcss">
    #relay-header {
        @apply px-3 py-10 bg-white/5;
    }
    
</style>