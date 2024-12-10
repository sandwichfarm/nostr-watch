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
    import type Nip66 from '@nostrwatch/nip66';
	import ProfileCompact from '$lib/components/partials/ProfileCompact.svelte';
	import { isHex } from '$lib/utils/nostr.js';
    import { Nip11 } from '@nostrwatch/nip66/models';

	import RelayChecks from '$lib/components/partials/relay-single/RelayChecks.svelte';
    import OperatorFeed from '$lib/components/partials/relay-single/OperatorFeed.svelte';
    import * as Tabs from '$lib/components/ui/tabs';

    import Masonry from 'svelte-bricks'

	import CardChecks from '$lib/components/partials/relay-single/cards/CardChecks.svelte';
	import CardFees from '$lib/components/partials/relay-single/cards/CardFees.svelte';
	import CardInsights from '$lib/components/partials/relay-single/cards/CardInsights.svelte';
	import CardGeneral from '$lib/components/partials/relay-single/cards/CardGeneral.svelte';
	import CardMap from '$lib/components/partials/relay-single/cards/CardMap.svelte';
	import CardNetwork from '$lib/components/partials/relay-single/cards/CardNetwork.svelte';

    export let params: { protocol: string; relay: string };
    let currentRelay: string = '';
    let loading: boolean = true;
    let nip66Instance: Nip66;
        
    const operatorProfile: Writable<PubkeyProfile | null> = writable(null)
    const operatorRelays: Writable<PubkeyRelays | null> = writable(null)

    const monitors: Writable<Monitor[]> = writable([])

    const freshChecks: Writable<Nip66Event[]> = writable([])

    const activeTab: Writable<string> = writable('overview')

    const activateTab = (tab: string) => {
        activeTab.set(tab)
    }
    
    const existingChecks: Readable<Nip66Event[]> = derived(eventsArray, $eventsArray => {
        return $eventsArray.filter( event => {
            let result: boolean = false;
            try {
                result = event?.relay && new URL(event.relay).toString() === new URL(relayUrl).toString() 
            }
            catch(e: any){
                return result
            }
            finally {
                return result
            }
        })
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
                    if (!check.relay) return console.error('Invalid relay:', check);
                    if (!relayMap.has(check.relay)) {
                        relayMap.set(check.pubkey, check);
                    }
                });
            }
            return Array.from(relayMap.values()).sort((a: Nip66Event, b: Nip66Event) => (b.created_at as number) - (a.created_at as number));
        }
    );



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

    const nip11: Readable<Nip11 | undefined> = derived(
        [nip11sLocal, nip11s], 
        ([$nip11sLocal, $nip11s]) => {
            let result: Nip11 | undefined;  
            if($nip11sLocal) result = $nip11sLocal.get(relayUrl)
            if($nip11s) result = $nip11s.get(relayUrl)?.[0]
            return result
        }
    )   

    const reset = () => {
        if (currentRelay === relayUrl) return;
        activateTab('overview')
        freshChecks.set([]);
        monitors.set([])
        operatorProfile.set(null)
        operatorRelays.set(null)
    };

    const loadRelayData = async () => {
        reset();
        nip66Instance = await instance();
        const res = (await nip66Instance?.services?.relay?.getRelayData(relayUrl));
        if(!res) return 
        const [data, mons] = res;
        freshChecks.set(data);
        //console.log('typeof total checks', typeof data,  data.length, data)
        //console.log('typeof mons', typeof mons, mons)
        monitors.set(Array.from(mons?.values() || new Set()))
        currentRelay = relayUrl;
        await loadNip11()
        loadOperatorMeta()
        loading = false;
    };

    const loadNip11 = async () => {
        await $nip11Service.check( relayUrl )
        //console.log('nip11', )
        nip11sLocal.subscribe( ($n11s: any) => {
            if(operatorPubkey) return;
            const nip11arr = $n11s.get(relayUrl) || [];
            //console.log('nip11arr', nip11arr)
            if(nip11arr?.length) {
                for(const n11 of nip11arr){
                    nip11sLocal.set(n11)
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
        $nip11?.supportedNips && $nip11.supportedNips.length? 
            $nip11?.supportedNips: 
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
        $nip11?.fees? 
            $nip11.fees: 
            $relayAggregate?.fees?
                $relayAggregate.fees:
                null;
    $: paymentUrl = $nip11?.paymentsUrl
    // $: decentralizationScore = $relayScores.get(relayUrl) ?? -1
    $: if (relayUrl !== currentRelay) {
        loadRelayData().then(() => {
            StateManager.emit(`${relayUrl}:hydrated`)
            //console.log('load relay + load monitors')
        });
    }

    $: items = [
        'general',
        'fees',
        'network',
        'insights',
        'checks',
        'map'
    ]
  
    let [minColWidth, maxColWidth, gap] = [400, 800, 21]
    let width:number, height: number
</script>

<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat h-48"
  style={`background-image: url('${banner}');`}
>
  <!-- <div class="absolute inset-0 bg-black opacity-50 z-0"></div> -->

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

<main class="flex flex-wrap md:flex-nowrap mx-0 w-full p-0">
    <section class="flex-1  rounded shadow">
        <Tabs.Root value="overview" class="w-full p-0">
            <Tabs.List class="w-full rounded-none px-10 py-7">
                <Tabs.Trigger value="overview" class="text-lg flex-grow" on:click={() => activateTab('overview')}>Overview</Tabs.Trigger>
                <Tabs.Trigger value="checks" class="text-lg flex-grow" on:click={() => activateTab('checks')}>Checks</Tabs.Trigger>
                <Tabs.Trigger disabled={$nip11? false: true}  value="nip11" class="text-lg flex-grow" on:click={() => activateTab('nip11')}>NIP-11</Tabs.Trigger>
                <Tabs.Trigger disabled={operatorPubkey? false: true} value="operator-feed" class="text-lg flex-grow" on:click={() => activateTab('operator-feed')}>Feed</Tabs.Trigger>
                <Tabs.Trigger disabled={true} value="audit" class="text-lg flex-grow" on:click={() => activateTab('audit')}>Audits</Tabs.Trigger>
            </Tabs.List>
             <div class="p-4">
            <Tabs.Content value="overview">
                <Masonry
                    {items}
                    {minColWidth}
                    {maxColWidth}
                    {gap}
                    let:item
                    bind:width
                    bind:height
                >
                <div>
                {#if item === 'map'}
                    <CardMap relay={relayUrl} monitors={$monitors} checks={$checks} aggregate={$relayAggregate} />
                {/if}
                {#if item === 'network'}
                     <CardNetwork ipv4={ipv4} ipv6={ipv6} isp={isp} />
                {/if}
                {#if item === 'insights'}
                    <CardInsights relayAggregate={$relayAggregate} />
                {/if}
                {#if item === 'checks'}
                    <CardChecks checks={$checks} />
                {/if}
                {#if item === 'general'}
                    <CardGeneral version={version} software={software} geocode={geocode} />
                {/if}
                {#if item === 'fees'}
                    <CardFees {fees} {paymentUrl} />
                {/if}
            </div>
              </Masonry>

            </Tabs.Content>
            <Tabs.Content value="checks">
                <RelayChecks relay={relayUrl} monitors={$monitors} checks={$checks} aggregate={$relayAggregate} />
            </Tabs.Content>
            <Tabs.Content value="audit">
    
            </Tabs.Content>
            <Tabs.Content value="nip11">
                <pre class="py-6 px-8 bg-white/5 rounded-lg">{JSON.stringify($nip11?.json, null, 4)}</pre>
            </Tabs.Content>
            <Tabs.Content value="operator-feed">
                {#if operatorPubkey && $activeTab === 'operator-feed'}
                    <OperatorFeed pubkey={operatorPubkey} />
                {/if}
            </Tabs.Content>
            </div>
        </Tabs.Root>
    </section>
    <!-- SIDEBAR -->
    <!-- {#if $operatorProfile} -->
    <!-- <aside class="w-full md:w-1/4 p-4 rounded shadow">
        {#if operatorPubkey}
            <OperatorFeed pubkey={operatorPubkey} />
        {/if}
    </aside> -->
    <!-- {/if} -->
  </main>

<style lang="postcss">
    #relay-header {
        @apply px-3 py-10 bg-white/5;
    }

    #overview-container > div {
        @apply w-1/2 border;
    }

    .data-\[state\=active\]\:bg-background[data-state="active"] {
        @apply !bg-black/10;
    }
</style>