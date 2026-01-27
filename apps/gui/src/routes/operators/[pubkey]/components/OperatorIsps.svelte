<script lang="ts">
	import { operatorSoftwares$, operatorSoftwareCount, operatorIsps$, operatorIspCount } from "$stores/helpers/helpers-operator";
	import { onMount } from "svelte";
	import { writable, type Readable, type Writable } from "svelte/store";

  import { defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
  import { default as softwareTableConfig } from '$lib/config/dataTable/softwares.js';
	import Badge from "$ui/badge/badge.svelte";

  export let pubkey: string;

  let operatorIsps: Readable<any[] | undefined>;

  onMount(() => {
    operatorIsps = operatorIsps$(pubkey)
  })
</script>

{#if $operatorIsps}
   <ul>
  {#if $operatorIsps?.length}
    {#each $operatorIsps as isp}
      <li class="text-lg px-2 py-2 border-b border-white/10">
        <Badge class="
          mr-2 p-0 rounded-full 
          h-6 w-6 relative -top-0.5 
          text-center inline-flex items-center justify-center
          dark:bg-purple-100/10 dark:text-white 
          bg-purple-800/10 text-black 
          text-sm 
          ">
          {operatorIspCount(pubkey, isp)}
        </Badge>
        <span class="text-sm font-mono font-bold">{isp}</span>
      </li>
    {/each}
  {/if}
</ul>
{:else}
  <p>No relays found</p>
{/if}