<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { relayLivenessAggregate$ } from '$stores/helpers/helpers-relay';
	import Chart from 'chart.js/auto';

	export let relayUrl: string;

	let canvas: HTMLCanvasElement;
	let chart: any = null;
	let loading = true;
	let error: string | null = null;

	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	const aggregate$ = relayLivenessAggregate$(relayUrl);

	onMount(() => {
		const unsubscribe = aggregate$.subscribe(aggregate => {
			if (aggregate) {
				loadChart(aggregate);
			}
		});

		return unsubscribe;
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	function loadChart(aggregate: any) {
		loading = true;
		error = null;

		try {
			// Extract limitations from aggregate
			const limitations = {
				maxSubscriptions: aggregate.maxSubscriptions || 0,
				maxFilters: aggregate.maxFilters || 0,
				maxLimit: aggregate.maxLimit || 0,
				maxSubidLength: aggregate.maxSubidLength || 0,
				maxEventTags: aggregate.maxEventTags || 0,
				maxContentLength: aggregate.maxContentLength || 0,
			};

			// Normalize values to 0-100 scale for radar chart
			const normalizedData = {
				'Max Subs': Math.min((limitations.maxSubscriptions / 20) * 100, 100),
				'Max Filters': Math.min((limitations.maxFilters / 10) * 100, 100),
				'Max Limit': Math.min((limitations.maxLimit / 5000) * 100, 100),
				'Max Subid Len': Math.min((limitations.maxSubidLength / 100) * 100, 100),
				'Max Event Tags': Math.min((limitations.maxEventTags / 2000) * 100, 100),
				'Max Content': Math.min((limitations.maxContentLength / 100000) * 100, 100),
			};

			const chartConfig = {
				type: 'radar',
				data: {
					labels: Object.keys(normalizedData),
					datasets: [{
						label: 'Limitations',
						data: Object.values(normalizedData),
						backgroundColor: 'rgba(99, 102, 241, 0.2)',
						borderColor: 'rgba(99, 102, 241, 0.8)',
						borderWidth: 2,
						pointBackgroundColor: 'rgba(99, 102, 241, 1)',
						pointBorderColor: '#fff',
						pointHoverBackgroundColor: '#fff',
						pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						r: {
							beginAtZero: true,
							max: 100,
							ticks: {
								display: false,
								stepSize: 20,
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.1)',
							},
							pointLabels: {
								color: 'rgba(255, 255, 255, 0.8)',
								font: {
									family: 'monospace',
									size: 11,
								}
							}
						}
					},
					plugins: {
						legend: {
							display: false,
						},
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							titleColor: 'rgba(255, 255, 255, 0.9)',
							bodyColor: 'rgba(255, 255, 255, 0.8)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							borderWidth: 1,
							padding: 12,
							callbacks: {
								label: function(context: any) {
									const label = context.label || '';
									const rawValues: Record<string, number> = {
										'Max Subs': limitations.maxSubscriptions,
										'Max Filters': limitations.maxFilters,
										'Max Limit': limitations.maxLimit,
										'Max Subid Len': limitations.maxSubidLength,
										'Max Event Tags': limitations.maxEventTags,
										'Max Content': limitations.maxContentLength,
									};
									return `${label}: ${rawValues[label] || 'unlimited'}`;
								}
							}
						}
					}
				}
			};

			if (chart) {
				chart.destroy();
			}

			if (canvas) {
				chart = new Chart(canvas.getContext('2d')!, chartConfig);
			}

			loading = false;
		} catch (err: any) {
			console.error('[ChartLimitations] Error loading chart:', err);
			error = err.message || 'Failed to load limitations chart';
			loading = false;
		}
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>limitations</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Relay capacity and restrictions
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading}
			<div class="flex items-center justify-center p-8">
				<div class="text-white/60">Loading chart...</div>
			</div>
		{:else if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading chart</p>
				<p class="text-sm mt-1">{error}</p>
			</div>
		{:else}
			<div class="bg-black/30 p-4 rounded" style="height: 350px;">
				<canvas bind:this={canvas}></canvas>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			From relay NIP-11 limitations
		</div>
	</Card.Footer>
</Card.Root>

<style>
	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>
