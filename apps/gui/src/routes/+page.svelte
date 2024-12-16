<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AutoSuggestRelaysCompact from '$lib/components/partials/AutoSuggestRelaysCompact.svelte';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        if(!isHomepage) return;
  });

  $: isHomepage = $page.url.pathname === '/'
</script> 

{#if isHomepage}
<section class="h-[420px] bg-white/5 flex flex-col justify-center items-center">
  <h1 class="w-full text-center text-3xl mb-4">find your relays.</h1>
  <div class="w-full max-w-xl">
    <AutoSuggestRelaysCompact maxResults={5} autoFocus={true} />
  </div>
</section>
{/if}