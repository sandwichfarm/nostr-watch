<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { NDKRelayMonitor, NDKRelayMeta, NDKRelayDiscovery } from '@nostr-dev-kit/ndk';
  import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
  import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
  import { MonitorCacheIdbAdapter, RelayCacheIdbAdapter } from "@nostrwatch/kit-adapter-idb";
  import { readable, writable, type Writable } from "svelte/store"
  import { MonitorManager } from "@nostrwatch/kit"
  // import { checksStore } from "$lib/stores"
  import Time from "svelte-time";
  
  let monitors, relaysMeta, relaysDiscovery;
  const selectedMonitor = readable('9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923')
  let ndk: Writable<NDKSvelte> = writable(null)
  
  onMount(async () => {
    // populateChecks()
    const cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'RelayDB2' });
    ndk.set(new NDKSvelte({ explicitRelayUrls: ['wss://history.nostr.watch'], cacheAdapter }));
    $ndk.connect();


    relaysMeta = $ndk.storeSubscribe(
        { kinds: [30066], limit: 50, since: Math.round((Date.now()-1000*60*60)/1000) }, // filter for Highlights with Nostr
        { closeOnEose: false },
        NDKRelayMeta 
    );

    

    // const mm = new MonitorManager(
    //   ndk,
    //   {
    //     monitorCache: new MonitorCacheIdbAdapter(ndk),
    //     relayCache: new RelayCacheIdbAdapter(ndk),
    //   }
    // );
    // const subs = await mm.subscribeToMonitors()
    // console.log('subs', subs)
    // // setInterval(populateChecks , 3000)
  })

  onDestroy(() => {
      monitors?.unsubscribe();
      relaysMeta?.unsubscribe();
  });

  // onDestroy(() => {
  //     monitors?.unsubscribe();
  //     relaysMeta?.unsubscribe();
  // });
  
  // $: checks = Array.from($checksStore).map( check => check[1] ).sort( (a, b) => b.createdAt - a.createdAt)

  $: relays = Array.from($relaysMeta || []).slice(0, 50)
  
</script>
{relays?.length}

<!-- {JSON.stringify(Array.from($checksStore).map( check => check[1] ).sort( (a, b) => b.createdAt - a.createdAt))} -->
{#if relays?.length}
{#each relays as check}
  <!-- {JSON.stringify(check)} -->
  {#if check?.url}
    <code>{check?.pubkey} </code>{check?.url} -> <Time relative title="last seen" timestamp="{check.created_at*1000}" /> <br />
  {/if}
{/each}
{/if}





<!-- <main>
  <p>{$relayStore.length}</p> 

  {JSON.stringify(localChecks)}
  <table>
    <thead>
      <tr>
        <th>Relay</th>
        <th>Last Seen</th>
        <th>Check Count</th>
        <th>Country</th>
        <th>Local Open</th>
        <th>Open</th>
        <th>Geohash</th>
        <th>Software</th>
        <th>Version</th>
      </tr>
    <tbody>
    {#each $relayStore as relay}
      <tr>
        <td>{relay.relay}</td>
        <td>{relay.lastSeen}</td>
        <td>{checkCounts[relay.relay] || ""}</td>
        <td>{checks[relay.relay]?.geocode?.filter(code => isNaN(Number(code)) && code.length === 2) || ""}</td>
        <td>{localChecks[relay.relay]?.open? `${checks[relay.relay].open}ms`: ""}</td>
        <td>{checks[relay.relay]?.open? `${checks[relay.relay].open}ms`: ""}</td>
        <td>{checks[relay.relay]?.geohash || ""}</td>
        <td>{checks[relay.relay]?.software || ""}</td>
        <td>{checks[relay.relay]?.version || ""}</td>
      </tr>
    {/each}
    </tbody>
  </table>
</main> -->



<!-- <style>
  th, td { text-align: left; width:10%; }
</style> -->