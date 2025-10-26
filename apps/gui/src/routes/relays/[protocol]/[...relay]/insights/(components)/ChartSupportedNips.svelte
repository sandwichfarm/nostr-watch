<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { relayLivenessAggregate$ } from '$stores/helpers/helpers-relay';

	export let relayUrl: string;

	let loading = true;
	let supportedNips: string[] = [];

	const aggregate$ = relayLivenessAggregate$(relayUrl);

	// Common NIPs to display
	const commonNips = [
		'1', '2', '4', '9', '11', '12', '13', '15', '16', '20', '22', '25', '26',
		'28', '33', '40', '42', '45', '50', '51', '56', '57', '58', '65', '66'
	];

	onMount(() => {
		const unsubscribe = aggregate$.subscribe(aggregate => {
			if (aggregate && aggregate.supportedNips) {
				supportedNips = aggregate.supportedNips;
				loading = false;
			}
		});

		return unsubscribe;
	});

	function isSupported(nip: string): boolean {
		return supportedNips.includes(nip) || supportedNips.includes(parseInt(nip).toString());
	}
</script>

<Card.Root class="w-full bg-black/20 border-white/10 rounded-[3px]">
	<Card.Header>
		<Card.Title class='font-mono text-white/80'>
			<span>supported nips</span>
		</Card.Title>
		<Card.Description class="text-white/50">
			Which Nostr Implementation Possibilities this relay supports
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if loading}
			<div class="flex items-center justify-center p-8">
				<div class="text-white/60">Loading NIPs...</div>
			</div>
		{:else if supportedNips.length === 0}
			<div class="p-8 text-center text-white/50">
				No NIP support information available
			</div>
		{:else}
			<div class="bg-black/30 p-4 rounded">
				<div class="grid grid-cols-5 gap-2">
					{#each commonNips as nip}
						<div
							class="
								flex items-center justify-center
								p-3 rounded
								font-mono text-sm
								transition-all duration-200
								{isSupported(nip)
									? 'bg-green-500/20 border border-green-500/40 text-green-300'
									: 'bg-white/5 border border-white/10 text-white/30'
								}
							"
							title="{isSupported(nip) ? 'Supported' : 'Not Supported'}"
						>
							NIP-{nip}
						</div>
					{/each}
				</div>
				{#if supportedNips.length > 0}
					<div class="mt-4 pt-4 border-t border-white/10">
						<p class="text-xs text-white/60">
							Total: {supportedNips.length} NIPs supported
						</p>
						<p class="text-xs text-white/40 mt-1">
							{supportedNips.join(', ')}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
	<Card.Footer>
		<div class="text-xs text-white/40">
			From relay NIP-11 information
		</div>
	</Card.Footer>
</Card.Root>

<style>
	.grid > div:hover {
		transform: scale(1.05);
	}
</style>
