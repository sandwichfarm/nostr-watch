<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import {
		syncRelay,
		unsyncRelay,
		isSyncing,
		getChronicleStorage
	} from '$lib/stores/chronicle';
	import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
	import Chart from 'chart.js/auto';

	export let relayUrl: string;
	export let timeRange: string;
	export let timeRanges: Record<string, { label: string; seconds: number }>;

	let canvas: HTMLCanvasElement;
	let chart: any = null;
	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let checkData: any[] = [];
	let showAnyways = false;

	// Minimum data points for meaningful chart
	const MIN_DATA_POINTS = 5; // At least 5 buckets to show a trend

	// Make Chart.js available globally
	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	onMount(async () => {
		await loadChart();
	});

	onDestroy(async () => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (isSyncing(relayUrl)) {
			await unsyncRelay(relayUrl);
		}
	});

	async function loadChart() {
		loading = true;
		error = null;

		try {
			const adapter = createChartJsAdapter();
			const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;

			// Sync relay data
			if (!isSyncing(relayUrl)) {
				syncing = true;
				await syncRelay(relayUrl, {
					since,
					keepAlive: false,
				});
				await new Promise(resolve => setTimeout(resolve, 1000));
				syncing = false;
			}

			// Get real check frequency from Kind 1066 events
			const storage = getChronicleStorage();
			checkData = [];

			if (storage) {
				const events = await storage.query({ relay: relayUrl, since });

				// Calculate bucket size based on time range (20 buckets)
				const now = Date.now() / 1000;
				const bucketSize = Math.max(60, (now - since) / 20); // Min 1 minute buckets
				const buckets = new Map<number, number>();

				// Count events in each time bucket
				for (const event of events) {
					const bucketStart = Math.floor(event.created_at / bucketSize) * bucketSize;
					buckets.set(bucketStart, (buckets.get(bucketStart) || 0) + 1);
				}

				// Convert to array format for chart
				checkData = Array.from(buckets.entries())
					.map(([timestamp, count]) => ({
						timestamp,
						value: count,
					}))
					.sort((a, b) => a.timestamp - b.timestamp);
			} else {
				console.warn('[ChartCheckFrequency] Chronicle storage not available');
			}

			if (checkData && checkData.length > 0) {
				const chartConfig = adapter.createTimeSeriesChart(checkData, {
					title: 'Check Frequency',
					theme: 'dark',
					showGrid: true,
					showTooltip: true,
					responsive: true,
				});

				if (chart) {
					chart.destroy();
				}

				if (canvas) {
					chart = new Chart(canvas.getContext('2d')!, chartConfig);
				}
			}

			loading = false;
		} catch (err: any) {
			console.error('[ChartCheckFrequency] Error loading chart:', err);
			error = err.message || 'Failed to load check frequency chart';
			loading = false;
		}
	}

	$: if (timeRange) {
		showAnyways = false; // Reset override when time range changes
		loadChart();
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>check frequency</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Number of checks performed over time
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading || syncing}
			<div class="flex items-center justify-center p-8">
				<div class="text-white/60">
					{syncing ? 'Syncing relay data...' : 'Loading chart...'}
				</div>
			</div>
		{:else if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading chart</p>
				<p class="text-sm mt-1">{error}</p>
			</div>
		{:else if checkData.length === 0}
			<div class="p-8 text-center text-white/50">
				<p class="mb-2">No check events detected in this time range</p>
				<p class="text-xs text-white/40">This relay may not have been monitored during this period</p>
			</div>
		{:else if checkData.length < MIN_DATA_POINTS && !showAnyways}
			<div class="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
				<p class="text-yellow-300 font-semibold mb-2">Limited Data</p>
				<p class="text-sm text-yellow-200/80 mb-4">
					Only {checkData.length} time {checkData.length === 1 ? 'bucket' : 'buckets'} with data.
					This may not provide enough data for a meaningful frequency analysis.
				</p>
				<button
					on:click={() => showAnyways = true}
					class="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 rounded text-yellow-200 text-sm transition-colors"
				>
					Show it anyways
				</button>
			</div>
		{:else}
			<div class="bg-black/30 p-4 rounded">
				<canvas bind:this={canvas} style="max-height: 300px;"></canvas>
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
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
