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
		getDeltaEvents,
	} from '$lib/stores/chronicle';
	import { createChartJsAdapter } from '@nostrwatch/relay-charts/chartjs';
	import {
		isRelayOnline,
		parseDeltas,
		parseOperationalStatus,
		parseRetryCount,
		parseRttOpen,
		type DeltaEvent,
		type ParsedDelta,
	} from '@nostrwatch/relay-chronicle';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	const relayUrl = generateRelayUrlFromPath() as string;

	let uptimeCanvas: HTMLCanvasElement;
	let uptimeChart: any = null;
	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let inView = false;
	let subscription: RelayDeltasSubscriptionHandle | null = null;
	let timeRange = '24h'; // Default time range
	let smaWindow = '5'; // SMA window (points)

	let eventsCollapsed = false;
	let eventsLoading = false;
	let eventsError: string | null = null;
	let eventsLimit = 10;
	let eventsHasMore = false;
	let deltaEvents: DeltaEvent[] = [];
	let eventsRequestId = 0;

	const DAY_SECONDS = 86400;
	const UPTIME_COLORS = {
		up: '#10b981',
		partial: '#f59e0b',
		down: '#ef4444',
	};

	function dayKey(timestampSeconds: number): number {
		return Math.floor(timestampSeconds / DAY_SECONDS) * DAY_SECONDS;
	}

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

	function formatTimestamp(tsSeconds: number): string {
		return new Date(tsSeconds * 1000).toLocaleString();
	}

	function deltaTypeSymbol(delta: ParsedDelta): string {
		if (delta.type === 'add') return '+';
		if (delta.type === 'remove') return '-';
		return '~';
	}

	function truncateDeltaValue(value: string, maxLen = 140): string {
		if (value.length <= maxLen) return value;
		return `${value.slice(0, maxLen - 1)}…`;
	}

	onDestroy(async () => {
		// Clean up chart
		if (uptimeChart) {
			uptimeChart.destroy();
			uptimeChart = null;
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
				console.warn('[CardUptime] Failed to start visible sync:', err);
			}
		}

		await loadChart();

		void loadEvents().catch(() => {});
	}

	async function loadChart() {
		if (!inView) return;

		loading = true;
		error = null;

		let seriesData: any[] = [];
		let downtimeColors: string[] | null = null;

		try {
			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
			const includeDowntimeIndicators = timeRange === '7d' || timeRange === '30d';
			const aggregate =
				timeRange === '7d' || timeRange === '30d'
					? { bucketSize: DAY_SECONDS, fn: 'avg' as const }
					: undefined;

			seriesData = await getTimeSeriesData({
				relay: relayUrl,
				type: 'rtt',
				since,
				aggregate,
			});

			if (includeDowntimeIndicators && seriesData?.length) {
				const uptimeData = await getTimeSeriesData({
					relay: relayUrl,
					type: 'uptime',
					since,
				});

				if (uptimeData?.length) {
					const dayCounts = new Map<number, { total: number; down: number }>();

					for (const point of uptimeData) {
						const ts = Number((point as any)?.timestamp);
						if (!Number.isFinite(ts)) continue;
						const key = dayKey(ts);
						const counts = dayCounts.get(key) ?? { total: 0, down: 0 };
						counts.total += 1;
						if (Number((point as any)?.value) === 0) counts.down += 1;
						dayCounts.set(key, counts);
					}

					downtimeColors = seriesData.map((point) => {
						const key = dayKey(Number((point as any)?.timestamp));
						const counts = dayCounts.get(key);
						if (!counts || counts.total === 0 || counts.down === 0) return UPTIME_COLORS.up;
						if (counts.down === counts.total) return UPTIME_COLORS.down;
						return UPTIME_COLORS.partial;
					});
				}
			}
		} catch (err: any) {
			console.error('[CardUptime] Error loading chart:', err);
			error = err.message || 'Failed to load uptime chart';
		} finally {
			loading = false;
		}

		if (error) return;

		// Ensure canvas is mounted before creating Chart.js instance.
		await tick();

		const adapter = createChartJsAdapter();
		const smaWindowNum = Math.max(0, Math.floor(Number(smaWindow) || 0));

		// Create uptime chart
		if (seriesData && seriesData.length > 0) {
			const uptimeConfig = adapter.createTimeSeriesChart(seriesData, {
				title: 'RTT',
				theme: 'dark',
				colors: { primary: UPTIME_COLORS.up },
				showTitle: false,
				showGrid: true, 
				showTooltip: true,
				responsive: true,
				...(smaWindowNum > 1 ? { sma: { window: smaWindowNum } } : {})
			});

			if (Array.isArray(downtimeColors) && downtimeColors.length === seriesData.length) {
				const main = uptimeConfig.data.datasets[0] as any;
				main.pointBackgroundColor = downtimeColors;
				main.pointBorderColor = downtimeColors;
				main.segment = {
					borderColor: (ctx: any) => downtimeColors?.[ctx?.p1DataIndex] ?? UPTIME_COLORS.up,
				};
			}

			if (uptimeChart) {
				uptimeChart.destroy();
			}

			if (uptimeCanvas) {
				uptimeChart = new Chart(uptimeCanvas.getContext('2d')!, uptimeConfig);
			}
		} else if (uptimeChart) {
			uptimeChart.destroy();
			uptimeChart = null;
		}
	}

	async function loadEvents(options?: { reset?: boolean }) {
		if (!inView) return;
		const reset = options?.reset ?? false;
		if (reset) {
			eventsLimit = 10;
			eventsHasMore = false;
			eventsError = null;
			deltaEvents = [];
		}

		if (eventsCollapsed) return;

		eventsLoading = true;
		eventsError = null;
		const requestId = ++eventsRequestId;

		try {
			const since = Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
			const until = Math.floor(Date.now() / 1000);
			const limit = Math.max(1, eventsLimit + 1);

			const events = await getDeltaEvents({ relay: relayUrl, since, until, limit });
			if (requestId !== eventsRequestId) return;

			eventsHasMore = events.length > eventsLimit;
			deltaEvents = events.slice(-eventsLimit).reverse();
		} catch (err: any) {
			if (requestId !== eventsRequestId) return;
			console.error('[CardUptime] Error loading Kind 1066 events:', err);
			eventsError = err?.message || 'Failed to load events';
			eventsHasMore = false;
			deltaEvents = [];
		} finally {
			if (requestId === eventsRequestId) {
				eventsLoading = false;
			}
		}
	}

	async function toggleEventsCollapsed() {
		eventsCollapsed = !eventsCollapsed;
		if (!eventsCollapsed && deltaEvents.length === 0) {
			await loadEvents({ reset: true });
		}
	}

	async function loadMoreEvents() {
		eventsLimit += 10;
		await loadEvents();
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
		await loadEvents({ reset: true });
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
			<span>uptime</span>
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
				<canvas bind:this={uptimeCanvas} style="max-height: 300px;"></canvas>
			</div>
		{/if}

		<div class="mt-4">
			<div class="flex items-center justify-between gap-2">
				<div class="text-xs font-mono text-white/60">events (kind 1066)</div>
				<div class="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						on:click={toggleEventsCollapsed}
						disabled={eventsLoading || syncing}
					>
						{eventsCollapsed ? 'Show' : 'Hide'}
					</Button>
					{#if !eventsCollapsed}
						<Button
							variant="secondary"
							size="sm"
							on:click={() => loadEvents({ reset: true })}
							disabled={eventsLoading || syncing}
						>
							Refresh
						</Button>
					{/if}
				</div>
			</div>

			{#if eventsCollapsed}
				<div class="mt-2 text-xs text-white/40">
					Collapsed
				</div>
			{:else if eventsLoading}
				<div class="mt-2 rounded bg-black/20 p-4 text-xs text-white/50">
					Loading events...
				</div>
			{:else if eventsError}
				<div class="mt-2 rounded border border-red-500/30 bg-red-900/20 p-4 text-xs text-red-300">
					<div class="font-semibold">Error loading events</div>
					<div class="mt-1 text-red-200/80">{eventsError}</div>
					<Button
						variant="secondary"
						size="sm"
						class="mt-3"
						on:click={() => loadEvents({ reset: true })}
					>
						Retry
					</Button>
				</div>
			{:else if deltaEvents.length === 0}
				<div class="mt-2 rounded bg-black/20 p-4 text-xs text-white/50">
					No delta events found in this time range.
				</div>
			{:else}
				<div class="mt-2 space-y-1">
					{#each deltaEvents as event (event.id)}
						{@const online = isRelayOnline(event)}
						{@const status = parseOperationalStatus(event)}
						{@const rttOpen = parseRttOpen(event)}
						{@const retry = parseRetryCount(event)}
						{@const deltas = parseDeltas(event)}
						{@const MAX_DELTAS = 25}
						{@const shownDeltas = deltas.slice(0, MAX_DELTAS)}

						<details class="group rounded border border-white/10 bg-black/20">
							<summary class="flex items-center justify-between gap-3 px-2 py-0.5 cursor-pointer select-none">
								<div class="flex items-center gap-2 text-xs font-mono text-white/80 whitespace-nowrap overflow-hidden">
									<span class="text-white/30 transition-transform group-open:rotate-90">▸</span>
									<span class={online ? 'text-emerald-400' : 'text-red-400'}>
										{online ? 'up' : 'down'}
									</span>
									<span class="text-white/40">·</span>
									<span class="text-white/60 truncate">{formatTimestamp(event.created_at)}</span>
								</div>
								<div class="flex items-center gap-2 text-[11px] font-mono text-white/50 whitespace-nowrap">
									{#if status}
										<span>O:{status}</span>
									{/if}
									{#if rttOpen !== undefined}
										<span>rtt:{rttOpen}ms</span>
									{/if}
									{#if retry !== undefined}
										<span>retry:{retry}</span>
									{/if}
									<span>Δ:{deltas.length}</span>
								</div>
							</summary>
							<div class="px-2 pb-2 pt-1 space-y-1 text-xs font-mono text-white/70">
								{#each shownDeltas as delta, idx (idx)}
									<div class="flex gap-2">
										<span
											class={
												delta.type === 'add'
													? 'text-emerald-400'
													: delta.type === 'remove'
														? 'text-red-400'
														: 'text-amber-300'
											}
										>
											{deltaTypeSymbol(delta)}
										</span>
										<span class="text-white/80">{delta.key}</span>
										<span class="text-white/30">=</span>
										<span class="break-all text-white/60">{truncateDeltaValue(delta.value)}</span>
									</div>
								{/each}
								{#if deltas.length > MAX_DELTAS}
									<div class="text-xs text-white/40">
										Showing first {MAX_DELTAS} of {deltas.length} deltas
									</div>
								{/if}
							</div>
						</details>
					{/each}
				</div>

				<div class="mt-3 flex items-center justify-between">
					<div class="text-xs text-white/40">
						Showing {deltaEvents.length} event{deltaEvents.length === 1 ? '' : 's'}
					</div>
					{#if eventsHasMore}
						<Button
							variant="secondary"
							size="sm"
							on:click={loadMoreEvents}
							disabled={eventsLoading || syncing}
						>
							Load 10 more
						</Button>
					{:else}
						<div class="text-xs text-white/40">No more events</div>
					{/if}
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
		height: auto !important;
	}

	details > summary {
		list-style: none;
	}

	details > summary::-webkit-details-marker {
		display: none;
	}
</style>
