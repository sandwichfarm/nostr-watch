<script lang="ts">
import { page, navigating } from '$app/stores';
import { onDestroy, onMount } from 'svelte';

import { doBootstrap } from '$lib/stores/routines.js';
import { instance } from '$lib/utils/lifecycle.js';
import { derived, writable, type Readable, type Writable } from 'svelte/store';
import { Nip66Event, PubkeyProfile, PubkeyRelays, type Monitor, type INip11} from '@nostrwatch/nip66/models';
import { relayAggregates, relayCheckAggregator } from '$lib/stores/checks.js';
import { nip11s, nip11Service, nip11sLocal } from '$lib/stores/nip11s.js';
import { isSeeded } from '$lib/stores/app.js';
import { eventsArray } from '$lib/stores/events.js';
import { isHex } from '$lib/utils/nostr.js';
import { Nip11 } from '@nostrwatch/nip66/models';

import { isLivesyncing, doAggregateCache, hasBeenBoostrapped } from '$lib/stores/app';
import { beginLiveSync, stopLiveSync } from '$lib/utils/lifecycle';

import { addEventsToStore } from '$lib/stores/events-helpers';
import { clickToCopy, observeViewport } from '$lib/utils/ux';

let ProfileCompact: typeof import('$lib/components/partials/ProfileCompact.svelte').default;
let RelayChecks: typeof import('$lib/components/partials/relay-single/RelayChecks.svelte').default;
let OperatorFeed: typeof import('$lib/components/partials/relay-single/OperatorFeed.svelte').default;
let Tabs: typeof import('$lib/components/ui/tabs');
let Masonry: typeof import('svelte-bricks').default;
let CardChecks: typeof import('$lib/components/partials/relay-single/cards/CardChecks.svelte').default;
let CardFees: typeof import('$lib/components/partials/relay-single/cards/CardFees.svelte').default;
let CardInsights: typeof import('$lib/components/partials/relay-single/cards/CardInsights.svelte').default;
let CardGeneral: typeof import('$lib/components/partials/relay-single/cards/CardGeneral.svelte').default;
let CardMap: typeof import('$lib/components/partials/relay-single/cards/CardMap.svelte').default;
let CardNetwork: typeof import('$lib/components/partials/relay-single/cards/CardNetwork.svelte').default;
let Stats: typeof import('$lib/components/blocks/Stats.svelte').default;
let CardOperator: typeof import('$lib/components/partials/relay-single/cards/CardOperator.svelte').default;
let CardSpeed: typeof import('$lib/components/partials/relay-single/cards/CardSpeed.svelte').default;
let RelayAudits: typeof import('$lib/components/partials/relay-single/RelayAudits.svelte').default;




const loadComponents = async () => {
    const imports = [
        import('$lib/components/partials/ProfileCompact.svelte'),
        import('$lib/components/partials/relay-single/RelayChecks.svelte'),
        import('$lib/components/partials/relay-single/OperatorFeed.svelte'),
        import('$lib/components/ui/tabs'),
        import('svelte-bricks'),
        import('$lib/components/partials/relay-single/cards/CardChecks.svelte'),
        import('$lib/components/partials/relay-single/cards/CardFees.svelte'),
        import('$lib/components/partials/relay-single/cards/CardInsights.svelte'),
        import('$lib/components/partials/relay-single/cards/CardGeneral.svelte'),
        import('$lib/components/partials/relay-single/cards/CardMap.svelte'),
        import('$lib/components/partials/relay-single/cards/CardNetwork.svelte'),
        import('$lib/components/blocks/Stats.svelte'),
        import('$lib/components/partials/relay-single/cards/CardOperator.svelte'),
        import('$lib/components/partials/relay-single/cards/CardSpeed.svelte'),
        import('$lib/components/partials/relay-single/RelayAudits.svelte')
    ];

    const results = await Promise.allSettled(imports);
    [
        ProfileCompact,
        RelayChecks,
        OperatorFeed,
        Tabs,
        Masonry,
        CardChecks,
        CardFees,
        CardInsights,
        CardGeneral,
        CardMap,
        CardNetwork,
        Stats,
        CardOperator,
        CardSpeed,
        RelayAudits
    ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));

    componentsLoaded.set(true)
};


doBootstrap.set(false);
doAggregateCache.set(false);

export let params: { protocol: string; relay: string };
let currentRelay: string = '';
let loading: boolean = true;
let nip66Instance: Nip66;
    
const operatorProfile: Writable<PubkeyProfile | null> = writable(null);
const operatorRelays: Writable<PubkeyRelays | null> = writable(null);
const monitors: Writable<Monitor[]> = writable([]);
const activeTab: Writable<string> = writable('overview');
const componentsLoaded: Writable<boolean> = writable(false);

const activateTab = (tab: string) => {
    activeTab.set(tab);
};

const checksrelay: Readable<Nip66Event[]> = derived(
    eventsArray,
    ($eventsArray) => {
        const results = new Map<string, Nip66Event>();
        if ($eventsArray.length) {
            $eventsArray.forEach((check: Nip66Event) => {
                if (!check.relay) return console.error('Invalid check:', check);
                if (check.relay !== relayUrl) return;
                if (!results.has(relayUrl)) {
                    results.set(check.pubkey, check);
                }
            });
        }
        return Array.from(results.values())
            .sort((a: Nip66Event, b: Nip66Event) => (b.created_at as number) - (a.created_at as number));
    }
);

const relayAggregate: Readable<any | undefined> = derived(checksrelay, ($checksrelay) => {
    let aggregate = relayCheckAggregator($checksrelay);
    if (aggregate) {
        return Object.entries(aggregate).map(([relay, item], index) => ({
            relay,
            ...item.aggregate,
            id: index,
        }))?.[0];
    } else {
        return $relayAggregates.find((agg: any) => agg.relay === relayUrl);
    }
});

const nip11: Readable<Nip11 | undefined> = derived(
    [nip11sLocal, nip11s], 
    ([$nip11sLocal, $nip11s]) => {
        let result: Nip11 | undefined;  
        const localNip11 = $nip11sLocal.get(relayUrl);
        if (localNip11) return localNip11;
        if ($nip11s) return $nip11s.get(relayUrl)?.[0];
        return undefined
    }
);   

const reset = () => {
    if (currentRelay === relayUrl) return;
    nip66Instance?.services?.relay?.unsubscribeAll();
    console.log('!!! RESET');
    loading = true;
    currentRelay = '';
    nip66Instance = undefined;
    activateTab('overview');
    monitors.set([]);
    operatorProfile.set(null);
    operatorRelays.set(null);

};

const loadRelayData = async () => {
    reset();
    nip66Instance = await instance();
    if(!$isLivesyncing) {
        const res = (await nip66Instance?.services?.relay?.getRelayData(relayUrl));
        if (!res) return; 
        const [data, mons] = res;
        addEventsToStore(data);
        monitors.set(Array.from(mons?.values() || new Set()));
    }
    await loadNip11();
    await loadOperatorMeta();
    loading = false;
    currentRelay = relayUrl;
};

const loadNip11 = async () => {
    await $nip11Service.check(relayUrl);
};

const loadOperatorMeta = async () => {
    if (!operatorPubkey) return;
    const onevent = (event: IEvent) => {
        if (event.kind === 0 && !$operatorProfile) {
            operatorProfile.set(new PubkeyProfile(event));
        }
        if (event.kind === 10002 && !$operatorRelays) {
            operatorRelays.set(new PubkeyRelays(event));
        }
    };
    await nip66Instance?.services?.relay?.fetchOperatorMeta(operatorPubkey, { onevent });
};



const mount = async () => {
    let wasLivesyncing: boolean = false;
    if($isLivesyncing) {
        wasLivesyncing = true;
        stopLiveSync()
    }
    loadComponents();
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (hasBeenBoostrapped()) {
        while (!isSeeded) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    loadRelayData().then( () => {
        if(wasLivesyncing) {
            beginLiveSync()
        }
    });
};

onMount(mount);

onDestroy(() => {
    reset();
});

$: relayUrl = new URL(`${$page.params.protocol}://${$page.params.relay}`).toString();
$: timesSeen = $checksrelay.length;
$: seenBy = $checksrelay.map((check: any) => check.pubkey);
$: seenByCount = $checksrelay.map((check: any) => check.pubkey).length;
$: rttAverage = $relayAggregate?.rtt;
$: ipv4 = $relayAggregate?.ipv4;
$: ipv6 = $relayAggregate?.ipv6;
$: geocode = $relayAggregate?.geocode;
$: dd = $relayAggregate?.dd;
$: isp = $relayAggregate?.isp;
$: name = $nip11?.name ? $nip11.name : null;
$: description = $nip11?.description ? $nip11?.description : null;
$: banner = $nip11?.banner ? $nip11.banner : null;
$: icon = $nip11?.icon ? $nip11.icon : null;
$: operatorPubkey = 
    $nip11?.pubkey && $nip11.pubkey.length && isHex($nip11.pubkey)
        ? $nip11.pubkey
        : $relayAggregate?.operatorPubkey && isHex($relayAggregate.operatorPubkey)
            ? $relayAggregate.operatorPubkey
            : null;
$: supportedNips = 
    $nip11?.supportedNips && $nip11.supportedNips.length 
        ? $nip11?.supportedNips 
        : $relayAggregate?.supportedNips
            ? $relayAggregate.supportedNips
            : null;
$: software = 
    $nip11?.software && $nip11.software.length 
        ? $nip11.software 
        : $relayAggregate?.software
            ? $relayAggregate.software
            : null;
$: version = 
    $nip11?.version && $nip11.version.length 
        ? $nip11.version 
        : $relayAggregate?.version
            ? $relayAggregate.version
            : null;
$: fees = 
    $nip11?.fees 
        ? $nip11.fees 
        : $relayAggregate?.fees
            ? $relayAggregate.fees
            : null;
$: paymentUrl = $nip11?.paymentsUrl;

$: items = [
    'general',
    'speed',
    'operator',
    'fees',
    'network',
    'insights',
    'checks',
    'map',
];

$: if ($navigating) { mount(); }

$: showAuditTab = relayUrl && $activeTab === 'audit';


let [minColWidth, maxColWidth, gap] = [400, 800, 21];
let width: number, height: number;
</script>

{#if $componentsLoaded}


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
            <h1 class="copy-this relative">
                <span 
                    class="block -mt-2 relative text-6xl py-2 px-3 text-white rounded-lg cursor-pointer hover:bg-black/50" 
                    use:clickToCopy 
                    use:observeViewport
                    aria-label="Copy relay URL to clipboard"
                    >
                    {relayUrl}
                    </span>
                <span class="copy-message">click to copy relay url</span>
            </h1>
            <p class="text-md italic text-white/80 pl-3 line-clamp-2 w-3/4">{description}</p>
        </div>
    </div>

    <!-- Operator Information -->
    <!-- {#if $operatorProfile && operatorPubkey}
      <div class="py-1 px-2 rounded-lg bg-white/5">
        <span class="text-xs uppercase">operated by:</span>
        <ProfileCompact pubkey={operatorPubkey} profile={$operatorProfile} />
      </div>
    {/if} -->
  </div>
</header>

<main class="flex flex-wrap md:flex-nowrap mx-0 w-full p-0">
    <section class="flex-1  rounded shadow">
        <Tabs.Root value="{$activeTab}" class="w-full p-0">
            <Tabs.List class="w-full rounded-none px-10 py-7">
                <Tabs.Trigger value="overview" class="text-lg flex-grow" on:click={() => activateTab('overview')}>Overview</Tabs.Trigger>
                <Tabs.Trigger value="checks" class="text-lg flex-grow" on:click={() => activateTab('checks')}>Checks</Tabs.Trigger>
                <Tabs.Trigger disabled={$nip11? false: true}  value="nip11" class="text-lg flex-grow" on:click={() => activateTab('nip11')}>NIP-11</Tabs.Trigger>
                <Tabs.Trigger disabled={operatorPubkey && $operatorRelays?.relays?.length? false: true} value="operator-feed" class="text-lg flex-grow" on:click={() => activateTab('operator-feed')}>Operator Feed</Tabs.Trigger>
                <Tabs.Trigger value="audit" class="text-lg flex-grow" on:click={() => activateTab('audit')}>Audits</Tabs.Trigger>
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
                    <CardMap relay={relayUrl} monitors={$monitors} checks={$checksrelay} aggregate={$relayAggregate} />
                {/if}
                {#if item === 'network'}
                     <CardNetwork aggregate={$relayAggregate} />
                {/if}
                {#if item === 'insights'}
                    <CardInsights relayAggregate={$relayAggregate} />
                {/if}
                {#if item === 'checks'}
                    <CardChecks checks={$checksrelay} {activeTab} />
                {/if}
                {#if item === 'general'}
                    <CardGeneral version={version} software={software} geocode={geocode} />
                {/if}
                {#if item === 'fees'}
                    <CardFees {fees} {paymentUrl} />
                {/if}
                {#if item === 'operator'}
                    {#if $operatorProfile && operatorPubkey}
                    <CardOperator {relayUrl} pubkey={operatorPubkey} profile={$operatorProfile} monitors={$monitors} />
                    {/if}
                {/if}
                {#if item === 'speed'}
                    {#if loading === false}
                    <CardSpeed {relayUrl} />
                    {/if}
                {/if}
            </div>
              </Masonry>

            </Tabs.Content>
            <Tabs.Content value="checks" class="py-6">
                <RelayChecks relay={relayUrl} monitors={$monitors} checks={$checksrelay} aggregate={$relayAggregate} />
            </Tabs.Content>
            
            <Tabs.Content value="nip11">
                {$nip11s.get(relayUrl)?.length ?? 0} NIP-11s from NIP-66 events [{$nip11s.get(relayUrl)?.[0]? true: false}] <br />
                {#if $nip11sLocal?.get(relayUrl)}
                    NIP-11 found locally <br />
                {/if}
                <pre class="py-6 px-8 bg-white/5 rounded-lg">{JSON.stringify($nip11?.json, null, 4)}</pre>
            </Tabs.Content>
            <Tabs.Content value="operator-feed">
                {#if operatorPubkey && $activeTab === 'operator-feed'}
                    <OperatorFeed pubkey={operatorPubkey} />
                {/if}
            </Tabs.Content>
            <Tabs.Content value="audit">
                {#if showAuditTab}
                    <RelayAudits {relayUrl} {nip11}  />
                {/if}
            </Tabs.Content>
            </div>
        </Tabs.Root>
    </section>
  </main>

<Stats />

{/if}

<style lang="postcss">
    h1 > .copy-message {
        @apply hidden absolute bg-black/50 text-white text-xs px-1 rounded;
    }

    h1:hover > .copy-message {
        @apply block -top-1;
    }

    #relay-header {
        @apply px-3 py-10 bg-white/5;
    }

    #overview-container > div {
        @apply w-1/2 border;
    }

    .data-\[state\=active\]\:bg-background[data-state="active"] {
        @apply !bg-black/10;
    }

    pre {
        white-space: pre-wrap;       /* Since CSS 2.1 */
        white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
        white-space: -pre-wrap;      /* Opera 4-6 */
        white-space: -o-pre-wrap;    /* Opera 7 */
        word-wrap: break-word;       /* Internet Explorer 5.5+ */
    }
</style>