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
			// Categorize checks by result
			let online = 0;
			let offline = 0;
			let timeout = 0;
			let unknown = 0;

			checks.forEach(check => {
				// Check if relay has RTT (indicates successful connection)
				if (check.rtt && check.rtt > 0) {
					online++;
				} else {
					// Could analyze other fields to determine offline vs timeout
					// For now, treat no RTT as offline
					offline++;
				}
			});

			const chartConfig = {
				type: 'bar',
				data: {
					labels: ['Online', 'Offline'],
					datasets: [{
						label: 'Check Results',
						data: [online, offline],
						backgroundColor: [
							'rgba(34, 197, 94, 0.8)',  // green for online
							'rgba(239, 68, 68, 0.8)',  // red for offline
						],
						borderColor: [
							'rgba(34, 197, 94, 1)',
							'rgba(239, 68, 68, 1)',
						],
						borderWidth: 1,
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								color: 'rgba(255, 255, 255, 0.6)',
								font: {
									family: 'monospace',
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.05)',
							}
						},
						x: {
							ticks: {
								color: 'rgba(255, 255, 255, 0.6)',
								font: {
									family: 'monospace',
								}
							},
							grid: {
								display: false,
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
			console.error('[ChartCheckResults] Error loading chart:', err);
			error = err.message || 'Failed to load check results';
			loading = false;
		}
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>check results</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Success vs failure distribution
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
			Based on current check data
		</div>
	</Card.Footer>
</Card.Root>

<style>
	canvas {
		width: 100% !important;
		height: 100% !important;
	}
</style>
