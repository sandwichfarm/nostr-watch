<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import Button from '$lib/components/ui/button/button.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import {
		syncRelay,
		unsyncRelay,
		getTimeSeriesData,
		getUptimeHistory,
		isSyncing
	} from '$lib/stores/chronicle';
	import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
	import Chart from 'chart.js/auto';

	const relayUrl = generateRelayUrlFromPath() as string;

	let rttCanvas: HTMLCanvasElement;
	let uptimeCanvas: HTMLCanvasElement;
	let rttChart: any = null;
	let uptimeChart: any = null;
	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let timeRange = '24h'; // Default time range

	// Time range options
	const timeRanges = {
		'1h': { label: '1 Hour', seconds: 3600 },
		'6h': { label: '6 Hours', seconds: 21600 },
		'24h': { label: '24 Hours', seconds: 86400 },
		'7d': { label: '7 Days', seconds: 604800 },
		'30d': { label: '30 Days', seconds: 2592000 },
	};

	// Make Chart.js available globally for the adapter
	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	onMount(async () => {
		await loadCharts();
	});

	onDestroy(async () => {
		// Clean up charts
		if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}
		if (uptimeChart) {
			uptimeChart.destroy();
			uptimeChart = null;
		}

		// Stop syncing when card is destroyed
		if (isSyncing(relayUrl)) {
			await unsyncRelay(relayUrl);
		}
	});

	async function loadCharts() {
		loading = true;
		error = null;

		try {
			const adapter = createChartJsAdapter();
			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;

			// Start syncing the relay if not already syncing
			if (!isSyncing(relayUrl)) {
				syncing = true;
				await syncRelay(relayUrl, {
					since,
					keepAlive: false, // One-time fetch
				});

				// Wait a moment for events to arrive
				await new Promise(resolve => setTimeout(resolve, 1000));
				syncing = false;
			}

			// Get RTT time series data
			const rttData = await getTimeSeriesData({
				relay: relayUrl,
				type: 'rtt',
				since,
			});

			// Get uptime periods
			const uptimeData = await getUptimeHistory(relayUrl, { since });

			// Create RTT chart
			if (rttData && rttData.length > 0) {
				const rttConfig = adapter.createTimeSeriesChart(rttData, {
					title: 'Response Time (RTT)',
					theme: 'dark',
					showGrid: true,
					showTooltip: true,
					responsive: true,
				});

				if (rttChart) {
					rttChart.destroy();
				}

				if (rttCanvas) {
					rttChart = new Chart(rttCanvas.getContext('2d')!, rttConfig);
				}
			}

			// Create uptime timeline chart
			if (uptimeData && uptimeData.length > 0) {
				const uptimeConfig = adapter.createTimelineChart(uptimeData, {
					title: 'Uptime Timeline',
					theme: 'dark',
					showGrid: true,
					showTooltip: true,
					responsive: true,
				});

				if (uptimeChart) {
					uptimeChart.destroy();
				}

				if (uptimeCanvas) {
					uptimeChart = new Chart(uptimeCanvas.getContext('2d')!, uptimeConfig);
				}
			}

			loading = false;
		} catch (err: any) {
			console.error('[CardCharts] Error loading charts:', err);
			error = err.message || 'Failed to load charts';
			loading = false;
		}
	}

	async function changeTimeRange(range: string) {
		timeRange = range;
		await loadCharts();
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80 flex items-center justify-between'>
			<span>charts</span>
			<div class="flex gap-2">
				{#each Object.entries(timeRanges) as [key, { label }]}
					<Button
						variant={timeRange === key ? 'default' : 'secondary'}
						size="sm"
						on:click={() => changeTimeRange(key)}
						disabled={loading || syncing}
					>
						{label}
					</Button>
				{/each}
			</div>
		</Card.Title>
		<Card.Description></Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading || syncing}
			<div class="flex items-center justify-center p-8">
				<div class="text-white/60">
					{syncing ? 'Syncing relay data...' : 'Loading charts...'}
				</div>
			</div>
		{:else if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading charts</p>
				<p class="text-sm mt-1">{error}</p>
				<Button
					variant="secondary"
					size="sm"
					class="mt-3"
					on:click={() => loadCharts()}
				>
					Retry
				</Button>
			</div>
		{:else}
			<div class="space-y-6">
				<!-- RTT Chart -->
				<div class="bg-black/30 p-4 rounded">
					<canvas bind:this={rttCanvas} style="max-height: 300px;"></canvas>
				</div>

				<!-- Uptime Timeline Chart -->
				<div class="bg-black/30 p-4 rounded">
					<canvas bind:this={uptimeCanvas} style="max-height: 300px;"></canvas>
				</div>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			Historical data from Kind 1066 delta events
		</div>
	</Card.Footer>
</Card.Root>

<style>
	/* Ensure canvas is responsive */
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
