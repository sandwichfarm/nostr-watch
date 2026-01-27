<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import MiniSearch from 'minisearch';
	import { relayCheckAggregates, relaysForMiniSearch } from '$lib/stores/checks.js';
	import { derived } from 'svelte/store';
	import Input from '$lib/components/ui/input/input.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	export let placeholder: string = 'wss://relay.example.com';
	export let buttonText: string = 'Add';
	export let maxResults: number = 8;

	const dispatch = createEventDispatcher<{
		add: { url: string };
	}>();

	let inputValue = '';
	let showSuggestions = false;
	let selectedIndex = -1;
	let suggestions: Array<{ relay: string; score: number }> = [];
	let inputElement: HTMLInputElement;
	let wrapperElement: HTMLDivElement;

	// Build relay data from aggregates or seed data
	const relayData = derived(
		[relayCheckAggregates, relaysForMiniSearch],
		([$aggregates, $seedRelays]) => {
			const relays = $aggregates?.length
				? $aggregates.map((item: any) => ({
						id: item.relay,
						relay: item.relay
					}))
				: $seedRelays?.length
					? $seedRelays.map((item: any) => ({
							id: item.relay || item.id,
							relay: item.relay || item.id
						}))
					: [];

			// Deduplicate
			const seen = new Set<string>();
			return relays.filter((r: any) => {
				if (seen.has(r.relay)) return false;
				seen.add(r.relay);
				return true;
			});
		}
	);

	let miniSearch: MiniSearch | null = null;

	// Initialize MiniSearch when relay data is available
	$: if ($relayData.length > 0 && !miniSearch) {
		miniSearch = new MiniSearch({
			fields: ['relay'],
			storeFields: ['relay'],
			searchOptions: {
				fuzzy: 0.2,
				prefix: true
			}
		});
		miniSearch.addAll($relayData);
	}

	function handleInput() {
		if (!inputValue.trim()) {
			showSuggestions = false;
			suggestions = [];
			return;
		}

		if (miniSearch) {
			const results = miniSearch.search(inputValue);
			suggestions = results.slice(0, maxResults).map((r) => ({
				relay: r.relay as string,
				score: r.score
			}));
			showSuggestions = suggestions.length > 0;
		}
		selectedIndex = -1;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!showSuggestions) {
			if (event.key === 'Enter') {
				event.preventDefault();
				handleAdd();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (selectedIndex < suggestions.length - 1) {
					selectedIndex++;
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (selectedIndex > 0) {
					selectedIndex--;
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
					selectSuggestion(suggestions[selectedIndex].relay);
				} else {
					handleAdd();
				}
				break;
			case 'Escape':
				showSuggestions = false;
				break;
		}
	}

	function selectSuggestion(relay: string) {
		inputValue = relay;
		showSuggestions = false;
		selectedIndex = -1;
		handleAdd();
	}

	function handleAdd() {
		const url = inputValue.trim();
		if (!url) return;

		dispatch('add', { url });
		inputValue = '';
		showSuggestions = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (wrapperElement && !wrapperElement.contains(event.target as Node)) {
			showSuggestions = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="relative" bind:this={wrapperElement}>
	<div class="flex gap-2">
		<div class="relative flex-1">
			<Input
				bind:value={inputValue}
				bind:this={inputElement}
				{placeholder}
				on:input={handleInput}
				on:keydown={handleKeyDown}
				on:focus={() => inputValue && handleInput()}
				autocomplete="off"
			/>

			{#if showSuggestions && suggestions.length > 0}
				<div
					class="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg"
				>
					{#each suggestions as suggestion, index}
						<button
							type="button"
							class="w-full px-3 py-2 text-left text-sm font-mono hover:bg-muted transition-colors {index ===
							selectedIndex
								? 'bg-muted'
								: ''}"
							on:click={() => selectSuggestion(suggestion.relay)}
							on:mouseenter={() => (selectedIndex = index)}
						>
							{suggestion.relay}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<Button on:click={handleAdd} variant="outline">{buttonText}</Button>
	</div>

	{#if inputValue && !showSuggestions}
		<div class="text-xs text-muted-foreground mt-1">
			Press Enter to add custom relay
		</div>
	{/if}
</div>
