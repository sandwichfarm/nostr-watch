<script lang="ts">
	import { generateRelayUrlFromPath } from '$utils/routing';

	import ChartPeerBenchmarks from './(components)/ChartPeerBenchmarks.svelte';
	import ChartPeerDistributions from './(components)/ChartPeerDistributions.svelte';

	const relayUrl = generateRelayUrlFromPath() as string;
</script>

<div class="insights-page space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-mono text-white/90">Relay Insights</h1>
			<p class="text-sm text-white/60 mt-1">Peer comparisons for this relay</p>
		</div>
	</div>

	<section class="space-y-4">
		<h2 class="text-xl font-mono text-white/80">Compared to Other Relays</h2>
		<div class="grid grid-cols-1 gap-6">
			<ChartPeerBenchmarks {relayUrl} />
			<ChartPeerDistributions {relayUrl} />
		</div>
	</section>
</div>

<style>
	.insights-page {
		padding-bottom: 4rem;
	}
</style>
