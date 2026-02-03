<script lang="ts">
	import { onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { observeInView, type InViewChangeDetail } from '$utils/ux';
	import {
		subscribeRelayDeltas,
		type RelayDeltasSubscriptionHandle,
		updateRelayDeltasSince,
		getChronicleStorage
	} from '$lib/stores/chronicle';
	import { uptimeHistory } from '@nostrwatch/relay-chronicle';
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
	let stateData: any[] = [];
	let showAnyways = false;
	let inView = false;
	let subscription: RelayDeltasSubscriptionHandle | null = null;

	// Minimum data points for meaningful chart
	const MIN_DATA_POINTS = 2; // At least 2 transitions to show a pattern

	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	onDestroy(async () => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (subscription) {
			await subscription.stop();
			subscription = null;
		}
	});

	async function startVisibleSync() {
		const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
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
				console.warn('[ChartStateTransitions] Failed to start visible sync:', err);
			}
		}

		await loadChart();
	}

	async function loadChart() {
		if (!inView) return;

		loading = true;
		error = null;

		try {
			const adapter = createChartJsAdapter();
			const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;

			// Get real state transition data from Kind 1066 events
			const storage = getChronicleStorage();
			stateData = [];

			if (storage) {
				const periods = await uptimeHistory(storage, relayUrl, { since });

				// Convert periods to transitions for chart
				for (let i = 0; i < periods.length - 1; i++) {
					stateData.push({
						timestamp: periods[i + 1].start,
						from: periods[i].type === 'uptime' ? 'up' : 'down',
						to: periods[i + 1].type === 'uptime' ? 'up' : 'down',
						field: 'operational_status',
					});
				}
			} else {
				console.warn('[ChartStateTransitions] Chronicle storage not available');
			}

			if (stateData && stateData.length > 0) {
				const chartConfig = adapter.createStateChart(stateData, {
					title: 'State Transitions',
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
			console.error('[ChartStateTransitions] Error loading chart:', err);
			error = err.message || 'Failed to load state transitions chart';
			loading = false;
		}
	}

	$: if (timeRange && inView) {
		showAnyways = false; // Reset override when time range changes
		const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
		if (subscription) void updateRelayDeltasSince(relayUrl, { since }).catch(() => {});
		loadChart();
	}
</script>

<div use:observeInView={{ threshold: 0.25, debounceMs: 150 }} on:inviewchange={handleInViewChange}>
<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>state transitions</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Operational status changes over time (init, up, down)
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
		{:else if stateData.length === 0}
			<div class="p-8 text-center text-white/50">
				<p class="mb-2">No state transitions detected in this time range</p>
				<p class="text-xs text-white/40">This relay may be new or has maintained constant uptime</p>
			</div>
		{:else if stateData.length < MIN_DATA_POINTS && !showAnyways}
			<div class="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
				<p class="text-yellow-300 font-semibold mb-2">Limited Data</p>
				<p class="text-sm text-yellow-200/80 mb-4">
					Only {stateData.length} state {stateData.length === 1 ? 'transition' : 'transitions'} detected.
					This may not provide enough data for a meaningful chart.
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
			Operational status from Kind 1066 delta events
		</div>
	</Card.Footer>
</Card.Root>
</div>

<style>
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
