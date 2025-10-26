<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import {
		syncRelay,
		unsyncRelay,
		isSyncing
	} from '$lib/stores/chronicle';

	export let relayUrl: string;
	export let timeRange: string;
	export let timeRanges: Record<string, { label: string; seconds: number }>;

	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let changes: any[] = [];

	onMount(async () => {
		await loadData();
	});

	onDestroy(async () => {
		if (isSyncing(relayUrl)) {
			await unsyncRelay(relayUrl);
		}
	});

	async function loadData() {
		loading = true;
		error = null;

		try {
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

			// TODO: Parse Kind 1066 events for field changes
			// Look for delta events where fields changed (not just operational status)
			changes = generateFieldChangesData(since);

			loading = false;
		} catch (err: any) {
			console.error('[ChartFieldChanges] Error loading data:', err);
			error = err.message || 'Failed to load field changes';
			loading = false;
		}
	}

	function generateFieldChangesData(since: number) {
		// TODO: Parse actual field changes from Kind 1066 events
		// For now, return mock changes
		const now = Date.now() / 1000;
		return [
			{
				timestamp: since + (now - since) * 0.2,
				field: 'info.name',
				from: 'My Relay',
				to: 'My Awesome Relay',
			},
			{
				timestamp: since + (now - since) * 0.5,
				field: 'info.supported_nips',
				from: '[1, 2, 4]',
				to: '[1, 2, 4, 9, 11]',
			},
			{
				timestamp: since + (now - since) * 0.8,
				field: 'info.version',
				from: '1.0.0',
				to: '1.1.0',
			},
		];
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	$: if (timeRange) {
		loadData();
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>field changes</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Configuration and NIP-11 changes over time
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading || syncing}
			<div class="flex items-center justify-center p-8">
				<div class="text-white/60">
					{syncing ? 'Syncing relay data...' : 'Loading changes...'}
				</div>
			</div>
		{:else if error}
			<div class="bg-red-900/20 border border-red-500/30 rounded p-4 text-red-300">
				<p class="font-semibold">Error loading changes</p>
				<p class="text-sm mt-1">{error}</p>
			</div>
		{:else if changes.length === 0}
			<div class="p-8 text-center text-white/50">
				No field changes detected in this time range
			</div>
		{:else}
			<div class="space-y-3">
				{#each changes as change}
					<div class="bg-black/30 p-4 rounded border border-white/5">
						<div class="flex justify-between items-start mb-2">
							<span class="font-mono text-sm text-indigo-400">{change.field}</span>
							<span class="text-xs text-white/40">{formatTimestamp(change.timestamp)}</span>
						</div>
						<div class="flex items-center gap-2 text-sm">
							<span class="text-red-300">{String(change.from)}</span>
							<span class="text-white/40">→</span>
							<span class="text-green-300">{String(change.to)}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			Configuration changes from Kind 1066 delta events
		</div>
	</Card.Footer>
</Card.Root>
