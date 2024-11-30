<script lang="ts">
	import Stats from '$lib/components/blocks/Stats.svelte';
	import DataTable from '$lib/components/blocks/table/DataTable.svelte';
    import tableConfig from '$lib/components/blocks/table/relays-config.js';

	import { relayAggregates } from '$lib/stores/checks.js';
	export const prerender = true;
</script>

<main>
	<Stats />
	<DataTable data={relayAggregates} config={tableConfig} />
</main>
