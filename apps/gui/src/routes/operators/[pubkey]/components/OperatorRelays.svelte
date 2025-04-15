<script lang="ts">
	import { operatorRelaysOperatedAggregate$ } from "$stores/helpers/helpers-operator";
	import { onMount } from "svelte";
	import { writable, type Readable, type Writable } from "svelte/store";

  import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
  import { default as relaysTableConfig } from '$lib/config/dataTable/relays.js';
  import RelayDataViewShortcut from '$lib/components/shortcuts/RelayDataViewShortcut.svelte';
  import DataView from '$lib/components/data-view/DataViewRoot.svelte';

  export let pubkey: string;

  const config = writable({...defaultDataTableConfig, ...relaysTableConfig})
  const dataKey = 'operator-relays'

  let operatorRelayAggregates: Readable<any[] | undefined>;


  onMount(() => {
    operatorRelayAggregates = operatorRelaysOperatedAggregate$(pubkey)
    
  })

  $: relaysCount = $operatorRelayAggregates?.length

  let activeView: Writable<'table' | 'map' | 'grid'> = writable('table');
</script>


<div>
  <h2>Relay List</h2>
  {#if $operatorRelayAggregates}
    <DataView 
      data={operatorRelayAggregates as Readable<any[]>} 
      {config} 
      key={dataKey} 
      bind:activeView
      />
  {:else}
    <p>No relays found</p>
  {/if}
</div>