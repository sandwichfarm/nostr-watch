<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import Chart from 'chart.js/auto';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';

	export let relayUrl: string;

	let canvas: HTMLCanvasElement;
	let chart: any = null;
	let loading = true;
	let error: string | null = null;

	if (typeof window !== 'undefined') {
		(globalThis as any).Chart = Chart;
	}

	const checks$ = relayLivenessChecks$(relayUrl);

	onMount(() => {
		const unsubscribe = checks$.subscribe(checks => {
			if (checks && checks.length > 0) {
				loadChart(checks);
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

	function loadChart(checks: Nip66CheckEvent[]) {
		loading = true;
		error = null;

		try {
			// Count checks per monitor
			const monitorCounts = new Map<string, number>();
			checks.forEach(check => {
				const count = monitorCounts.get(check.monitorPubkey) || 0;
				monitorCounts.set(check.monitorPubkey, count + 1);
			});

			// Convert to chart data
			const labels: string[] = [];
			const data: number[] = [];
			const colors: string[] = [];

			const colorPalette = [
				'#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
				'#10b981', '#3b82f6', '#ef4444', '#14b8a6'
			];

			let colorIndex = 0;
			monitorCounts.forEach((count, pubkey) => {
				labels.push(pubkey.substring(0, 8) + '...');
				data.push(count);
				colors.push(colorPalette[colorIndex % colorPalette.length]);
				colorIndex++;
			});

			const chartConfig = {
				type: 'doughnut',
				data: {
					labels,
					datasets: [{
						data,
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
							position: 'right',
							labels: {
								color: 'rgba(255, 255, 255, 0.8)',
								font: {
									family: 'monospace',
									size: 11,
								},
								padding: 10,
							}
						},
						tooltip: {
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							titleColor: 'rgba(255, 255, 255, 0.9)',
							bodyColor: 'rgba(255, 255, 255, 0.8)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							borderWidth: 1,
							padding: 12,
							displayColors: true,
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
			console.error('[ChartMonitorDistribution] Error loading chart:', err);
			error = err.message || 'Failed to load monitor distribution';
			loading = false;
		}
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>monitor distribution</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Which monitors are checking this relay
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
			Distribution of checks across monitors
		</div>
	</Card.Footer>
</Card.Root>

<style>
	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>
