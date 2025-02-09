
<script lang="ts">
	import { page } from "$app/stores";
	import PageHeader from "$lib/components/layout/PageHeader.svelte";
  import RelaySidebar from './(components)/RelaySidebar.svelte';

	import { dataRegister } from "$stores/data-register";
	import { relayLivenessAggregate$, relayLivenessChecks, relayOperatorPubkey$ } from "$stores/helpers/helpers-relay";
	import { route66 } from "$stores/route66";
	import { pauseLiveSync, stopRelayLiveSync, type LiveSyncResumer } from "$utils/live-sync";
	import { generateRelayPathFromUrl, generateRelayUrlFromPath } from "$utils/routing";
	import { truncateWithEllipsis } from "$utils/strings";
	import type { PubkeyProfile } from "@nostrwatch/route66/models";
	import type { Nip11 } from "@nostrwatch/route66/models";
	import { onDestroy, onMount } from "svelte";
	import { derived, readable, type Readable } from "svelte/store";
	import { operatorProfile$, operatorRelays$ } from "$stores/helpers/helpers-operator";
	import { relayNip11$ } from "$stores/helpers/helpers-nip11s";
	import { fade } from "svelte/transition";

  import {nip11ValidationErrorCount} from "$stores/nip11-validations";

  $: pathname = $page.url

  let currentRelay: string = '';
  let loading: boolean = true;

  const relayUrl = generateRelayUrlFromPath() as string;

  // const nip11Ready: Writable<boolean> = writable(false);
  // const operatorMetaReady: Writable<boolean> = writable(false);
  // const monitors: Writable<Monitor[]> = writable([]);

  // const liveness: Writable<null | 'online' | 'offline' | 'dead' | 'unknown'> = writable(null);
  // const oldChecks: Writable<Nip66CheckEvent[]> = writable([]);

  // const nocapService: Writable<NocapService> = writable(new NocapService());

  // const deduplicateEvents = ( events: NostrEvent[] ) => {
  // const deduped = new Map();
  // events.forEach( event => {
  //     const key = eventKey(event);
  //     deduped.set(key, event);
  // });
  // return Array.from(deduped.values());
  // }

  
  // const relayChecks: Readable<Nip66CheckEvent[]> = derived([oldChecks, relayCheckAggregates], ([$oldChecks]) => {
  //     const checks = relayLivenessChecks(relayUrl)
  //     if($oldChecks.length) {
  //         return deduplicateEvents([...$oldChecks, ...checks]);
  //     }
  //     return relayLivenessChecks(relayUrl);
  // })
  let relayAggregate: Readable<any | undefined> = readable(undefined)
  let nip11: Readable<Nip11 | undefined> = readable(undefined);
  let operatorPubkey: Readable<string | undefined> = readable(undefined);
  let operatorProfile: Readable<PubkeyProfile | undefined> = readable(undefined);
  let operatorRelays: Readable<string[] | undefined> = readable(undefined);

  const sidebarNavItems = derived(nip11ValidationErrorCount, $nip11ValidationErrorCount => {
    return [
      {
        title: "Overview",
        href: `/relays/${generateRelayPathFromUrl(relayUrl)}`,
      },
      {
        title: "Checks",
        href: `/relays/${generateRelayPathFromUrl(relayUrl)}/checks`
      },
      {
        title: "NIP-11",
        href: `/relays/${generateRelayPathFromUrl(relayUrl)}/nip-11`,
        errorCount: $nip11ValidationErrorCount.get(relayUrl)
      },
      {
        title: "Audit",
        href: `/relays/${generateRelayPathFromUrl(relayUrl)}/audits`
      },
      {
        title: "Insights",
        // href: `/relays/${generateRelayPathFromUrl(relayUrl)}/insights`,
      },
      {
        title: "Operator",
        // href: `/relays/${generateRelayPathFromUrl(relayUrl)}/operator`,
      },
      {
        title: "Feed",
        // href: `/relays/${generateRelayPathFromUrl(relayUrl)}/feed`,
      },
    ];
  });

  let hasSynced = false;

  const sync = async () => {
      if(hasSynced) return;
      await $route66?.ready();
      await $dataRegister.require(
          [
              'sync:cache', 
              'sync:relay:checks', 
              'sync:relay:nip11', 
              'sync:relay:operator',
              'sync:relay:live'
          ],
          {
              'sync:relay:checks': [ relayUrl ],
              'sync:relay:nip11': [ relayUrl ],
              'sync:relay:operator': [ relayUrl ],
              'sync:relay:live': [ relayUrl ]
          }
      );
      hasSynced = true;
  }

  const mount = () => {
    // doLiveSync.set(true);
    if (currentRelay === relayUrl) return;
    
    let resume: LiveSyncResumer;
    pauseLiveSync().then( (r) => resume = r);
    sync().then( () => {
      nip11 = relayNip11$(relayUrl);
      operatorPubkey = relayOperatorPubkey$(relayUrl);
      if($operatorPubkey) {
        operatorProfile = operatorProfile$($operatorPubkey);
        operatorRelays = operatorRelays$($operatorPubkey);
      }
      relayAggregate = relayLivenessAggregate$(relayUrl);
      loading = false
    })
    return () => {
      stopRelayLiveSync();
      resume();
    }
    };

    relayNip11$

  const destroy = () => {
      if (currentRelay === relayUrl) return;
      loading = true;
      // doLiveSync.set(false);
      // currentRelay = '';
      // monitors.set([]);
      // nip11Ready.set(false);
      // operatorMetaReady.set(false);
      // liveness.set(null);
  };

  onMount(mount);
  onDestroy(destroy);

  $: description = $nip11?.description || null;
  $: banner = $nip11?.banner || null;
  $: icon = $nip11?.icon || null;4

  // $: relayData = {
  //     url: relayUrl,
  //     operator: {
  //         pubkey: $operatorPubkey,
  //         profile: $operatorProfile,
  //         relays: $operatorRelays
  //     }
  // }

  // setContext('relayUrl', relayUrl);
</script>

<PageHeader
  title={relayUrl} 
  subtitle={description? truncateWithEllipsis(description, 100): undefined} 
  icon={icon? icon: undefined} 
  banner={banner? banner: undefined}
  bgOpacity={0.2} 
/>

<div class="hidden space-y-6 py-10 px-4 pb-16 md:block">
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 gap-8">
      <aside class="-ml-10 lg:w-1/6">
        <RelaySidebar items={sidebarNavItems} class="hidden lg:block" />
      </aside>
      {#key pathname}
      <div 
        class="flex-1 pr-10" 
        in:fade={{ duration: 300, delay: 400 }} 
        out:fade={{ duration: 150 }}
        >
        <slot {relayAggregate} />
      </div>
      {/key}
    </div>
</div>