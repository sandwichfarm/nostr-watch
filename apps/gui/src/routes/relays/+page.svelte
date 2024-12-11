<script lang="ts">
	import Stats from '$lib/components/blocks/Stats.svelte';
	import DataTable from '$lib/components/blocks/table/DataTable.svelte';
    import tableConfig from '$lib/config/dataTable/relays.js';

	import { relayAggregates } from '$lib/stores/checks.js';
	import { doBootstrap } from '$lib/stores/routines';
	import { doAggregateCache } from '$lib/stores/app';
	import { onMount } from 'svelte';
	export const prerender = true;

	onMount(() => {
		doBootstrap.set(true)
		doAggregateCache.set(true)
	})
</script>

<main>
	<Stats />
	<DataTable data={relayAggregates} config={tableConfig} />
</main>
