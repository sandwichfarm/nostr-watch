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
			// Determine which networks/protocols are supported
			const hasIPv4 = aggregate.ipv4 && aggregate.ipv4.length > 0;
			const hasIPv6 = aggregate.ipv6 && aggregate.ipv6.length > 0;

			// Check if relay URL suggests Tor or I2P
			const hasTor = relayUrl.includes('.onion');
			const hasI2P = relayUrl.includes('.i2p');

			const protocols: string[] = [];
			const values: number[] = [];
			const colors: string[] = [];

			if (hasIPv4) {
				protocols.push('IPv4');
				values.push(1);
				colors.push('#10b981');
			}
			if (hasIPv6) {
				protocols.push('IPv6');
				values.push(1);
				colors.push('#3b82f6');
			}
			if (hasTor) {
				protocols.push('Tor');
				values.push(1);
				colors.push('#8b5cf6');
			}
			if (hasI2P) {
				protocols.push('I2P');
				values.push(1);
				colors.push('#f59e0b');
			}

			if (protocols.length === 0) {
				protocols.push('Unknown');
				values.push(1);
				colors.push('#6b7280');
			}

			const chartConfig = {
				type: 'doughnut',
				data: {
					labels: protocols,
					datasets: [{
						data: values,
						backgroundColor: colors,
						borderColor: '#1a1a1a',
						borderWidth: 2,
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'bottom',
							labels: {
								color: 'rgba(255, 255, 255, 0.8)',
								font: {
									family: 'monospace',
									size: 12,
								},
								padding: 15,
								generateLabels: function(chart: any) {
									const data = chart.data;
									return data.labels.map((label: string, i: number) => ({
										text: label,
										fillStyle: data.datasets[0].backgroundColor[i],
										hidden: false,
										index: i
									}));
								}
							}
						},
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							titleColor: 'rgba(255, 255, 255, 0.9)',
							bodyColor: 'rgba(255, 255, 255, 0.8)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							borderWidth: 1,
							padding: 12,
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
			console.error('[ChartNetworkProtocols] Error loading chart:', err);
			error = err.message || 'Failed to load network protocols chart';
			loading = false;
		}
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>network protocols</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Supported network protocols and accessibility
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
			<div class="bg-black/30 p-4 rounded" style="height: 300px;">
				<canvas bind:this={canvas}></canvas>
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			Network accessibility from check data
		</div>
	</Card.Footer>
</Card.Root>

<style>
	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>
