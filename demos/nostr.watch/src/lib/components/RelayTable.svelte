<script lang="ts">
  import { NDKKind, NDKRelayMonitor } from "@nostr-dev-kit/ndk"
  import { onMount } from "svelte"
  
  import { ndk } from "$lib/stores/ndk";
  import { primaryMonitor } from "$lib/stores/primaryMonitor";
  import { relayMonitorStore } from "$lib/stores/relayMonitor";
  import { relayMetaStore  } from "$lib/stores/relayMeta";
    
  import RelayTableRow from "./RelayTableRow.svelte"

  let relays

  onMount( async () => {
    const events = (await $ndk?.fetchEvents({ kinds: [NDKKind.RelayMonitor] }))
    if(!events) return
    const monitors = Array.from(events).map( e => NDKRelayMonitor.from(e) )
    const monitor = monitors.find( e => e.pubkey = $primaryMonitor)
    relays = $ndk?.storeSubscribe(monitor.nip66Filter([NDKKind.RelayMeta]), { closeOnEose: false })
  });
</script>

<table>
<thead>
  <tr>
    <th>icon</th>
    <th>name</th>
    <th>Relay</th>
    <th>Last Seen</th>
    <th>Seen By</th>
    <th>Open</th>
    <th>Geohash</th>
    <th>Software</th>
    <th>Version</th>
  </tr>
<tbody>
  {$relays?.length}
{#if $relays?.length}
{#each $relays as relay}
  <RelayTableRow relay={relay} /> 
{/each}
{/if}
</tbody>
</table>