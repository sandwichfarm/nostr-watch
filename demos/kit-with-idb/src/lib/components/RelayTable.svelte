<script lang="ts">
  import { relayStore, checksStore, checkStatStore, nip11Store, localCheckStore  } from "$lib/stores/index";
    import RelayTableRow from "./RelayTableRow.svelte"

  $: relays = relayStore;
  $: nip11 = nip11Store
  $: checks = Array.from($checksStore.values())
  $: checkStats = checkStatStore
  $: localChecks = $localCheckStore
</script>

<table>
<thead>
  <tr>
    <th>icon</th>
    <th>name</th>
    <th>Relay</th>
    <th>Seen By</th>
    <th>Last Seen</th>

    <th>Open</th>
    <th>Geohash</th>
    <th>Software</th>
    <th>Version</th>
  </tr>
<tbody>
{#if $relays?.length}
{#each $relays as relay}
  <RelayTableRow relay={relay.relay} /> 
{/each}
{/if}
</tbody>
</table>