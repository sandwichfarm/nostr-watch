<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AutoSuggestRelaysCompact from '$lib/components/partials/AutoSuggestRelaysCompact.svelte';
	import { hasBeenBoostrapped } from '$lib/stores/app';
	import { eventsArray } from '$lib/stores';
	import { totalMonitors } from '$lib/stores';
  import ActivityList  from "$lib/components/partials/ActivityList.svelte"

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        if(!isHomepage) return;
  });

  $: isHomepage = $page.url.pathname === '/'
  $: loadedEnough = hasBeenBoostrapped() || $totalMonitors > 1
</script> 

{#if isHomepage}


  {#if loadedEnough}
  <section class="h-[420px] bg-white/5 flex flex-col justify-center items-center">
    <h1 class="w-full text-center text-3xl mb-4">find your relays.</h1>
    <div class="w-full max-w-xl">
      <AutoSuggestRelaysCompact maxResults={5} autoFocus={true} />
    </div>
  </section>
  {:else}
  <div class="flex flex-col items-center justify-center h-screen">
    <!-- <div class="text-2xl h-[420px] align-middle bg-white/10 mb-4">[ loading graphic ]</div> -->
    <ActivityList />
  </div>
  {/if}

{/if}