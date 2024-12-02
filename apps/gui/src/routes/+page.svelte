<script lang="ts">
	import { onMount } from 'svelte';
	import AutoSuggestRelays from '$lib/components/partials/AutoSuggestRelays.svelte';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  });
</script>

<main class="mt-20">
  <AutoSuggestRelays />
</main>