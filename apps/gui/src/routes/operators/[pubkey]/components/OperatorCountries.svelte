<script lang="ts">
	import { operatorCountries$, operatorCountryCount } from "$stores/helpers/helpers-operator";
	import { onMount } from "svelte";
	import { type Readable } from "svelte/store";
	import Badge from "$ui/badge/badge.svelte";

  export let pubkey: string;

  let operatorCountries: Readable<any[] | undefined>;

  onMount(() => {
    operatorCountries = operatorCountries$(pubkey)
  })
</script>

{#if $operatorCountries}
   <ul>
  {#if $operatorCountries?.length}
    {#each $operatorCountries as country}
      <li class="text-lg px-2 py-2 border-b border-white/10">
        <Badge class="
          mr-2 p-0 rounded-full 
          h-6 w-6 relative -top-0.5 
          text-center inline-flex items-center justify-center
          dark:bg-purple-100/10 dark:text-white 
          bg-purple-800/10 text-black 
          text-sm 
          ">
          {operatorCountryCount(pubkey, country)}
        </Badge>
        <span class="text-sm font-mono font-bold">{country}</span>
      </li>
    {/each}
  {/if}
</ul>
{:else}
  <p>No relays found</p>
{/if}