<script lang="ts">
	import { onDestroy } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { observeInView, type InViewChangeDetail } from '$utils/ux';
	import {
		subscribeRelayDeltas,
		type RelayDeltasSubscriptionHandle,
		updateRelayDeltasSince,
		getChronicleStorage
	} from '$lib/stores/chronicle';
	import { generateChangeTimeline, parseDeltas } from '@nostrwatch/relay-chronicle';

	export let relayUrl: string;
	export let timeRange: string;
	export let timeRanges: Record<string, { label: string; seconds: number }>;

	let loading = true;
	let error: string | null = null;
	let syncing = false;
	let changes: any[] = [];
	let showAnyways = false;
	let inView = false;
	let subscription: RelayDeltasSubscriptionHandle | null = null;

	// Minimum data points for meaningful chart
	const MIN_DATA_POINTS = 3;

	onDestroy(async () => {
		if (subscription) {
			await subscription.stop();
			subscription = null;
		}
	});

	async function startVisibleSync() {
		const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
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
				console.warn('[ChartFieldChanges] Failed to start visible sync:', err);
			}
		}

		await loadData();
	}

	async function loadData() {
		if (!inView) return;

		loading = true;
		error = null;

		try {
			const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;

			// Get real field changes from Kind 1066 events
			const storage = getChronicleStorage();
			if (storage) {
				const timeline = await generateChangeTimeline({
					storage,
					relay: relayUrl,
					since,
				});

				// Filter to only field/infrastructure changes (not operational)
				changes = timeline
					.filter(change => change.type !== 'operational')
					.flatMap(change => {
						// Parse deltas from the change event
						if (!change.deltas || change.deltas.length === 0) return [];

						return change.deltas.map(delta => ({
							timestamp: change.timestamp,
							field: delta.key,
							from: delta.type === 'change' ? '(previous value)' : undefined,
							to: String(delta.value),
						}));
					});
			} else {
				console.warn('[ChartFieldChanges] Chronicle storage not available');
			}

			loading = false;
		} catch (err: any) {
			console.error('[ChartFieldChanges] Error loading data:', err);
			error = err.message || 'Failed to load field changes';
			loading = false;
		}
	}

	function formatTimestamp(ts: number): string {
		return new Date(ts * 1000).toLocaleString();
	}

	$: if (timeRange && inView) {
		showAnyways = false; // Reset override when time range changes
		const since = timeRange === 'all' ? 0 : Math.floor(Date.now() / 1000) - timeRanges[timeRange].seconds;
		if (subscription) void updateRelayDeltasSince(relayUrl, { since }).catch(() => {});
		loadData();
	}
</script>

<div use:observeInView={{ threshold: 0.25, debounceMs: 150 }} on:inviewchange={handleInViewChange}>
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
				<p class="mb-2">No field changes detected in this time range</p>
				<p class="text-xs text-white/40">This relay may be new or hasn't had any configuration updates</p>
			</div>
		{:else if changes.length < MIN_DATA_POINTS && !showAnyways}
			<div class="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
				<p class="text-yellow-300 font-semibold mb-2">Limited Data</p>
				<p class="text-sm text-yellow-200/80 mb-4">
					Only {changes.length} field {changes.length === 1 ? 'change' : 'changes'} detected.
					This may indicate a new relay or limited monitoring history.
				</p>
				<button
					on:click={() => showAnyways = true}
					class="px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 rounded text-yellow-200 text-sm transition-colors"
				>
					Show it anyways
				</button>
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
</div>
