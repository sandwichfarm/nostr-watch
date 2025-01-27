<script lang="ts">
  import { page, navigating } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';
  import { derived, writable, type Readable, type Writable } from 'svelte/store';
  import { Nip66CheckEvent, type Monitor, type INip11, type IEvent } from '@nostrwatch/route66/models';
  import { relayCheckAggregates } from '$lib/stores/checks.js';
  import { nip11s, nip11Service, nip11sLocal } from '$lib/stores/nip11s.js';
  import { isSeeded } from '$lib/stores/app.js';
  import { relaysErrors } from '$lib/stores/relay-errors.js';
  import { isHex } from '$lib/utils/nostr.js';
  import { Nip11 } from '@nostrwatch/route66/models';
  import { isLivesyncing, doAggregateCache, hasBeenBoostrapped } from '$lib/stores/app';
  import { pauseLiveSync, beginLiveSync } from '$lib/utils/lifecycle';
  import { publishEventsToMemoryRelay } from '$lib/stores/events-helpers';
  import { clickToCopy, observeViewport } from '$lib/utils/ux';
  import { Skeleton } from "$lib/components/ui/skeleton";
	import { route66Ready } from '$lib/stores/app';
	import { route66 } from '$lib/stores';
	import { timeAgo } from '$lib/utils/time';
	import { operatorProfile$, operatorRelays$ } from '$lib/stores/helpers/helpers-operator';
	import { NocapService } from '$lib/services/NocapService';
	import { relayLivenessAggregate, relayLivenessAggregate$, relayLivenessChecks, relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
	import { eventKey } from '$utils/event-keys';
	import { NostrEvent } from '@nostrwatch/route66/models';
	

  let ProfileCompact: typeof import('$lib/components/partials/ProfileCompact.svelte').default | null = null;
  let RelayChecks: typeof import('$routes/relays/[protocol]/[...relay]/components/RelayChecks.svelte').default | null = null;
  let OperatorFeed: typeof import('./components/RelayOperatorFeed.svelte').default | null = null;
  let Tabs: typeof import('$lib/components/ui/tabs').default | null = null;
  let Masonry: typeof import('svelte-bricks').default | null = null;
  let CardChecks: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardChecks.svelte').default | null = null;
  let CardFees: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardFees.svelte').default | null = null;
  let CardInsights: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardInsights.svelte').default | null = null;
  let CardGeneral: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardGeneral.svelte').default | null = null;
  let CardMap: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardMap.svelte').default | null = null;
  let CardNetwork: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardNetwork.svelte').default | null = null;
  let Stats: typeof import('$lib/components/layout/Stats.svelte').default | null = null;
  let CardOperator: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardOperator.svelte').default | null = null;
  let CardSpeed: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardSpeed.svelte').default | null = null;
  let CardNips: typeof import('$routes/relays/[protocol]/[...relay]/components/cards/CardNips.svelte').default | null = null;
  let RelayAudits: typeof import('$routes/relays/[protocol]/[...relay]/components/RelayAudits.svelte').default | null = null;
  let RelayNip11: typeof import('$routes/relays/[protocol]/[...relay]/components/RelayNip11.svelte').default | null = null;

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
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/RelayChecks.svelte'), (comp) => RelayChecks = comp);
      loadComponent(() => import('./components/RelayOperatorFeed.svelte'), (comp) => OperatorFeed = comp);
      loadComponent(() => import('$lib/components/ui/tabs'), (comp) => Tabs = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardChecks.svelte'), (comp) => CardChecks = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardFees.svelte'), (comp) => CardFees = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardInsights.svelte'), (comp) => CardInsights = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardGeneral.svelte'), (comp) => CardGeneral = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardMap.svelte'), (comp) => CardMap = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardNetwork.svelte'), (comp) => CardNetwork = comp);
      loadComponent(() => import('$lib/components/layout/Stats.svelte'), (comp) => Stats = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardOperator.svelte'), (comp) => CardOperator = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardSpeed.svelte'), (comp) => CardSpeed = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/cards/CardNips.svelte'), (comp) => CardNips = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/RelayAudits.svelte'), (comp) => RelayAudits = comp);
      loadComponent(() => import('$routes/relays/[protocol]/[...relay]/components/RelayNip11.svelte'), (comp) => RelayNip11 = comp);
  };

  const env = import.meta.env.MODE;

  doBootstrap.set(false);
  doAggregateCache.set(false);

  export let params: { protocol: string; relay: string };
  let currentRelay: string = '';
  let loading: boolean = true;

  const relayUrl = new URL(`${$page.params.protocol}://${$page.params.relay}`).toString();
  
  const nip11Ready: Writable<boolean> = writable(false);
  const operatorMetaReady: Writable<boolean> = writable(false);
  const monitors: Writable<Monitor[]> = writable([]);
  const activeTab: Writable<string> = writable('overview');

  const liveness: Writable<null | 'online' | 'offline' | 'dead' | 'unknown'> = writable(null);
  const oldChecks: Writable<Nip66CheckEvent[]> = writable([]);

  const relayIsOffline: Writable<boolean> = writable(false);
  const relayIsDead: Writable<boolean> = writable(false);
  const relayIsUnknown: Writable<boolean> = writable(false);
  const lastCheck: Writable<Nip66CheckEvent | undefined> = writable(undefined);
  const lastSeen: Writable<number | null> = writable(null);
  const lastSeenBy: Writable<Monitor | null> = writable(null); 

  const deduplicateEvents = ( events: NostrEvent[] ) => {
    const deduped = new Map();
    events.forEach( event => {
      const key = eventKey(event);
      deduped.set(key, event);
    });
    return Array.from(deduped.values());
  }

  const relayAggregate: Readable<any | undefined> = relayLivenessAggregate$(relayUrl);
  const relayChecks: Readable<Nip66CheckEvent[]> = derived([oldChecks, relayCheckAggregates], ([$oldChecks]) => {
    const checks = relayLivenessChecks(relayUrl)
    if($oldChecks.length) {
      return deduplicateEvents([...$oldChecks, ...checks]);
    }
    return relayLivenessChecks(relayUrl);
  })

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
    destroy()

    await route66Ready()
    await $route66.services.relay.ready()
    
    await detectLiveness();
    await loadNip11().then(loadOperatorMeta)
    

    loading = false

    if ($isLivesyncing) {
      currentRelay = relayUrl
      return
    }
  }

  const detectLiveness = async () => {
    if($relayChecks.length) {
      liveness.set('online')
      const latestEvent = $relayChecks.sort((a, b) => b.created_at - a.created_at)[0]
      lastCheck.set(latestEvent)
      lastSeen.set(latestEvent?.created_at ?? null)
      return;
    }

    const getRelayData = async (type = 'online') => {
      const res = await $route66?.services?.relay?.getRelayData(relayUrl, type)
      return res
    }

    try {
      const onlineRes = await getRelayData('online')
      if (onlineRes?.[0]?.length) {
        const [data, mons] = onlineRes
        const latestEvent = data.sort((a, b) => b.created_at - a.created_at)[0]
        lastCheck.set(latestEvent)
        lastSeen.set(latestEvent?.created_at ?? null)
        lastSeenBy.set(mons.get(latestEvent?.pubkey ?? null))
        liveness.set('online')
        return
      }

      // console.log('no online checks')

      const nocap = new NocapService({ timeouts: { open: 5000 }}) 
      const result = await nocap.check(relayUrl, ['open'])
      let onlineButNoRecentData = false;

      // console.log(result)

      if(result?.open?.data){
        liveness.set('online')
        onlineButNoRecentData = true;
        let sk = generateSecretKey()
        let pubkey = getPublicKey(generateSecretKey())
        const unsignedEvent = {
          kind: 30166,
          created_at: Math.floor(Date.now()/1000),
          content: JSON.stringify(result.info.data),
          tags: [ 
            ['rtt-open', `${result.open.duration}`], 
            ['network', 'clearnet']
          ]
        }
        const ivp4s = result.dns.data.ipv4
        const ivp6s = result.dns.data.ipv6
        if(ivp4s.length){
          ivp4s.forEach( ipv4 => {
            unsignedEvent.tags.push(['l', ipv4, 'ipv4'])
          })
        }
        if(ivp6s.length){
          ivp6s.forEach( ipv6 => {
            unsignedEvent.tags.push(['l', ipv6, 'ipv6'])
          })
        }
        const event = finalizeEvent(unsignedEvent, sk)
        oldChecks.update( (old: Nip66CheckEvent[]) => [...old, event] )
      }


      const offlineRes = await getRelayData('offline')
      if (offlineRes?.[0]?.length) {
        const [data, mons] = offlineRes
        const latestEvent = data.sort((a, b) => b.created_at - a.created_at)[0]
        oldChecks.set(data)
        lastCheck.set(latestEvent)
        lastSeen.set(latestEvent?.created_at ?? null)
        lastSeenBy.set(mons.get(latestEvent?.pubkey ?? null))
        liveness.set('offline')
        return
      }

      // console.log('no offline checks')

      const deadRes = await getRelayData('dead')
      if (!deadRes?.[0]?.length) {
        relayIsUnknown.set(true)
      } else {
        const [data, mons] = deadRes
        const latestEvent = data.sort((a, b) => b.created_at - a.created_at)[0]
        oldChecks.set(data)
        lastCheck.set(latestEvent)
        lastSeen.set(latestEvent?.created_at ?? null)
        lastSeenBy.set(mons.get(latestEvent?.pubkey ?? null))
        liveness.set('dead')
        return 
      }

      // console.log('no dead checks')

      liveness.set('unknown')
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
      currentRelay = relayUrl
    }
  }

  const loadOfflineChecks = async () => {
      if (!$isLivesyncing) {
          $route66?.services?.relay?.getOfflineChecks(relayUrl).then( (res: any) => {
            if (!res) return;
            const [data, mons] = res;
            publishEventsToMemoryRelay(data);
            monitors.set(Array.from(mons?.values() || new Set()));
          })
      }
  };

  const loadDeadChecks = async () => {
      if (!$isLivesyncing) {
          $route66?.services?.relay?.getOfflineChecks(relayUrl).then( (res: any) => {
            if (!res) return;
            const [data, mons] = res;
            publishEventsToMemoryRelay(data);
            monitors.set(Array.from(mons?.values() || new Set()));
          })
      }
  };

  const loadNip11 = async () => {
      await $nip11Service.check(relayUrl)
      nip11Ready.set(true);
  };

  const loadOperatorMeta = async () => {
    ////console.log('loadOperatorMeta')
    const begin = Date.now();
      if (!operatorPubkey) return operatorMetaReady.set(true);
      let count = 0

      const onevent = (event: IEvent) => {
        ////console.log('loadOperatorMeta', 'event', count, Date.now() - begin)
        count++;
        if (event.kind === 0) {
          publishEventsToMemoryRelay([event])
        }
        if (event.kind === 10002) {
          publishEventsToMemoryRelay([event])
        }
      };
      const onevents = (events: IEvent[]) => events.forEach( onevent )
      $route66?.services?.relay?.fetchOperatorMeta(operatorPubkey, { onevent, onevents }, [relayUrl]);
      while($operatorProfile === null || $operatorRelays === null) {
          await new Promise(resolve => setTimeout(resolve, 100));
      }
      operatorMetaReady.set(true)
      ////console.log('loadOperatorMeta', 'done', Date.now() - begin)
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
      // //console.log('nip11 from cache', await $route66?.adapters?.cache?.getNip11(relayUrl));
  };

  const destroy = () => {
      $route66?.services?.relay?.unsubscribeAll();
      $route66?.services?.monitors?.unsubscribeAll();
      if (currentRelay === relayUrl) return;
      loading = true;
      currentRelay = '';
      monitors.set([]);
      // operatorProfile.set(null);
      // operatorRelays.set(null);
      nip11Ready.set(false);
      operatorMetaReady.set(false);
      relayIsOffline.set(false);
      relayIsDead.set(false);
      relayIsUnknown.set(false);
  };

  onMount(mount);
  onDestroy(destroy);

  $: lastSeenAgo = $lastSeen? timeAgo($lastSeen*1000): '';
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
  $: operatorProfile = operatorPubkey? operatorProfile$(operatorPubkey): undefined;
  $: operatorRelays = operatorPubkey? operatorRelays$(operatorPubkey): undefined;
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

  $: protocolsMatch = $page.params.protocol === 'wss' && location.protocol.replace(':', '') === 'https' 
                      || $page.params.protocol === 'ws' && location.protocol.replace(':', '') === 'http' 

  $: probablyOnline = $liveness === 'online';

  let [minColWidth, maxColWidth, gap] = [400, 800, 21];
  let width: number, height: number;
</script>

<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat h-48 px-3 py-10 bg-black/20 dark:!bg-white/5"
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
            class="block -mt-2 relative text-black/50 dark:text-white text-6xl py-2 px-3 rounded-lg cursor-pointer hover:bg-white/50 hover:dark:bg-black/50" 
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

{#if probablyOnline}
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
                      <CardMap relay={relayUrl} {monitors} checks={relayChecks} aggregate={$relayAggregate} />
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
                      <CardChecks checks={$relayChecks} {activeTab} />
                    {:else}
                      <Skeleton class="h-36 w-full" />
                    {/if}
                  {/if}
                  {#if item === 'general'}
                    {#if CardGeneral}
                      <CardGeneral {relayUrl} checks={$relayChecks} version={version} software={software} geocode={geocode} />
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
                    {#if protocolsMatch || env === 'development'}
                      {#if CardSpeed && !loading}
                        <CardSpeed {relayUrl} />
                      {:else}
                        <Skeleton class="h-24 w-full" />
                      {/if}
                    {/if}
                  {/if}
                </div>
              </Masonry>
            </Tabs.Content>
          {/if}

          {#if Tabs && RelayChecks && $relayAggregate}
            <Tabs.Content value="checks" class="py-6">
              <RelayChecks relay={relayUrl} {monitors} checks={relayChecks} aggregate={$relayAggregate} />
            </Tabs.Content>
          {/if}


          {#if Tabs && RelayNip11 && $nip11Ready}
          <Tabs.Content value="nip11">
            <!-- {$nip11s.get(relayUrl)?.length ?? 0} NIP-11s from NIP-66 events [{$nip11s.get(relayUrl)?.[0] ? true : false}] <br /> -->
            <!-- {#if $nip11sLocal?.get(relayUrl)}
              NIP-11 found locally <br />
            {/if} -->
            <!-- <pre class="py-6 px-8 bg-black/5 dark:bg-white/5 rounded-lg">
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

{:else}
  <div class="flex flex-col text-center items-center justify-center h-[600px]">
    <span class="text-2xl text-center">
    {#if $liveness === null}
      looking for proof of life.
    {:else if $liveness === 'offline'}
      <span class="block text-lg mb-2">Relay may be offline</span>
      <span class="block text-md">It was last seen {lastSeenAgo}</span>
    {:else if $liveness === 'dead'}
      <span class="text-9xl">☠️</span>
      <span class="block text-lg mb-2">Relay is dead</span>
      <span class="block text-md">It was last seen {lastSeenAgo}</span>
    {:else if $liveness === 'unknown'}
      <span class="block">Nobody has ever reported information on this relay</span>
    {:else}
      <span class="block">loading</span>
    {/if}
    </span>
  </div>
{/if}

<!-- {#if Stats}
  <Stats />
{/if} -->

<style lang="postcss">

    h1 > .copy-message {
        @apply hidden absolute bg-black/50 dark:bg-white/50 text-white dark:text-black text-xs px-1 rounded;
    }

    h1:hover > .copy-message {
        @apply block -top-1;
    }

    #overview-container > div {
        @apply w-1/2 border;
    }

    .data-\[state\=active\]\:bg-background[data-state="active"] {
        @apply !bg-black/10 dark:!bg-white/10;
    }

    pre {
        white-space: pre-wrap;
        white-space: -moz-pre-wrap;
        white-space: -pre-wrap;
        white-space: -o-pre-wrap;
        word-wrap: break-word;
    }

    body .relay-card {
        @apply bg-white/5 dark:!bg-black/10;
    }
</style>
