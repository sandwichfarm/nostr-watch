<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AutoSuggestRelaysCompact from '$lib/components/partials/AutoSuggestRelaysCompact.svelte';
	import Counts from '$routes/components/Counts.svelte';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        if(!isHomepage) return;
  });

  $: isHomepage = $page.url.pathname === '/'
</script> 
{#if isHomepage}
  <section class="h-[420px] pt-16 bg-black/5 dark:bg-white/5 flex flex-col justify-center items-center relative z-[200]">
    <h1 class="w-full text-center text-3xl mb-4 max-w-[600px]">nostr.watch is a client for browsing, testing and researching nostr relays.</h1>
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
          focus:outline-none focus:border-transparent focus:ring-0
          shadow-[0_0_40px_rgba(255,255,255,0.05)]"
        resultWrapperClass="
          result-wrapper
          shadow-md absolute top-full -mt-8 
          left-0 right-0 z-9999 backdrop-blur-lg 
          border border-white/10 dark:bg-black/60 dark:border-white/10"
        />
    </div>
  </section>
  <Counts />
{/if}

<style lang="postcss" global>
  .result-wrapper > div {
    @apply rounded-sm bg-transparent bg-gradient-to-b from-black/90 to-black/0; 
  }
</style>