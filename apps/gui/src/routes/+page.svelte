<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AutoSuggestRelaysCompact from '$lib/components/partials/AutoSuggestRelaysCompact.svelte';
	import { hasBeenBoostrapped } from '$lib/stores/app';
	import { eventsArray } from '$lib/stores';
	import { totalMonitors } from '$lib/stores';
  import ActivityList  from "$lib/components/partials/ActivityList.svelte"
	import Counts from '$lib/components/partials/home/Counts.svelte';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        if(!isHomepage) return;
  });

  $: isHomepage = $page.url.pathname === '/'
  $: loadedEnough = hasBeenBoostrapped() || $totalMonitors > 1
</script> 

{#if isHomepage}
  {#if loadedEnough}
  <section class="h-[420px] bg-black/5 dark:bg-white/5 flex flex-col justify-center items-center">
    <h1 class="w-full text-center text-3xl mb-4">nostr.watch is a client for browsing nostr relays.</h1>
    <div class="w-full max-w-xl">
      <AutoSuggestRelaysCompact 
        maxResults={5} 
        autoFocus={true} 
        placeholderText={"find your relays"}
        inputClass="
          w-full py-2 px-4 mr-4 
          text-center
          border border-black/20 
          text-3xl 
          rounded-xl 
          dark:bg-black/20 dark:border-black/30 dark:text-white/60 
          placeholder:text-gray-400 dark:placeholder:text-gray-500 
          focus:outline-none focus:border-transparent focus:ring-0"
        resultWrapperClass="
          result-wrapper
          shadow-md absolute top-full -mt-8 left-0 right-0 z-9999 backdrop-blur-lg border border-white/10 dark:bg-black/60 dark:border-white/10"
        />
    </div>
  </section>
  <Counts />
  {:else}
  <div class="flex flex-col items-center justify-center h-screen">
    <!-- <div class="text-2xl h-[420px] align-middle bg-black/10 dark:bg-white/10 mb-4">[ loading graphic ]</div> -->
    <ActivityList />
  </div>
  {/if}

{/if}

<style lang="postcss" global>
  .result-wrapper > div {
    @apply rounded-sm bg-gradient-to-b from-black/100 to-black/0; 
  }
</style>