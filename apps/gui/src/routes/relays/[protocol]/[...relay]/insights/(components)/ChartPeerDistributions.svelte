<script lang="ts">
	import { onDestroy } from 'svelte';
	import { derived } from 'svelte/store';
	import * as Card from '$lib/components/ui/card';
	import { relayCheckAggregates } from '$stores/checks';
	import { relayScores } from '$stores/score-relays-decentralization';

	export let relayUrl: string;

	type RelayAggregateRow = Record<string, any> & {
		relay?: string;
		rtt?: number;
		seenBy?: unknown;
		supportedNips?: unknown;
	};

	type MetricKey = 'rtt' | 'decentralization' | 'monitors' | 'nips';

	type Metric = {
		key: MetricKey;
		label: string;
		valueLabel: string;
		betterThan: number | null;
		higherIsBetter: boolean;
		peerCount: number;
		scale: {
			p10: number | null;
			p25: number | null;
			p50: number | null;
			p75: number | null;
			p90: number | null;
		};
		style: {
			bandLeftPct: number | null;
			bandWidthPct: number | null;
			medianPct: number | null;
		};
		marker: {
			pos: number | null;
			outside: 'low' | 'high' | null;
		};
	};

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

	function quantile(sorted: number[], q: number): number | null {
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

	const formatPercent = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
	};

	const formatNumber = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.round(value)}`;
	};

	const formatMs = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.round(value)}ms`;
	};

	const formatScore = (value: number | null): string => {
		if (value == null) return 'N/A';
		return `${Math.round(value)}/100`;
	};

	function makeMarker(domainMin: number | null, domainMax: number | null, value: number | null) {
		if (domainMin == null || domainMax == null) return { pos: null, outside: null as const };
		if (value == null) return { pos: null, outside: null as const };
		const span = domainMax - domainMin;
		if (!Number.isFinite(span) || span <= 0) return { pos: null, outside: null as const };
		const raw = (value - domainMin) / span;
		const pos = Math.max(0, Math.min(1, raw));
		const outside = raw < 0 ? ('low' as const) : raw > 1 ? ('high' as const) : null;
		return { pos, outside };
	}

	function pctWithin(domainMin: number | null, domainMax: number | null, value: number | null): number | null {
		if (domainMin == null || domainMax == null) return null;
		if (value == null) return null;
		const span = domainMax - domainMin;
		if (!Number.isFinite(span) || span <= 0) return null;
		return ((value - domainMin) / span) * 100;
	}

	function makeMetric(
		key: MetricKey,
		label: string,
		current: number | null,
		peerValues: number[],
		higherIsBetter: boolean,
		formatValue: (value: number | null) => string
	): Metric {
		const values = peerValues.filter((v) => Number.isFinite(v)).slice();
		values.sort((a, b) => a - b);
		const scale = {
			p10: quantile(values, 0.1),
			p25: quantile(values, 0.25),
			p50: quantile(values, 0.5),
			p75: quantile(values, 0.75),
			p90: quantile(values, 0.9),
		};

		const domainMin = scale.p10;
		const domainMax = scale.p90;
		const bandLeftPct = pctWithin(domainMin, domainMax, scale.p25);
		const bandRightPct = pctWithin(domainMin, domainMax, scale.p75);
		const bandWidthPct =
			bandLeftPct == null || bandRightPct == null ? null : Math.max(0, bandRightPct - bandLeftPct);
		const medianPct = pctWithin(domainMin, domainMax, scale.p50);

		return {
			key,
			label,
			valueLabel: formatValue(current),
			betterThan: percentileBetterThan(current, values, higherIsBetter),
			higherIsBetter,
			peerCount: values.length,
			scale,
			style: {
				bandLeftPct,
				bandWidthPct,
				medianPct,
			},
			marker: makeMarker(domainMin, domainMax, current),
		};
	}

	const data$ = derived([relayCheckAggregates, relayScores], ([$relayCheckAggregates, $relayScores]) => ({
		aggregates: $relayCheckAggregates as RelayAggregateRow[],
		scores: $relayScores as Map<string, number>,
	}));

	let metrics: Metric[] = [];
	let error: string | null = null;

	const unsubscribe = data$.subscribe(({ aggregates, scores }) => {
		try {
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
			const nips = arrayCount(row?.supportedNips);
			const score = numberOrNull(scores.get(relay));

			metrics = [
				makeMetric('rtt', 'Avg RTT', rtt, allRtts, false, formatMs),
				makeMetric('decentralization', 'Decentralization', score, allScores, true, formatScore),
				makeMetric('monitors', 'Monitors', monitors, allMonitorCounts, true, formatNumber),
				makeMetric('nips', 'Supported NIPs', nips, allNipCounts, true, formatNumber),
			];
		} catch (err: any) {
			console.error('[ChartPeerDistributions] failed:', err);
			error = err?.message || 'Failed to compute distributions';
		}
	});

	onDestroy(() => unsubscribe());
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class="font-mono text-white/80">
			<span>peer distributions</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Distribution bands across peers (p10–p90), with this relay marked
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading distributions</p>
				<p class="text-sm mt-1">{error}</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each metrics as metric (metric.key)}
					<div class="rounded border border-white/10 bg-black/20 p-4">
						<div class="flex items-baseline justify-between gap-3">
							<div class="text-sm font-mono text-white/70">{metric.label}</div>
							<div class="flex items-baseline gap-3 font-mono">
								<div class="text-lg text-white/85">{metric.valueLabel}</div>
								<div class="text-xs text-white/45">
									better than {formatPercent(metric.betterThan)}
								</div>
							</div>
						</div>

						{#if metric.peerCount < 5}
							<div class="mt-3 text-xs text-white/45">
								Not enough peer data to compute a meaningful distribution.
							</div>
						{:else}
							<div class="mt-3">
								<div class="dist-track">
									{#if metric.style.bandLeftPct != null && metric.style.bandWidthPct != null}
										<div
											class="dist-band"
											style={`left:${metric.style.bandLeftPct}%;width:${metric.style.bandWidthPct}%`}
										></div>
									{/if}
									{#if metric.style.medianPct != null}
										<div
											class="dist-median"
											style={`left:${metric.style.medianPct}%`}
										></div>
									{/if}
									{#if metric.marker.pos != null}
										<div
											class="dist-marker {metric.marker.outside ? 'outside' : ''}"
											style={`left:${metric.marker.pos * 100}%`}
											title={metric.marker.outside
												? `Outside p10–p90 (${metric.marker.outside})`
												: 'This relay'}
										></div>
									{/if}
								</div>
								<div class="mt-2 flex items-center justify-between text-[11px] text-white/45 font-mono">
									{#if metric.key === 'rtt'}
										<span>p10 {formatMs(metric.scale.p10)}</span>
										<span>median {formatMs(metric.scale.p50)}</span>
										<span>p90 {formatMs(metric.scale.p90)}</span>
									{:else if metric.key === 'decentralization'}
										<span>p10 {formatScore(metric.scale.p10)}</span>
										<span>median {formatScore(metric.scale.p50)}</span>
										<span>p90 {formatScore(metric.scale.p90)}</span>
									{:else}
										<span>p10 {formatNumber(metric.scale.p10)}</span>
										<span>median {formatNumber(metric.scale.p50)}</span>
										<span>p90 {formatNumber(metric.scale.p90)}</span>
									{/if}
								</div>
								<div class="mt-1 text-[11px] text-white/35 font-mono">
									peers with data: {metric.peerCount}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">Bands computed from current per-relay check aggregates.</div>
	</Card.Footer>
</Card.Root>

<style>
	.dist-track {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.dist-band {
		position: absolute;
		top: 0;
		bottom: 0;
		background: rgba(16, 185, 129, 0.22);
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.dist-median {
		position: absolute;
		top: -4px;
		bottom: -4px;
		width: 2px;
		background: rgba(255, 255, 255, 0.35);
	}

	.dist-marker {
		position: absolute;
		top: -6px;
		bottom: -6px;
		width: 3px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55);
	}

	.dist-marker.outside {
		background: rgba(244, 63, 94, 0.9);
	}
</style>
