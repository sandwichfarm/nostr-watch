
<script lang="ts">
	import { page } from "$app/stores";
	import PageHeader from "$lib/components/layout/PageHeader.svelte";
    import RelaySidebar from './(components)/RelaySidebar.svelte';

	import { relayCheckAggregates } from "$stores/checks";
	import { dataRegister } from "$stores/data-register";
	import { relayLivenessAggregate$, relayLivenessChecks } from "$stores/helpers/helpers-relay";
	import { nip11s, nip11sLocal } from "$stores/nip11s";
	import { route66 } from "$stores/route66";
	import { eventKey } from "$utils/event-keys";
	import { pauseLiveSync } from "$utils/live-sync";
	import { generateRelayPathFromUrl } from "$utils/routing";
	import { truncateWithEllipsis } from "$utils/strings";
	import type { IResult } from "@nostrwatch/nocap";
	import type { NostrEvent } from "@nostrwatch/route66/models";
	import type { Monitor } from "@nostrwatch/route66/models";
	import type { Nip11 } from "@nostrwatch/route66/models";
	import type { Nip66CheckEvent } from "@nostrwatch/route66/models";
	import { onDestroy, onMount, setContext } from "svelte";
	import { derived, writable, type Readable, type Writable } from "svelte/store";
	import { operatorProfile$, operatorRelays$ } from "$stores/helpers/helpers-operator";
	import { isPubkey } from "$utils/nostr";

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
    const localCheck: Writable<IResult | null> = writable(null);

    const lastCheck: Writable<Nip66CheckEvent | undefined> = writable(undefined);
    const lastSeen: Writable<number | null> = writable(null);
    const lastSeenBy: Writable<Monitor | null> = writable(null); 

    // const nocapService: Writable<NocapService> = writable(new NocapService());

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

    const sidebarNavItems = [
		{
			title: "Overview",
			href: `/relays/${generateRelayPathFromUrl(relayUrl).slice(0, -1)}`,
		},
        {
            title: "Insights",
            href: `/relays/${generateRelayPathFromUrl(relayUrl)}insights`,
        },
        {
            title: "Operator",
            href: `/relays/${generateRelayPathFromUrl(relayUrl)}operator`,
        },
        {
			title: "Feed",
			href: `/relays/${generateRelayPathFromUrl(relayUrl)}feed`,
		},
        {
			title: "Checks",
			href: `/relays/${generateRelayPathFromUrl(relayUrl)}checks`,
		},
        {
			title: "NIP-11",
			href: `/relays/${generateRelayPathFromUrl(relayUrl)}nip-11`,
		},
		{
			title: "Audits",
			href: `/relays/${generateRelayPathFromUrl(relayUrl)}audits`
		},
	];

    const mount = async () => {
      if (currentRelay === relayUrl) return;
      await $route66?.ready();
      const resume = await pauseLiveSync()
      await $dataRegister.require(
        [
            'sync:cache', 
            'sync:relay:checks', 
            'sync:relay:nip11', 
            'sync:relay:operator'
        ],
        {
          'sync:relay:checks': [ relayUrl ],
          'sync:relay:nip11': [ relayUrl ],
          'sync:relay:operator': [ relayUrl ]
        }
      );
      loading = false
      await resume();
  };

    const destroy = () => {
        $route66?.services?.relay?.unsubscribeAll();
        $route66?.services?.monitors?.unsubscribeAll();
        if (currentRelay === relayUrl) return;
        loading = true;
        currentRelay = '';
        monitors.set([]);
        nip11Ready.set(false);
        operatorMetaReady.set(false);
        liveness.set(null);
    };

    onMount(mount);
    onDestroy(destroy);

    $: description = $nip11?.description || null;
    $: banner = $nip11?.banner || null;
    $: icon = $nip11?.icon || null;
    $: operatorPubkey =
        $nip11?.pubkey && $nip11.pubkey.length && isPubkey($nip11.pubkey)
            ? $nip11.pubkey
            : $relayAggregate?.operatorPubkey && isPubkey($relayAggregate.operatorPubkey)
                ? $relayAggregate.operatorPubkey
                : null;
    $: operatorProfile = operatorPubkey? operatorProfile$(operatorPubkey): undefined;
    $: operatorRelays = operatorPubkey? operatorRelays$(operatorPubkey): undefined;

    $: relayData = {
        url: relayUrl,
        operator: {
            pubkey: operatorPubkey,
            profile: operatorProfile,
            relays: operatorRelays
        }
    }

    setContext('relayUrl', relayUrl);
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
      <div class="flex-1 pr-10">
        <slot {relayAggregate} />
      </div>
    </div>
</div>