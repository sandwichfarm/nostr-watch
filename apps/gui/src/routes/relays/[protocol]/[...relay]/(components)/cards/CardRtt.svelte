<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import Button from '$lib/components/ui/button/button.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { observeInView, type InViewChangeDetail } from '$utils/ux';
	import {
		subscribeRelayDeltas,
		type RelayDeltasSubscriptionHandle,
		updateRelayDeltasSince,
		getTimeSeriesData,
	} from '$lib/stores/chronicle';
	import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	const relayUrl = generateRelayUrlFromPath() as string;

	let rttCanvas: HTMLCanvasElement;
	let rttChart: any = null;
	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let inView = false;
	let subscription: RelayDeltasSubscriptionHandle | null = null;
	let timeRange = '24h'; // Default time range
	let smaWindow = '5'; // SMA window (points)

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

	onDestroy(async () => {
		// Clean up chart
		if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}

		if (subscription) {
			await subscription.stop();
			subscription = null;
		}
	});

	async function startVisibleSync() {
		const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
		subscription = subscribeRelayDeltas(relayUrl, { since });
		syncing = true;
		try {
			await subscription.ready;
		} finally {
			syncing = false;
		}
	}

	async function handleInViewChange(e: CustomEvent<InViewChangeDetail>) {
		const nextInView = Boolean(e.detail?.inView);
		if (nextInView === inView) return;
		inView = nextInView;

		if (!inView) {
			if (subscription) {
				void subscription.stop();
				subscription = null;
			}
			return;
		}

		if (!subscription) {
			try {
				await startVisibleSync();
			} catch (err) {
				console.warn('[CardRtt] Failed to start visible sync:', err);
			}
		}

		await loadChart();
	}

	async function loadChart() {
		if (!inView) return;

		loading = true;
		error = null;

		let rttData: any[] = [];

		try {
			const adapter = createChartJsAdapter();
			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
			const smaWindowNum = Math.max(0, Math.floor(Number(smaWindow) || 0));
			const aggregate =
				timeRange === '30d'
					? { bucketSize: 86400, fn: 'avg' as const }
					: undefined;

			// Get RTT time series data
			rttData = await getTimeSeriesData({
				relay: relayUrl,
				type: 'rtt',
				since,
				aggregate,
			});
			console.log('[CardRtt] RTT data received:', rttData?.length, 'points', rttData?.slice(0, 3));
		} catch (err: any) {
			console.error('[CardRtt] Error loading chart:', err);
			error = err.message || 'Failed to load RTT chart';
		} finally {
			loading = false;
		}

		if (error) return;

		// Ensure canvas is mounted before creating Chart.js instance.
		await tick();

		const adapter = createChartJsAdapter();
		const smaWindowNum = Math.max(0, Math.floor(Number(smaWindow) || 0));

		// Create RTT chart
		if (rttData && rttData.length > 0) {
			const rttConfig = adapter.createTimeSeriesChart(rttData, {
				title: 'Response Time (RTT)',
				theme: 'dark',
				showGrid: true,
				showTooltip: true,
				responsive: true,
				...(smaWindowNum > 1 ? { sma: { window: smaWindowNum } } : {})
			});

			if (rttChart) {
				rttChart.destroy();
			}

			if (rttCanvas) {
				rttChart = new Chart(rttCanvas.getContext('2d')!, rttConfig);
			}
		} else if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}
	}

	async function changeTimeRange(range: string) {
		timeRange = range;
		if (inView) {
			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
			if (subscription) {
				void updateRelayDeltasSince(relayUrl, { since }).catch(() => {});
			} else {
				void startVisibleSync().catch(() => {});
			}
		}
		await loadChart();
	}

	async function changeSmaWindow(window: string) {
		smaWindow = window;
		await loadChart();
	}
</script>

<div use:observeInView={{ threshold: 0.25, debounceMs: 150 }} on:inviewchange={handleInViewChange}>
<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80 flex items-center justify-between'>
			<span>response time (rtt)</span>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2">
					<span class="text-xs text-white/50">SMA</span>
					<select
						class="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-xs text-white/80"
						value={smaWindow}
						on:change={(e) => changeSmaWindow((e.target as HTMLSelectElement).value)}
						disabled={loading || syncing}
					>
						<option value="0">Off</option>
						<option value="3">3</option>
						<option value="5">5</option>
						<option value="10">10</option>
						<option value="20">20</option>
					</select>
				</div>
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
			</div>
		</Card.Title>
		<Card.Description></Card.Description>
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
				<Button
					variant="secondary"
					size="sm"
					class="mt-3"
					on:click={() => loadChart()}
				>
					Retry
				</Button>
			</div>
		{:else}
			<div class="bg-black/30 p-4 rounded">
				<canvas bind:this={rttCanvas} style="max-height: 300px;"></canvas>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			Historical data from Kind 1066 delta events
		</div>
	</Card.Footer>
</Card.Root>
</div>

<style>
	/* Ensure canvas is responsive */
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
