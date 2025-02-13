<script lang="ts">
	import { dndzone, dragHandle } from 'svelte-dnd-action';
	import * as Dialog from '$lib/components/ui/dialog';
	import Button from '$ui/button/button.svelte';
	import { fade } from 'svelte/transition';

	import { StateManager } from '@nostrwatch/route66';

	import SettingsIcon from 'lucide-svelte/icons/settings';

	const cardModules = import.meta.glob('./**/cards/*.svelte');
	const cardImports = {
		general: cardModules['./(components)/cards/CardGeneral.svelte'],
		fees: cardModules['./(components)/cards/CardFees.svelte'],
		operator: cardModules['./(components)/cards/CardOperator.svelte'],
		insights: cardModules['./(components)/cards/CardInsights.svelte'],
		checks: cardModules['./(components)/cards/CardChecks.svelte'],
		nip11Limitation: cardModules['./(components)/cards/CardLimitation.svelte'],
		nip11SupportedNips: cardModules['./(components)/cards/CardNips.svelte'],
		issues: cardModules['./(components)/cards/CardIssues.svelte'],
		similarRelays: cardModules['./(components)/cards/CardSimilarRelays.svelte']
	};
  
	const availableCards = [
	  'general',
	  'issues',
	  'nip11Limitation',
	  'nip11SupportedNips',
	  'fees',
	  'operator',
	  'similarRelays',
	  'insights',
	  'checks'
	];

	const defaultCardsView = [
	  'general',
	  'fees',
	  'operator',
	  'insights',
	  'checks'
	];

	const unHidableCards = ['fees'];

	let cardsUser = StateManager.get('preferences:relay:overview:cards');

	const cardsVisible = Array.isArray(cardsUser)? cardsUser: defaultCardsView
	const cardsOrder = cardsUser? cardsUser: defaultCardsView

	let availableCardsFormatted: { id: string }[] = availableCards.map(card => ({ id: card }));
  
	let enabledCards: { id: string }[] = cardsVisible.map(card => ({ id: card }));
	$: disabledCards = availableCards.filter(
	  card => !enabledCards.some(item => item.id === card)
	);
  
	function handleConsider(e: CustomEvent) {
	  if (e.detail && Array.isArray(e.detail.items) && e.detail.items.length > 0) {
		enabledCards = e.detail.items;
	  }
	}
	function handleFinalize(e: CustomEvent) {
	  if (e.detail && Array.isArray(e.detail.items) && e.detail.items.length > 0) {
		enabledCards = e.detail.items;
	  }
	  StateManager.set('preferences:relay:overview:cards', enabledCards.map(item => item.id));
	}

	function toggleCard(card: string) {
	  if (enabledCards.some(item => item.id === card)) {
		enabledCards = enabledCards.filter(item => item.id !== card);
	  } else {
		enabledCards = [...enabledCards, {id: card}];
	  }
	}
  </script>
  
  <div class="flex justify-end">
	<Dialog.Root>
		<Dialog.Trigger>
			<Button variant="secondary" size="sm" class="mb-2">
		  <SettingsIcon size={18} class="mr-2" /> customize view
		</Button>
		</Dialog.Trigger>
		<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Customize View</Dialog.Title>
			<Dialog.Description>
			<div>
				<h3 class="mb-2">
				Enabled Cards (drag to reorder; click “Disable” to remove)
				</h3>
				<div
				class="sortable border p-2"
				use:dndzone={{
					items: enabledCards,
					flipDurationMs: 0,
					dropFromOthersDisabled: true
				}}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
				>
				{#each enabledCards as item (item.id)}
					<div
					class="sortable-item flex items-center justify-between p-2 mb-1 border rounded"
					data-id={item.id}
					>
					<span use:dragHandle class="cursor-move text-white">{item.id}</span>
					{#if unHidableCards.includes(item.id)}
					<em>must be active</em>
					{:else}
					<button
						data-dnd-no-drag
						draggable="false"
						style="pointer-events: auto;"
						class="text-red-800"
						onclick={() => toggleCard(item.id)}
					>
						Hide
					</button>
					{/if}
					</div>
				{/each}
				</div>
			</div>
	
			<div class="mt-4">
				<h3 class="mb-2">Disabled Cards (click to enable)</h3>
				<div class="disabled-cards border p-2">
				{#each disabledCards as card}
					<div
					class="disabled-item p-2 mb-1 border rounded opacity-50 hover:opacity-75 cursor-pointer"
					data-id={card}
					onclick={() => toggleCard(card)}
					>
					{card}
					</div>
				{/each}
				</div>
			</div>
			</Dialog.Description>
		</Dialog.Header>
		</Dialog.Content>
	</Dialog.Root>
	</div>
  
  <div class="space-y-6">
	{#if enabledCards.length}
	{#each enabledCards as item (item.id)}
	  {#if cardImports?.[item.id]}
	  {#await cardImports[item.id]()}
		<!-- loading... -->
	  {:then { default: Component } }
		<div in:fade={{ duration: 500 }}>
		  <svelte:component this={Component} />
		</div>
	  {:catch error}
		<div class="bg-red-100 p-4 rounded-lg">
		  <p class="text-red-800">Error loading {item.id} card</p>
		  <p class="text-red-800">{error.message}</p>
		</div>
	  {/await}
	  {/if}
	{/each}
	{/if}
  </div>
  