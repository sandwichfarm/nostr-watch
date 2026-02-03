<script lang="ts">
	import { generateRelayUrlFromPath } from '$utils/routing';
	import Button from '$lib/components/ui/button/button.svelte';

	import ChartCheckFrequency from './(components)/ChartCheckFrequency.svelte';
	import ChartStateTransitions from './(components)/ChartStateTransitions.svelte';
	import ChartFieldChanges from './(components)/ChartFieldChanges.svelte';
	import ChartMonitorDistribution from './(components)/ChartMonitorDistribution.svelte';
	import ChartCheckResults from './(components)/ChartCheckResults.svelte';
	import ChartSupportedNips from './(components)/ChartSupportedNips.svelte';
	import ChartLimitations from './(components)/ChartLimitations.svelte';
	import ChartNetworkProtocols from './(components)/ChartNetworkProtocols.svelte';
	import ChartPeerBenchmarks from './(components)/ChartPeerBenchmarks.svelte';
	import ChartPeerDistributions from './(components)/ChartPeerDistributions.svelte';

	const relayUrl = generateRelayUrlFromPath() as string;

	let timeRange = '24h';
	let showDeepDive = false;

	// Time range options for historical charts
	const timeRanges = {
		'1h': { label: '1 Hour', seconds: 3600 },
		'6h': { label: '6 Hours', seconds: 21600 },
		'24h': { label: '24 Hours', seconds: 86400 },
		'7d': { label: '7 Days', seconds: 604800 },
		'30d': { label: '30 Days', seconds: 2592000 },
		'all': { label: 'All Time', seconds: 0 },
	};

	function changeTimeRange(range: string) {
		timeRange = range;
	}
</script>

<div class="insights-page space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-mono text-white/90">Relay Insights</h1>
			<p class="text-sm text-white/60 mt-1">Peer comparisons first; deep-dive charts optional</p>
		</div>
		<Button variant={showDeepDive ? 'secondary' : 'default'} size="sm" on:click={() => (showDeepDive = !showDeepDive)}>
			{showDeepDive ? 'Hide deep dive' : 'Deep dive'}
		</Button>
	</div>

	<section class="space-y-4">
		<h2 class="text-xl font-mono text-white/80">Compared to Other Relays</h2>
		<div class="grid grid-cols-1 gap-6">
			<ChartPeerBenchmarks {relayUrl} />
			<ChartPeerDistributions {relayUrl} />
		</div>
	</section>

	{#if showDeepDive}
		<section class="space-y-4">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-xl font-mono text-white/80">Deep Dive</h2>
				<div class="flex flex-wrap gap-2 justify-end">
					{#each Object.entries(timeRanges) as [key, { label }]}
						<Button
							variant={timeRange === key ? 'default' : 'secondary'}
							size="sm"
							on:click={() => changeTimeRange(key)}
						>
							{label}
						</Button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-1 gap-6">
				<ChartCheckFrequency {relayUrl} {timeRange} {timeRanges} />
				<ChartStateTransitions {relayUrl} {timeRange} {timeRanges} />
				<ChartFieldChanges {relayUrl} {timeRange} {timeRanges} />
			</div>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-mono text-white/80">Current State</h2>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ChartMonitorDistribution {relayUrl} />
				<ChartCheckResults {relayUrl} />
			</div>
		</section>

		<section class="space-y-4">
			<h2 class="text-xl font-mono text-white/80">Capabilities</h2>
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ChartSupportedNips {relayUrl} />
				<ChartLimitations {relayUrl} />
				<ChartNetworkProtocols {relayUrl} />
			</div>
		</section>
	{/if}
</div>

<style>
	.insights-page {
		padding-bottom: 4rem;
	}
</style>
