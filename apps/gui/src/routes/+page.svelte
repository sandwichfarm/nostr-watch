<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import Stats from '$lib/components/blocks/Stats.svelte';
	import DataTable from '$lib/components/blocks/table/DataTable.svelte';

	import { bootstrap, destroy } from '$lib/utils/lifecycle.js';
	import { relayAggregates } from '$lib/stores/checks.js';
	export const prerender = true;

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        // bootstrap();
    });
	// onDestroy(destroy);
</script>

<main>
	<!-- <Stats />
	<DataTable data={relayAggregates} /> -->
</main>

<!-- <h1>Monitors</h1>
{#if $monitors.length > 0}
  <p>{$monitors.length}</p>
  {#each $monitors as monitor (monitor?.registration?.pubkey)}
    <p>
      {monitor?.registration?.pubkey} [{$monitorChecksCount[monitor?.registration?.pubkey]}]
    </p>
  {/each}
{:else}
  <p>No monitors found.</p>
{/if} -->


