<script lang="ts">
	import { onMount } from 'svelte';
	import AutoSuggestRelaysTable from '$lib/components/partials/AutoSuggestRelaysTable.svelte';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  });
</script>

<main class="mt-20">
  <AutoSuggestRelaysTable />
</main>