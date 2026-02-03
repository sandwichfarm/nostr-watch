<script lang="ts">
	import { onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { getChronicleService, getDeltaEvents, getTimeSeriesData, getUptimeHistory, syncRelay } from '$lib/stores/chronicle';
	import { buildDeltaBlotterPoints } from '$utils/delta-blotter';
	import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	type DeltaEventLike = { id?: string; kind?: number; created_at?: number | null; tags?: any[] };

	let relay = 'wss://relay.damus.io/';
	let timeRange = '24h';
	let smaWindow = '5';
	let loading = false;
	let error: string | null = null;

	let syncRelays: string[] = [];
	let memoryEvents: DeltaEventLike[] = [];
	let cacheEvents: DeltaEventLike[] = [];
	let rttPoints: any[] = [];
	let uptimePeriods: any[] = [];
	let deltaBlotterPoints: any[] = [];

	let rttCanvas: HTMLCanvasElement;
	let changesCanvas: HTMLCanvasElement;
	let rttChart: any = null;
	let changesChart: any = null;

	const timeRanges: Record<string, { label: string; seconds: number }> = {
		'1h': { label: '1 Hour', seconds: 3600 },
		'6h': { label: '6 Hours', seconds: 21600 },
		'24h': { label: '24 Hours', seconds: 86400 },
		'7d': { label: '7 Days', seconds: 604800 },
		'30d': { label: '30 Days', seconds: 2592000 }
	};

	// Make Chart.js available globally for the adapter
	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	function destroyCharts() {
		if (rttChart) {
			rttChart.destroy();
			rttChart = null;
		}
		if (changesChart) {
			changesChart.destroy();
			changesChart = null;
		}
	}

	onDestroy(() => {
		destroyCharts();
	});

	function countTag(events: DeltaEventLike[], key: string): number {
		return events.filter((e) => Array.isArray(e.tags) && e.tags.some((t: any[]) => t?.[0] === key)).length;
	}

	function sampleTagValues(events: DeltaEventLike[], key: string, limit = 5): string[] {
		const values: string[] = [];
		for (const e of events) {
			if (!Array.isArray(e.tags)) continue;
			for (const t of e.tags) {
				if (t?.[0] !== key) continue;
				if (t?.[1] != null) values.push(String(t[1]));
				if (values.length >= limit) return values;
			}
		}
		return values;
	}

	async function run() {
		loading = true;
		error = null;
		destroyCharts();
		memoryEvents = [];
		cacheEvents = [];
		rttPoints = [];
		uptimePeriods = [];
		deltaBlotterPoints = [];
		syncRelays = [];

		try {
			const url = new URL(relay);
			if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
				throw new Error(`Relay URL must be ws:// or wss:// (got ${url.protocol}//)`);
			}

			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
			const smaWindowNum = Math.max(0, Math.floor(Number(smaWindow) || 0));
			const aggregate =
				timeRange === '30d'
					? { bucketSize: 86400, fn: 'avg' as const }
					: undefined;

			const service = await getChronicleService();
			if (!service) throw new Error('ChronicleService not initialized');

			syncRelays = ((service as any)?.options?.syncRelays as string[] | undefined) ?? [];

			// Fetch + store Kind 1066 deltas in ChronicleService memory.
			await syncRelay(relay, { since, keepAlive: false });

			// Compare what ChronicleService can see via memory vs cache.
			const memoryStorage = (service as any)?.getMemoryStorage?.();
			if (memoryStorage?.query) {
				memoryEvents = (await memoryStorage.query({ relay, since })) as DeltaEventLike[];
			}

			if ((service as any)?.storage?.query) {
				cacheEvents = (await (service as any).storage.query({ relay, since })) as DeltaEventLike[];
			}

			// The same data path used by CardRtt/CardCharts.
			rttPoints = await getTimeSeriesData({ relay, type: 'rtt', since, aggregate });
			uptimePeriods = await getUptimeHistory(relay, { since });
			deltaBlotterPoints = buildDeltaBlotterPoints(await getDeltaEvents({ relay, since }));

			const adapter = createChartJsAdapter();

			if (rttCanvas && rttPoints?.length) {
				const rttConfig = adapter.createTimeSeriesChart(rttPoints, {
					title: 'Response Time (RTT)',
					theme: 'dark',
					showGrid: true,
					showTooltip: true,
					responsive: true,
					...(smaWindowNum > 1 ? { sma: { window: smaWindowNum } } : {})
				});
				rttChart = new Chart(rttCanvas.getContext('2d')!, rttConfig);
			}

			if (changesCanvas && deltaBlotterPoints?.length) {
				const changesConfig = adapter.createDeltaBlotterChart(deltaBlotterPoints, {
					title: 'Delta Changes',
					theme: 'dark',
					showGrid: true,
					showTooltip: true,
					showLegend: true,
					responsive: true
				});
				changesChart = new Chart(changesCanvas.getContext('2d')!, changesConfig);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto max-w-4xl px-4 py-6 space-y-6">
	<Card.Root class="bg-black/20 border-white/10 rounded-[3px]">
		<Card.Header>
			<Card.Title class="font-mono text-white/80">test: chronicle RTT / Kind 1066</Card.Title>
			<Card.Description class="text-white/50">
				Dev-only debug page to trace Kind 1066 delta events through ChronicleService into RTT charts.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
				<div class="md:col-span-2 space-y-2">
					<div class="text-xs text-white/50">Target relay URL</div>
					<Input bind:value={relay} placeholder="wss://relay.example.com/" />
				</div>
				<div class="space-y-2">
					<div class="text-xs text-white/50">Time range</div>
					<select
						class="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white/80"
						bind:value={timeRange}
					>
						{#each Object.entries(timeRanges) as [key, { label }]}
							<option value={key}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<div class="text-xs text-white/50">SMA window</div>
					<select
						class="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white/80"
						bind:value={smaWindow}
					>
						<option value="0">Off</option>
						<option value="3">3</option>
						<option value="5">5</option>
						<option value="10">10</option>
						<option value="20">20</option>
					</select>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<Button on:click={run} disabled={loading}>
					{loading ? 'Running…' : 'Sync + Load'}
				</Button>
				{#if error}
					<div class="text-sm text-red-300">{error}</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root class="bg-black/20 border-white/10 rounded-[3px]">
		<Card.Header>
			<Card.Title class="font-mono text-white/80">inputs</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-2 text-sm text-white/70 font-mono">
			<div>syncRelays: {syncRelays.length ? syncRelays.join(', ') : '(unknown)'}</div>
		</Card.Content>
	</Card.Root>

	<Card.Root class="bg-black/20 border-white/10 rounded-[3px]">
		<Card.Header>
			<Card.Title class="font-mono text-white/80">events</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-white/70 font-mono">
			<div>
				memoryEvents: {memoryEvents.length} (rtt-open: {countTag(memoryEvents, 'rtt-open')}, retry:
				{countTag(memoryEvents, 'retry')}, O: {countTag(memoryEvents, 'O')})
			</div>
			<div>
				cacheEvents: {cacheEvents.length} (rtt-open: {countTag(cacheEvents, 'rtt-open')}, retry:
				{countTag(cacheEvents, 'retry')}, O: {countTag(cacheEvents, 'O')})
			</div>
			<div>sample rtt-open (memory): {sampleTagValues(memoryEvents, 'rtt-open').join(', ') || '—'}</div>
			<div>sample rtt-open (cache): {sampleTagValues(cacheEvents, 'rtt-open').join(', ') || '—'}</div>
		</Card.Content>
	</Card.Root>

	<Card.Root class="bg-black/20 border-white/10 rounded-[3px]">
		<Card.Header>
			<Card.Title class="font-mono text-white/80">series</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-2 text-sm text-white/70 font-mono">
			<div>rttPoints: {rttPoints?.length ?? 0}</div>
			<div>uptimePeriods: {uptimePeriods?.length ?? 0}</div>
			<div>deltaBlotterPoints: {deltaBlotterPoints?.length ?? 0}</div>
			{#if rttPoints?.length}
				<div>rtt first: {JSON.stringify(rttPoints[0])}</div>
				<div>rtt last: {JSON.stringify(rttPoints[rttPoints.length - 1])}</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root class="bg-black/20 border-white/10 rounded-[3px]">
		<Card.Header>
			<Card.Title class="font-mono text-white/80">charts</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="bg-black/30 p-4 rounded">
				<canvas bind:this={rttCanvas} style="max-height: 320px;"></canvas>
			</div>
			<div class="bg-black/30 p-4 rounded">
				<canvas bind:this={changesCanvas} style="max-height: 320px;"></canvas>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<style>
	canvas {
		width: 100% !important;
		height: auto !important;
	}
</style>
