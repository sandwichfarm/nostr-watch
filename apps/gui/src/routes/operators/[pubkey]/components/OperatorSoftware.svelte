<script lang="ts">
	import { operatorSoftwares$, operatorSoftwareCount } from "$stores/helpers/helpers-operator";
	import { onMount } from "svelte";
	import { writable, type Readable, type Writable } from "svelte/store";

  import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
  import { default as softwareTableConfig } from '$lib/config/dataTable/softwares.js';
  import DataView from '$lib/components/data-view/DataViewRoot.svelte';
	import Badge from "$ui/badge/badge.svelte";

  export let pubkey: string;

  const config = writable({...defaultDataTableConfig, ...softwareTableConfig})
  const dataKey = 'operator-softwares'

  let operatorSoftwares: Readable<any[] | undefined>;

  onMount(() => {
    operatorSoftwares = operatorSoftwares$(pubkey)
  })

  $: softwareCount = $operatorSoftwares?.length

  let activeView: Writable<'table' | 'map' | 'grid'> = writable('table');
</script>

{#if $operatorSoftwares}
   <ul>
  {#if $operatorSoftwares?.length}
    {#each $operatorSoftwares as software}
      <li class="text-lg px-2 py-2 border-b border-white/10">
        <Badge class="
          mr-2 p-0 rounded-full 
          h-6 w-6 relative -top-0.5 
          text-center inline-flex items-center justify-center
          dark:bg-purple-100/10 dark:text-white 
          bg-purple-800/10 text-black 
          text-sm 
          ">
          {operatorSoftwareCount(pubkey, software)}
        </Badge>
        <span class="text-sm font-mono font-bold">{software}</span>
      </li>
    {/each}
  {/if}
</ul>
{:else}
  <p>No relays found</p>
{/if}