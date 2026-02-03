<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { derived } from 'svelte/store';
	import * as Card from '$lib/components/ui/card';
	import { relayCheckAggregates } from '$stores/checks';
	import { relayScores } from '$stores/score-relays-decentralization';
	import Chart from 'chart.js/auto';

	export let relayUrl: string;

	type RelayAggregateRow = Record<string, any> & {
		relay?: string;
		rtt?: number;
		liveness?: 'online' | 'offline' | 'dead';
		seenBy?: unknown;
		supportedNips?: unknown;
	};

	type BenchmarkMetric = {
		key: string;
		label: string;
		value: string;
		percentile: number | null;
		higherIsBetter: boolean;
	};

	let canvas: HTMLCanvasElement | null = null;
	let chart: any = null;
	let loading = true;
	let error: string | null = null;
	let metrics: BenchmarkMetric[] = [];
	let hasScatterData = false;

	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	const normalizeRelay = (value: string): string => {
		try {
			return new URL(value).toString();
		} catch {
			return value;
		}
	};

	const numberOrNull = (value: unknown): number | null => {
		if (typeof value !== 'number') return null;
		if (!Number.isFinite(value)) return null;
		return value;
	};

	const uniqueCount = (value: unknown): number | null => {
		if (!Array.isArray(value)) return null;
		return new Set(value.filter(Boolean)).size;
	};

	const arrayCount = (value: unknown): number | null => {
		if (!Array.isArray(value)) return null;
		return value.length;
	};

	const percentileBetterThan = (
		value: number | null,
		values: number[],
		higherIsBetter: boolean
	): number | null => {
		if (value == null) return null;
		const finite = values.filter((v) => Number.isFinite(v));
		if (!finite.length) return null;
		const n = finite.length;
		let worseOrEqual = 0;

		if (higherIsBetter) {
			for (const v of finite) if (v <= value) worseOrEqual += 1;
			return Math.round(((worseOrEqual - 1) / Math.max(1, n - 1)) * 100);
		}

		for (const v of finite) if (v >= value) worseOrEqual += 1;
		return Math.round(((worseOrEqual - 1) / Math.max(1, n - 1)) * 100);
	};

	const formatMs = (value: number | null): string => {
		if (value == null) return 'N/A';
		if (value >= 1000) return `${Math.round(value)}ms`;
		if (value >= 100) return `${Math.round(value)}ms`;
		return `${Math.round(value)}ms`;
	};

	const formatNumber = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.round(value)}`;
	};

	const formatPercent = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
	};

	function percentileOfSorted(sorted: number[], q: number): number | null {
		if (!sorted.length) return null;
		if (q <= 0) return sorted[0]!;
		if (q >= 1) return sorted[sorted.length - 1]!;
		const idx = q * (sorted.length - 1);
		const lo = Math.floor(idx);
		const hi = Math.ceil(idx);
		if (lo === hi) return sorted[lo]!;
		const t = idx - lo;
		return sorted[lo]! * (1 - t) + sorted[hi]! * t;
	}

	const data$ = derived([relayCheckAggregates, relayScores], ([$relayCheckAggregates, $relayScores]) => ({
		aggregates: $relayCheckAggregates as RelayAggregateRow[],
		scores: $relayScores as Map<string, number>,
	}));

	let requestToken = 0;

	const update = async (aggregates: RelayAggregateRow[], scores: Map<string, number>) => {
		const token = ++requestToken;
		loading = true;
		error = null;

		const relay = normalizeRelay(relayUrl);
		const row = aggregates.find((entry) => normalizeRelay(String(entry?.relay ?? '')) === relay);

		const allRtts = aggregates.map((entry) => numberOrNull(entry?.rtt)).filter((v): v is number => v != null);
		const allMonitorCounts = aggregates
			.map((entry) => uniqueCount(entry?.seenBy))
			.filter((v): v is number => v != null);
		const allNipCounts = aggregates
			.map((entry) => arrayCount(entry?.supportedNips))
			.filter((v): v is number => v != null);
		const allScores = Array.from(scores.values()).filter((v) => Number.isFinite(v));

		const rtt = numberOrNull(row?.rtt);
		const monitors = uniqueCount(row?.seenBy);
		const nipCount = arrayCount(row?.supportedNips);
		const score = numberOrNull(scores.get(relay));

		metrics = [
			{
				key: 'rtt',
				label: 'Avg RTT',
				value: formatMs(rtt),
				percentile: percentileBetterThan(rtt, allRtts, false),
				higherIsBetter: false,
			},
			{
				key: 'decentralization',
				label: 'Decentralization',
				value: score == null ? 'N/A' : `${Math.round(score)}/100`,
				percentile: percentileBetterThan(score, allScores, true),
				higherIsBetter: true,
			},
			{
				key: 'monitors',
				label: 'Monitors',
				value: formatNumber(monitors),
				percentile: percentileBetterThan(monitors, allMonitorCounts, true),
				higherIsBetter: true,
			},
			{
				key: 'nips',
				label: 'NIPs',
				value: formatNumber(nipCount),
				percentile: percentileBetterThan(nipCount, allNipCounts, true),
				higherIsBetter: true,
			},
		];

		const points: Array<{ x: number; y: number; relay: string }> = [];
		const online: typeof points = [];
		const offline: typeof points = [];
		const dead: typeof points = [];

		for (const entry of aggregates) {
			const relayValue = normalizeRelay(String(entry?.relay ?? ''));
			if (!relayValue) continue;
			const scoreValue = numberOrNull(scores.get(relayValue));
			const rttValue = numberOrNull(entry?.rtt);
			if (scoreValue == null || rttValue == null) continue;

			const point = { x: scoreValue, y: rttValue, relay: relayValue };
			points.push(point);

			const liveness = entry?.liveness;
			if (liveness === 'online') online.push(point);
			else if (liveness === 'offline') offline.push(point);
			else dead.push(point);
		}

		hasScatterData = points.length > 0;

		if (!hasScatterData) {
			loading = false;
			return;
		}

		const yValues = points.map((p) => p.y).filter((v) => Number.isFinite(v));
		yValues.sort((a, b) => a - b);
		const p95 = percentileOfSorted(yValues, 0.95) ?? Math.max(...yValues);
		const yMax = Math.max(250, Math.round(p95 * 1.15));

		const currentPoint =
			score != null && rtt != null
				? [{ x: score, y: rtt, relay }]
				: [];

		await tick();
		if (token !== requestToken) return;
		if (!canvas) {
			loading = false;
			return;
		}

		const config = {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Online',
						data: online,
						backgroundColor: 'rgba(16, 185, 129, 0.35)',
						borderColor: 'rgba(16, 185, 129, 0.6)',
						pointRadius: 3,
					},
					{
						label: 'Offline',
						data: offline,
						backgroundColor: 'rgba(245, 158, 11, 0.35)',
						borderColor: 'rgba(245, 158, 11, 0.6)',
						pointRadius: 3,
					},
					{
						label: 'Dead',
						data: dead,
						backgroundColor: 'rgba(148, 163, 184, 0.2)',
						borderColor: 'rgba(148, 163, 184, 0.35)',
						pointRadius: 3,
					},
					{
						label: 'This relay',
						data: currentPoint,
						backgroundColor: 'rgba(255, 255, 255, 0.9)',
						borderColor: 'rgba(255, 255, 255, 1)',
						pointRadius: 6,
						pointHoverRadius: 8,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: 100,
						title: {
							display: true,
							text: 'Decentralization score (0–100)',
							color: 'rgba(255, 255, 255, 0.6)',
							font: { family: 'monospace' },
						},
						ticks: {
							color: 'rgba(255, 255, 255, 0.6)',
							font: { family: 'monospace' },
						},
						grid: { color: 'rgba(255, 255, 255, 0.06)' },
					},
					y: {
						type: 'linear',
						min: 0,
						suggestedMax: yMax,
						title: {
							display: true,
							text: 'Avg RTT (ms)',
							color: 'rgba(255, 255, 255, 0.6)',
							font: { family: 'monospace' },
						},
						ticks: {
							color: 'rgba(255, 255, 255, 0.6)',
							font: { family: 'monospace' },
						},
						grid: { color: 'rgba(255, 255, 255, 0.06)' },
					},
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							color: 'rgba(255, 255, 255, 0.65)',
							font: { family: 'monospace', size: 11 },
						},
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: 'rgba(255, 255, 255, 0.9)',
						bodyColor: 'rgba(255, 255, 255, 0.8)',
						borderColor: 'rgba(255, 255, 255, 0.12)',
						borderWidth: 1,
						padding: 12,
						callbacks: {
							label: (ctx: any) => {
								const raw = ctx?.raw as any;
								const r = String(raw?.relay ?? '').replace(/^wss?:\/\//, '');
								const relayShort = r.length > 42 ? `${r.slice(0, 24)}…${r.slice(-14)}` : r;
								return `${relayShort} · RTT ${Math.round(ctx.parsed.y)}ms · score ${Math.round(ctx.parsed.x)}`;
							},
						},
					},
				},
			},
		};

		if (chart) {
			chart.config.data = config.data as any;
			chart.config.options = config.options as any;
			chart.update('none');
		} else {
			chart = new Chart(canvas.getContext('2d')!, config as any);
		}

		loading = false;
	};

	const unsubscribe = data$.subscribe(({ aggregates, scores }) => {
		void update(aggregates, scores).catch((err) => {
			console.error('[ChartPeerBenchmarks] update failed:', err);
			error = err?.message || 'Failed to compute benchmarks';
			loading = false;
		});
	});

	onDestroy(() => {
		unsubscribe();
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class="font-mono text-white/80">
			<span>peer benchmarks</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Where this relay lands compared to other relays (based on observed check aggregates)
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading benchmarks</p>
				<p class="text-sm mt-1">{error}</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
				{#each metrics as metric (metric.key)}
					<div class="rounded border border-white/10 bg-black/20 p-4">
						<div class="text-xs font-mono text-white/50">{metric.label}</div>
						<div class="mt-2 text-2xl font-mono text-white/85">{metric.value}</div>
						<div class="mt-3">
							<div class="flex items-center justify-between text-[11px] text-white/45 font-mono">
								<span>better than</span>
								<span>{formatPercent(metric.percentile)}</span>
							</div>
							<div class="mt-1 h-2 rounded bg-white/10 overflow-hidden">
								<div
									class="h-full bg-emerald-500/60"
									style={`width: ${metric.percentile == null ? 0 : Math.max(0, Math.min(100, metric.percentile))}%`}
								></div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 bg-black/30 p-4 rounded" style="height: 420px;">
				{#if loading && !hasScatterData}
					<div class="flex h-full items-center justify-center text-white/60">Loading chart…</div>
				{:else if !hasScatterData}
					<div class="flex h-full items-center justify-center text-white/50">
						Not enough peer data to render a comparison chart.
					</div>
				{:else}
					<canvas bind:this={canvas}></canvas>
				{/if}
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			Decentralization score is derived from ISP/software/country diversity; RTT is from NIP-66 checks.
		</div>
	</Card.Footer>
</Card.Root>

<style>
	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>

