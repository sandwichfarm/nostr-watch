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
	let hydrating = false;
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

	const DEFAULT_SMA_PAD_SECONDS = 3600;

	function getVisibleSinceSeconds(): number {
		return Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
	}

	function getSmaWindow(): number {
		return Math.max(0, Math.floor(Number(smaWindow) || 0));
	}

	function getChartSinceSeconds(
		visibleSinceSeconds: number,
		smaWindowNum: number,
		aggregate?: { bucketSize: number }
	): number {
		if (smaWindowNum <= 1) return visibleSinceSeconds;
		const padSeconds = aggregate?.bucketSize
			? aggregate.bucketSize * smaWindowNum
			: DEFAULT_SMA_PAD_SECONDS * smaWindowNum;
		return Math.max(0, visibleSinceSeconds - padSeconds);
	}

	function getClampSinceSeconds(visibleSinceSeconds: number, aggregate?: { bucketSize: number }): number {
		if (!aggregate?.bucketSize) return visibleSinceSeconds;
		return Math.floor(visibleSinceSeconds / aggregate.bucketSize) * aggregate.bucketSize;
	}

	onDestroy(async () => {
		// Clean up chart
		if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}

		hydrateToken++;
		hydrating = false;

		if (subscription) {
			await subscription.stop();
			subscription = null;
		}
	});

	async function startVisibleSync() {
		const visibleSince = getVisibleSinceSeconds();
		const smaWindowNum = getSmaWindow();
		const aggregate = timeRange === '30d' ? { bucketSize: 86400, fn: 'avg' as const } : undefined;
		const since = getChartSinceSeconds(visibleSince, smaWindowNum, aggregate);
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
			hydrateToken++;
			hydrating = false;
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

		await hydrateChart();
	}

	let hydrateToken = 0;

	async function hydrateChart() {
		if (!inView) return;
		const token = ++hydrateToken;
		hydrating = true;
		const delaysMs = timeRange === '30d' ? [0, 400, 900, 1500, 2500, 4000] : [0, 250, 600, 1200, 2200];
		let lastPoints = -1;
		let stable = 0;
		try {
			for (const delayMs of delaysMs) {
				if (token !== hydrateToken || !inView) return;
				if (delayMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				}
				if (token !== hydrateToken || !inView) return;
				const points = await loadChart({ background: delayMs > 0 });
				if (token !== hydrateToken || !inView) return;
				if (points > 0) {
					stable = points === lastPoints ? stable + 1 : 0;
					lastPoints = points;
					if (stable >= 1) break;
				}
			}
		} finally {
			if (token === hydrateToken) {
				hydrating = false;
			}
		}
	}

	async function loadChart(opts?: { background?: boolean }): Promise<number> {
		if (!inView) return 0;

		const background = opts?.background ?? false;
		if (!background) {
			loading = true;
			error = null;
		}

		const visibleSince = getVisibleSinceSeconds();
		const smaWindowNum = getSmaWindow();
		let rttData: any[] = [];

		try {
			const aggregate =
				timeRange === '30d'
					? { bucketSize: 86400, fn: 'avg' as const }
					: undefined;
			const since = getChartSinceSeconds(visibleSince, smaWindowNum, aggregate);

			// When SMA is enabled we need pre-range data to compute the first SMA point.
			if (smaWindowNum > 1 && subscription) {
				void updateRelayDeltasSince(relayUrl, { since }).catch(() => {});
			}

			// Get RTT time series data
			rttData = await getTimeSeriesData({
				relay: relayUrl,
				type: 'rtt',
				since,
				aggregate,
			});
		} catch (err: any) {
			console.error('[CardRtt] Error loading chart:', err);
			if (!background) {
				error = err.message || 'Failed to load RTT chart';
			}
		} finally {
			if (!background) {
				loading = false;
			}
		}

		if (error) return 0;

		// Ensure canvas is mounted before creating Chart.js instance.
		await tick();

		const adapter = createChartJsAdapter();
		const aggregate =
			timeRange === '30d'
				? { bucketSize: 86400, fn: 'avg' as const }
				: undefined;
		const clampSince = getClampSinceSeconds(visibleSince, aggregate);

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

			if (smaWindowNum > 1) {
				(rttConfig.options as any).scales.x.min = new Date(clampSince * 1000);
			}

			if (rttCanvas) {
				if (rttChart) {
					rttChart.config.data = rttConfig.data;
					rttChart.config.options = rttConfig.options;
					rttChart.update('none');
				} else {
					rttChart = new Chart(rttCanvas.getContext('2d')!, rttConfig);
				}
			}
		} else if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}

		return rttData.length;
	}

	async function changeTimeRange(range: string) {
		hydrateToken++;
		timeRange = range;
		if (inView) {
			const visibleSince = getVisibleSinceSeconds();
			const smaWindowNum = getSmaWindow();
			const aggregate = timeRange === '30d' ? { bucketSize: 86400, fn: 'avg' as const } : undefined;
			const since = getChartSinceSeconds(visibleSince, smaWindowNum, aggregate);
			if (subscription) {
				syncing = true;
				try {
					await updateRelayDeltasSince(relayUrl, { since });
				} catch {}
				finally {
					syncing = false;
				}
			} else {
				void startVisibleSync().catch(() => {});
			}
		}
		await hydrateChart();
	}

	async function changeSmaWindow(window: string) {
		hydrateToken++;
		smaWindow = window;
		if (inView) {
			const visibleSince = getVisibleSinceSeconds();
			const smaWindowNum = getSmaWindow();
			const aggregate = timeRange === '30d' ? { bucketSize: 86400, fn: 'avg' as const } : undefined;
			const since = getChartSinceSeconds(visibleSince, smaWindowNum, aggregate);
			if (subscription) {
				syncing = true;
				try {
					await updateRelayDeltasSince(relayUrl, { since });
				} catch {}
				finally {
					syncing = false;
				}
			}
		}
		await hydrateChart();
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
						disabled={loading || syncing || hydrating}
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
						disabled={loading || syncing || hydrating}
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
		<div class="relative bg-black/30 p-4 rounded" style="height: 320px;">
			<canvas bind:this={rttCanvas}></canvas>

			{#if error}
				<div class="absolute inset-0 flex items-center justify-center rounded bg-black/70 p-6">
					<div class="max-w-md text-center">
						<div class="text-red-300 font-semibold">Error loading chart</div>
						<div class="mt-1 text-sm text-red-200/80">{error}</div>
						<Button
							variant="secondary"
							size="sm"
							class="mt-4"
							on:click={() => hydrateChart()}
						>
							Retry
						</Button>
					</div>
				</div>
			{:else if loading || syncing || hydrating}
				<div class="absolute inset-0 flex items-center justify-center rounded bg-black/60">
					<div class="text-white/60">
						{syncing ? 'Syncing relay data...' : hydrating ? 'Hydrating chart data…' : 'Loading chart...'}
					</div>
				</div>
			{/if}
		</div>
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
		height: 100% !important;
	}
</style>
