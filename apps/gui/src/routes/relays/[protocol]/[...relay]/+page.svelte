<script lang="ts">
  import { page, navigating } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';
  import { derived, writable, type Readable, type Writable } from 'svelte/store';
  import { Nip66Event, PubkeyProfile, PubkeyRelays, type Monitor, type INip11, type IEvent } from '@nostrwatch/nip66/models';
  import { relayAggregates, relayCheckAggregator } from '$lib/stores/checks.js';
  import { nip11s, nip11Service, nip11sLocal } from '$lib/stores/nip11s.js';
  import { isSeeded } from '$lib/stores/app.js';
  import { eventsArray } from '$lib/stores/events.js';
  import { relaysErrors } from '$lib/stores/relay-errors.js';
  import { isHex } from '$lib/utils/nostr.js';
  import { Nip11 } from '@nostrwatch/nip66/models';
  import { isLivesyncing, doAggregateCache, hasBeenBoostrapped } from '$lib/stores/app';
  import { pauseLiveSync, beginLiveSync } from '$lib/utils/lifecycle';
  import { addEventsToStore } from '$lib/stores/events-helpers';
  import { clickToCopy, observeViewport } from '$lib/utils/ux';
  import { Skeleton } from "$lib/components/ui/skeleton";
	import { nip66Ready } from '$lib/stores/app';
	import { nip66 } from '$lib/stores';


  let ProfileCompact: typeof import('$lib/components/partials/ProfileCompact.svelte').default | null = null;
  let RelayChecks: typeof import('$lib/components/partials/relay-single/RelayChecks.svelte').default | null = null;
  let OperatorFeed: typeof import('$lib/components/partials/relay-single/OperatorFeed.svelte').default | null = null;
  let Tabs: typeof import('$lib/components/ui/tabs').default | null = null;
  let Masonry: typeof import('svelte-bricks').default | null = null;
  let CardChecks: typeof import('$lib/components/partials/relay-single/cards/CardChecks.svelte').default | null = null;
  let CardFees: typeof import('$lib/components/partials/relay-single/cards/CardFees.svelte').default | null = null;
  let CardInsights: typeof import('$lib/components/partials/relay-single/cards/CardInsights.svelte').default | null = null;
  let CardGeneral: typeof import('$lib/components/partials/relay-single/cards/CardGeneral.svelte').default | null = null;
  let CardMap: typeof import('$lib/components/partials/relay-single/cards/CardMap.svelte').default | null = null;
  let CardNetwork: typeof import('$lib/components/partials/relay-single/cards/CardNetwork.svelte').default | null = null;
  let Stats: typeof import('$lib/components/layout/Stats.svelte').default | null = null;
  let CardOperator: typeof import('$lib/components/partials/relay-single/cards/CardOperator.svelte').default | null = null;
  let CardSpeed: typeof import('$lib/components/partials/relay-single/cards/CardSpeed.svelte').default | null = null;
  let CardNips: typeof import('$lib/components/partials/relay-single/cards/CardNips.svelte').default | null = null;
  let RelayAudits: typeof import('$lib/components/partials/relay-single/RelayAudits.svelte').default | null = null;
  let RelayNip11: typeof import('$lib/components/partials/relay-single/RelayNip11.svelte').default | null = null;

  const loadComponent = async (importFunc: () => Promise<any>, setter: (component: any) => void) => {
      try {
          const module = await importFunc();
          setter(module.default || module);
      } catch {
          setter(null);
      }
  };

  const loadComponents = () => {
      loadComponent(() => import('svelte-bricks'), (comp) => Masonry = comp);
      loadComponent(() => import('$lib/components/partials/ProfileCompact.svelte'), (comp) => ProfileCompact = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/RelayChecks.svelte'), (comp) => RelayChecks = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/OperatorFeed.svelte'), (comp) => OperatorFeed = comp);
      loadComponent(() => import('$lib/components/ui/tabs'), (comp) => Tabs = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardChecks.svelte'), (comp) => CardChecks = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardFees.svelte'), (comp) => CardFees = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardInsights.svelte'), (comp) => CardInsights = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardGeneral.svelte'), (comp) => CardGeneral = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardMap.svelte'), (comp) => CardMap = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardNetwork.svelte'), (comp) => CardNetwork = comp);
      loadComponent(() => import('$lib/components/layout/Stats.svelte'), (comp) => Stats = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardOperator.svelte'), (comp) => CardOperator = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardSpeed.svelte'), (comp) => CardSpeed = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/cards/CardNips.svelte'), (comp) => CardNips = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/RelayAudits.svelte'), (comp) => RelayAudits = comp);
      loadComponent(() => import('$lib/components/partials/relay-single/RelayNip11.svelte'), (comp) => RelayNip11 = comp);
  };

  doBootstrap.set(false);
  doAggregateCache.set(false);

  export let params: { protocol: string; relay: string };
  let currentRelay: string = '';
  let loading: boolean = true;
  
  const nip11Ready: Writable<boolean> = writable(false);
  const operatorMetaReady: Writable<boolean> = writable(false);
  const operatorProfile: Writable<PubkeyProfile | null> = writable(null);
  const operatorRelays: Writable<PubkeyRelays | null> = writable(null);
  const monitors: Writable<Monitor[]> = writable([]);
  const activeTab: Writable<string> = writable('overview');

  const checksrelay: Readable<Nip66Event[]> = derived(
      eventsArray,
      ($eventsArray) => {
          const results = new Map<string, Nip66Event>();
          if ($eventsArray.length) {
              $eventsArray.forEach((check: Nip66Event) => {
                  if (!check.relay) return console.error('Invalid check:', check);
                  if (check.relay !== relayUrl) return;
                  if (!results.has(check.pubkey)) {
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
          return undefined;
      }
  );

  const loadRelayData = async () => {
      destroy();
      await nip66Ready()
      loadNip11().then(loadOperatorMeta)
      if (!$isLivesyncing) {
          $nip66?.services?.relay?.getRelayData(relayUrl).then( (res: any) => {
            if (!res) return;
            const [data, mons] = res;
            addEventsToStore(data);
            monitors.set(Array.from(mons?.values() || new Set()));
          })
      }
      
      loading = false;
      currentRelay = relayUrl;
  };

  const loadNip11 = async () => {
      await $nip11Service.check(relayUrl)
      nip11Ready.set(true);
  };

  const loadOperatorMeta = async () => {
    //console.log('loadOperatorMeta')
    const begin = Date.now();
      if (!operatorPubkey) return operatorMetaReady.set(true);
      let count = 0
      const onevent = (event: IEvent) => {
        //console.log('loadOperatorMeta', 'event', count, Date.now() - begin)
        count++;
        if (event.kind === 0) {
          if($operatorProfile === null) {
            operatorProfile.set(new PubkeyProfile(event));
          }
          else if($operatorProfile && event?.created_at && $operatorProfile?.created_at && $operatorProfile!.created_at < event?.created_at) {
            operatorProfile.set(new PubkeyProfile(event));
          }
        }
        if (event.kind === 10002 && !$operatorRelays) {
          if($operatorRelays === null) {
            operatorRelays.set(new PubkeyRelays(event));
          }
          else if($operatorRelays && event?.created_at && $operatorRelays?.created_at && $operatorRelays!.created_at < event?.created_at) {
            operatorRelays.set(new PubkeyRelays(event));
          }
        }
      };
      const onevents = (events: IEvent[]) => events.forEach( onevent )
      $nip66?.services?.relay?.fetchOperatorMeta(operatorPubkey, { onevent, onevents });
      while($operatorProfile === null || $operatorRelays === null) {
          await new Promise(resolve => setTimeout(resolve, 100));
      }
      operatorMetaReady.set(true)
      //console.log('loadOperatorMeta', 'done', Date.now() - begin)
  };

  const mount = async () => {
      if (currentRelay === relayUrl) return;
      const resume = await pauseLiveSync()
      loadComponents();
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      if (hasBeenBoostrapped()) {
          while (!isSeeded) {
              await new Promise(resolve => setTimeout(resolve, 100));
          }
      }
      loadRelayData().then(() => {
          resume();
      });
  };

  const destroy = () => {
      if (currentRelay === relayUrl) return;
      $nip66?.services?.relay?.unsubscribeAll();
      loading = true;
      currentRelay = '';
      monitors.set([]);
      operatorProfile.set(null);
      operatorRelays.set(null);
  };

  onMount(mount);
  onDestroy(destroy);

  $: relayUrl = new URL(`${$page.params.protocol}://${$page.params.relay}`).toString();
  $: geocode = $relayAggregate?.geocode;
  $: description = $nip11?.description || null;
  $: banner = $nip11?.banner || null;
  $: icon = $nip11?.icon || null;
  $: operatorPubkey =
      $nip11?.pubkey && $nip11.pubkey.length && isHex($nip11.pubkey)
          ? $nip11.pubkey
          : $relayAggregate?.operatorPubkey && isHex($relayAggregate.operatorPubkey)
              ? $relayAggregate.operatorPubkey
              : null;
  $: supportedNips =
      $nip11?.supportedNips?.length
          ? $nip11.supportedNips
          : $relayAggregate?.supportedNips
              ? $relayAggregate.supportedNips
              : null;
  $: software =
      $nip11?.software?.length
          ? $nip11.software
          : $relayAggregate?.software
              ? $relayAggregate.software
              : null;
  $: version =
      $nip11?.version?.length
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
      'nips',
      'network',
      'insights',
      'checks',
      'map',
  ];

  $: if ($navigating) { mount(); }

  $: showAuditTab = relayUrl && $activeTab === 'audit';

  $: errors = $relaysErrors?.get(relayUrl)

  let [minColWidth, maxColWidth, gap] = [400, 800, 21];
  let width: number, height: number;
</script>

<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat h-48"
  style={banner? `background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)),  url('${banner}'); 
          background-repeat: no-repeat; 
          background-size: cover;`: ''}
>
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
  </div>
</header>

<main class="flex flex-wrap md:flex-nowrap mx-0 w-full p-0">
  <section class="flex-1 rounded shadow">
    {#if Tabs}
      <Tabs.Root value={$activeTab} class="w-full p-0">
        <Tabs.List class="w-full rounded-none px-10 py-7">
          <Tabs.Trigger value="overview" class="text-lg flex-grow" on:click={() => activeTab.set('overview')}>Overview</Tabs.Trigger>
          <Tabs.Trigger value="checks" class="text-lg flex-grow" on:click={() => activeTab.set('checks')}>Checks</Tabs.Trigger>
          <Tabs.Trigger disabled={!$nip11} value="nip11" class="text-lg flex-grow" on:click={() => activeTab.set('nip11')}>NIP-11</Tabs.Trigger>
          <Tabs.Trigger disabled={!(operatorPubkey && $operatorRelays?.relays?.length)} value="operator-feed" class="text-lg flex-grow" on:click={() => activeTab.set('operator-feed')}>Operator Feed</Tabs.Trigger>
          <Tabs.Trigger value="audit" class="text-lg flex-grow" on:click={() => activeTab.set('audit')}>Audits</Tabs.Trigger>
        </Tabs.List>
        <div class="p-4">
          {#if Tabs && Masonry}
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
                    {#if CardMap}
                      <CardMap relay={relayUrl} {monitors} checks={checksrelay} aggregate={$relayAggregate} />
                    {:else}
                      <Skeleton class="h-48 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'network'}
                    {#if CardNetwork}
                      <CardNetwork aggregate={$relayAggregate} />
                    {:else}
                      <Skeleton class="h-32 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'insights'}
                    {#if CardInsights}
                      <CardInsights relayAggregate={$relayAggregate} />
                    {:else}
                      <Skeleton class="h-40 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'nips'}
                  
                    {#if CardNips && supportedNips}
                      <CardNips {supportedNips} />
                    {:else}
                      {#if errors?.get('nip11')?.length}
                      <div><ul>
                        {#each errors?.get('nip11') as nip11Error}
                          <li>{nip11Error}</li>
                        {/each}
                      </ul> </div>
                      {:else}
                        <!-- <Skeleton class="h-40 w-full" /> -->
                      {/if}
                    {/if}
                  {/if}
                  {#if item === 'checks'}
                    {#if CardChecks}
                      <CardChecks checks={$checksrelay} {activeTab} />
                    {:else}
                      <Skeleton class="h-36 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'general'}
                    {#if CardGeneral}
                      <CardGeneral version={version} software={software} geocode={geocode} />
                    {:else}
                      <Skeleton class="h-24 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'fees'}
                    {#if CardFees}
                      <CardFees {fees} {paymentUrl} />
                    {:else}
                      <Skeleton class="h-24 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'operator'}
                    {#if CardOperator && $operatorProfile && operatorPubkey}
                      <CardOperator {relayUrl} pubkey={operatorPubkey} profile={$operatorProfile} monitors={$monitors} />
                    {:else if !$operatorMetaReady}
                      <Skeleton class="h-36 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'speed'}
                    {#if CardSpeed && !loading}
                      <CardSpeed {relayUrl} />
                    {:else}
                      <Skeleton class="h-24 w-full" />
                    {/if}
                  {/if}
                </div>
              </Masonry>
            </Tabs.Content>
          {/if}

          {#if Tabs && RelayChecks && $relayAggregate}
            <Tabs.Content value="checks" class="py-6">
              <RelayChecks relay={relayUrl} {monitors} checks={checksrelay} aggregate={$relayAggregate} />
            </Tabs.Content>
          {/if}


          {#if Tabs && RelayNip11 && $nip11Ready}
          <Tabs.Content value="nip11">
            <!-- {$nip11s.get(relayUrl)?.length ?? 0} NIP-11s from NIP-66 events [{$nip11s.get(relayUrl)?.[0] ? true : false}] <br /> -->
            <!-- {#if $nip11sLocal?.get(relayUrl)}
              NIP-11 found locally <br />
            {/if} -->
            <!-- <pre class="py-6 px-8 bg-white/5 rounded-lg">
              {JSON.stringify($nip11?.json, null, 4)}
            </pre> -->
            <RelayNip11 {nip11} />
          </Tabs.Content>
          {/if}

          
          <Tabs.Content value="operator-feed">
              {#if OperatorFeed && operatorPubkey && $activeTab === 'operator-feed'}
              <OperatorFeed pubkey={operatorPubkey} />
              {/if}
          </Tabs.Content>
          

          {#if RelayAudits}
            <Tabs.Content value="audit">
              {#if showAuditTab && $nip11Ready}
                <RelayAudits {relayUrl} {nip11} />
              {:else}
                <Skeleton class="h-32 w-full" />
              {/if}
            </Tabs.Content>
          {/if}
        </div>
      </Tabs.Root>
    {/if}
  </section>
</main>

{#if Stats}
  <Stats />
{/if}

<style lang="postcss" global>
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
        white-space: pre-wrap;
        white-space: -moz-pre-wrap;
        white-space: -pre-wrap;
        white-space: -o-pre-wrap;
        word-wrap: break-word;
    }

    body .relay-card {
        @apply bg-white/5;
    }
</style>
