<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import {
		syncRelay,
		unsyncRelay,
		isSyncing
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

			if (!isSyncing(relayUrl)) {
				syncing = true;
				await syncRelay(relayUrl, {
					since,
					keepAlive: false,
				});
				await new Promise(resolve => setTimeout(resolve, 1000));
				syncing = false;
			}

			// TODO: Get actual state transition data from Kind 1066 events
			// Parse operational status tags (O: init, up, down) and create timeline
			const stateData = generateStateTransitionData(since);

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

	function generateStateTransitionData(since: number) {
		// TODO: Parse Kind 1066 events for operational status changes
		// For now, return mock state change data
		const now = Date.now() / 1000;
		const states = ['init', 'up', 'down', 'up'];
		const transitions = [];

		for (let i = 0; i < states.length - 1; i++) {
			transitions.push({
				timestamp: since + ((now - since) / states.length) * (i + 1),
				from: states[i],
				to: states[i + 1],
				field: 'operational_status',
			});
		}

		return transitions;
	}

	$: if (timeRange) {
		loadChart();
	}
</script>

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

<style>
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
