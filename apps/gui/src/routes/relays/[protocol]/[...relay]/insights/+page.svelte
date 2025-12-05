<script lang="ts">
	import { onMount } from 'svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

	import ChartCheckFrequency from './(components)/ChartCheckFrequency.svelte';
	import ChartStateTransitions from './(components)/ChartStateTransitions.svelte';
	import ChartFieldChanges from './(components)/ChartFieldChanges.svelte';
	import ChartMonitorDistribution from './(components)/ChartMonitorDistribution.svelte';
	import ChartCheckResults from './(components)/ChartCheckResults.svelte';
	import ChartSupportedNips from './(components)/ChartSupportedNips.svelte';
	import ChartLimitations from './(components)/ChartLimitations.svelte';
	import ChartNetworkProtocols from './(components)/ChartNetworkProtocols.svelte';

	const relayUrl = generateRelayUrlFromPath() as string;

	let timeRange = '24h';

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
	<!-- Page Header with Time Range Selector -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-mono text-white/90">Relay Insights</h1>
			<p class="text-sm text-white/60 mt-1">Comprehensive analytics and visualizations</p>
		</div>
		<div class="flex gap-2">
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

	<!-- Historical Time Series Charts -->
	<section class="space-y-4">
		<h2 class="text-xl font-mono text-white/80">Historical Performance</h2>
		<div class="grid grid-cols-1 gap-6">
			<ChartCheckFrequency {relayUrl} {timeRange} {timeRanges} />
			<ChartStateTransitions {relayUrl} {timeRange} {timeRanges} />
			<ChartFieldChanges {relayUrl} {timeRange} {timeRanges} />
		</div>
	</section>

	<!-- Current State Analysis -->
	<section class="space-y-4">
		<h2 class="text-xl font-mono text-white/80">Current State Analysis</h2>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartMonitorDistribution {relayUrl} />
			<ChartCheckResults {relayUrl} />
		</div>
	</section>

	<!-- Configuration & Capabilities -->
	<section class="space-y-4">
		<h2 class="text-xl font-mono text-white/80">Configuration & Capabilities</h2>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<ChartSupportedNips {relayUrl} />
			<ChartLimitations {relayUrl} />
			<ChartNetworkProtocols {relayUrl} />
		</div>
	</section>
</div>

<style>
	.insights-page {
		padding-bottom: 4rem;
	}
</style>
