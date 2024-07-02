<script lang="ts">
  import { onMount, onDestroy, getContext, setContext } from "svelte";
  
  import { NDKKind, NDKRelayMeta, NDKRelayMonitor } from "@nostr-dev-kit/ndk";
  import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
  import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";

  import type { EventEmitter } from "tseep"

  import RelayTable from "$lib/components/RelayTable.svelte";
  import RelayGrid from "$lib/components/RelayGrid.svelte";

  import { relayMetaStore } from "$lib/stores/relayMeta";
  import { relayMonitorStore } from "$lib/stores/relayMonitor";
  import { primaryMonitor } from "$lib/stores/primaryMonitor";
  import { ndk } from "$lib/stores/ndk";

  import { writable, type Writable } from "svelte/store"

  const signal: EventEmitter = getContext("signal");
  
  onMount(async () => {
    primaryMonitor.set('abcde937081142db0d50d29bf92792d4ee9b3d79a83c483453171a6004711832')

    const cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'event-store' });
    ndk.set(new NDKSvelte({explicitRelayUrls: ['wss://history.nostr.watch'], cacheAdapter}));
    await $ndk.connect()

    relayMonitorStore.set(new Set(Array.from(await $ndk.fetchEvents({ kinds: [NDKKind.RelayMonitor] })).map( e => NDKRelayMonitor.from(e))))
    $relayMonitorStore.forEach(async (monitor: NDKRelayMonitor) => {
      const events = await $ndk.fetchEvents(monitor.nip66Filter([NDKKind.RelayMeta, NDKKind.RelayDiscovery]))
      relayMetaStore.set(new Set<NDKRelayMeta>(Array.from(events).map(e => NDKRelayMeta.from(e))))
    })
  });

  onDestroy(async()=>{
    // clearInterval(intval)
  })
</script>

<main>
  <p>{$relayMetaStore?.length || 0}</p> 
  <RelayTable />
</main>
<style>
  th, td { text-align: left; width:10%; }
</style>