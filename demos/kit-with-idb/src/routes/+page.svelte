<script lang="ts">
  import { onMount, onDestroy, getContext, setContext } from "svelte";
  import { initRelayData, monitorRelays } from "$lib/fetchers/monitorRelays";
  import RelayTable from "$lib/components/RelayTable.svelte";
  import RelayGrid from "$lib/components/RelayGrid.svelte";

  import type { MonitorManager, RelayMetaSubscriptionHandlers } from "@nostrwatch/kit"

  const signal: EventEmitter = getContext("signal");

  import { relayStore, nip11Store, populateStores, checksStore } from "$lib/stores/index";
  import { EventEmitter } from "tseep"
  import { updateRelayData } from "@nostrwatch/kit-adapter-idb"
  import NDK, { NDKRelayMeta, type NDKEvent } from "@nostr-dev-kit/ndk"
  import { relayMetaToIEvent, type IEvent } from "@nostrwatch/idb"
  import { preferencesStore } from "$lib/stores/index";
  import { countChecksPerRelay } from "$lib/routines/countChecksPerRelay"
  import { NDK_CONTEXT } from "$lib/contextKeys"
  import { updateProfiles } from "$lib/fetchers/profiles"
    import { profileStore } from "$lib/stores/profileStore"

  const ndk: NDK = getContext(NDK_CONTEXT)
  let manager: MonitorManager

  onMount(async () => {
    populateStores()
    await countChecksPerRelay()
    const begin = Date.now()
    const primaryMonitor = $preferencesStore.primaryMonitor
    console.log('primaryMonitor', primaryMonitor)
    manager = await initRelayData(ndk, primaryMonitor)    
    const monitors = Array.from(await manager.monitors)
    const profiles = new Map()
    const relays = new Map()
    for (let i=0; i<monitors.length; i++) {
      const monitor = monitors[i]
      
      profiles.set(monitor.pubkey, monitor.profile)
      // relays.set(monitor.pubkey, monitor.relays.relays)
      console.log('initialized', monitor.initialized)
      // console.log('relays', monitor.pubkey, monitor.relays.relays)
      console.log('profile', monitor.pubkey, monitor.profile)
    }
    profileStore.set(profiles)

    for (let i=0; i<monitors.length; i++) {
      const monitor = monitors[i]
      if(monitor.pubkey !== $preferencesStore.primaryMonitor) continue;
      await monitor.load()
      console.log('profile2', monitor.pubkey, monitor.profile)
      console.log(`${monitor.pubkey}: finished ${ Math.round((Date.now()-begin)/1000) } seconds to complete after load`)

    }
    
    console.log(`finished after ${ Math.round((Date.now()-begin)/1000) } seconds`)
    const callbacks: RelayMetaSubscriptionHandlers = { 
      onEvent: (event: NDKEvent) => {
        const relayMeta = NDKRelayMeta.from(event)
        const ievent: IEvent = relayMetaToIEvent(relayMeta)
        updateRelayData([ievent])
        return {}
      } 
    }

    manager.subscribeToMonitor($preferencesStore.primaryMonitor, {since: Math.round(Date.now()/1000)}, callbacks)
  });

  onDestroy(async()=>{
    manager?.abortAll() 
  })

  $: primaryMonitor = $preferencesStore.primaryMonitor
  $: relays = relayStore;
  $: nip11 = Array.from($nip11Store.keys()).filter(k => k.startsWith(primaryMonitor))
  $: checks = Array.from($checksStore.keys()).filter(k => k.startsWith(primaryMonitor))
</script>

<main>
  <p>Total known: {$relays?.length}</p> 
  <p>Primary Monitor: {primaryMonitor}</p>
  <p>nip11s: {nip11.length}</p> 
  <p>checks: {checks.length}</p> 

  <RelayTable />
</main>
<style>
  th, td { text-align: left; width:10%; }
</style>