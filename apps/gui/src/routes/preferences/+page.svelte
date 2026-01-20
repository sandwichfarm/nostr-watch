<script lang="ts">
    import { onMount } from 'svelte';
    import { instance } from '$lib/utils/lifecycle.js';
    import { wipeCache, wipeCacheAdapter, wipeState } from '$lib/utils/cache.js';
	import type Route66 from '@nostrwatch/route66'
	import Button from '$lib/components/ui/button/button.svelte';
	import { doBootstrap } from '$stores/routines';
	import Input from '$lib/components/ui/input/input.svelte';
	import {
		DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD,
		DEFAULT_MONITOR_LIVENESS_LENIENCY,
		monitorsLivenessDeadThreshold,
		monitorsLivenessLeniency
	} from '$lib/stores/monitors.js';
	import {
		derivationMode,
		DEFAULT_DERIVATION_MODE,
		type DerivationMode
	} from '$lib/stores/dimension-stores';
	import {
		nip66RelaysStore,
		nip66Relays
	} from '$lib/stores/nip66-relays';
	import { preferences } from '$lib/stores/preferences';
	import RelayAutosuggestInput from '$lib/components/partials/RelayAutosuggestInput.svelte';
	import timestring from 'timestring';

	// NIP-66 relay management
	let newRelayError: string | null = null;
	let relayActionError: string | null = null;

	function handleAddRelay(event: CustomEvent<{ url: string }>) {
		newRelayError = null;
		const { url } = event.detail;
		if (!url.trim()) {
			newRelayError = 'Please enter a relay URL';
			return;
		}
		const result = nip66RelaysStore.addRelay(url.trim());
		if (!result.success) {
			newRelayError = result.error || 'Failed to add relay';
		}
	}

	function handleRemoveRelay(url: string) {
		relayActionError = null;
		const result = nip66RelaysStore.removeRelay(url);
		if (!result.success) {
			relayActionError = result.error || 'Failed to remove relay';
			setTimeout(() => relayActionError = null, 3000);
		}
	}

	function handleToggleRelay(url: string) {
		relayActionError = null;
		const result = nip66RelaysStore.toggleRelay(url);
		if (!result.success) {
			relayActionError = result.error || 'Failed to toggle relay';
			setTimeout(() => relayActionError = null, 3000);
		}
	}

	function handleResetRelays() {
		nip66RelaysStore.reset();
	}

    let Nip66Instance: Route66 | null;
	let wipingSqlite = false;
	let wipingLocalStorage = false;
	let wipingAll = false;

	async function handleWipeSqlite() {
		if (wipingSqlite) return;
		wipingSqlite = true;
		try {
			const $route66 = await instance();
			await wipeCacheAdapter($route66);
			window.location.reload();
		} catch (e) {
			console.error('Failed to wipe SQLite cache:', e);
			wipingSqlite = false;
		}
	}

	async function handleWipeLocalStorage() {
		if (wipingLocalStorage) return;
		wipingLocalStorage = true;
		try {
			await wipeState();
			window.location.reload();
		} catch (e) {
			console.error('Failed to wipe localStorage:', e);
			wipingLocalStorage = false;
		}
	}

	async function handleWipeAll() {
		if (wipingAll) return;
		wipingAll = true;
		try {
			await wipeCache();
		} catch (e) {
			console.error('Failed to wipe all data:', e);
			wipingAll = false;
		}
	}
	let deadThresholdDraft: string = $monitorsLivenessDeadThreshold;
	let deadThresholdError: string | null = null;
	let editingDeadThreshold = false;

	const allowedTimestringKey = (event: KeyboardEvent) => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const key = event.key;
		const allowedNonChar = [
			'Backspace',
			'Delete',
			'Tab',
			'Enter',
			'Escape',
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
			'Home',
			'End'
		];
		if (allowedNonChar.includes(key)) return;
		if (key.length !== 1) return;
		if (!/^[0-9smhdwySMHDWY\\s]$/.test(key)) {
			event.preventDefault();
		}
	};

	const commitDeadThreshold = () => {
		const cleaned = deadThresholdDraft.trim().toLowerCase();
		if (!cleaned) {
			deadThresholdError = null;
			monitorsLivenessDeadThreshold.set(DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD);
			deadThresholdDraft = DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD;
			return;
		}

		try {
			const seconds = timestring(cleaned);
			if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('invalid');
			deadThresholdError = null;
			monitorsLivenessDeadThreshold.set(cleaned);
		} catch {
			deadThresholdError = 'Invalid timestring (example: 30d)';
			deadThresholdDraft = $monitorsLivenessDeadThreshold;
		}
	};

	$: if (!editingDeadThreshold) {
		deadThresholdDraft = $monitorsLivenessDeadThreshold;
	}

    onMount(async () => {
        doBootstrap.set(false)
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        Nip66Instance = await instance();
    });
</script>
<div class="px-8 mt-16 space-y-8">
	<section class="max-w-xl">
		<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">NIP-66 Relays</h2>
		<p class="text-sm opacity-70 mb-4">
			Configure which relays to use for fetching relay metadata and monitoring data.
			At least one relay must be enabled.
		</p>

		{#if relayActionError}
			<div class="text-sm text-red-500 mb-3 p-2 bg-red-500/10 rounded">{relayActionError}</div>
		{/if}

		<div class="space-y-2 mb-4">
			{#each $nip66Relays as relay (relay.url)}
				<div class="flex items-center gap-3 p-3 border rounded-md {relay.enabled ? 'border-border' : 'border-border/50 opacity-60'}">
					<button
						type="button"
						on:click={() => handleToggleRelay(relay.url)}
						class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors {relay.enabled ? 'bg-primary border-primary' : 'border-muted-foreground'}"
						title={relay.enabled ? 'Disable relay' : 'Enable relay'}
					>
						{#if relay.enabled}
							<svg class="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</button>

					<div class="flex-1 min-w-0">
						<div class="font-mono text-sm truncate">{relay.url}</div>
						{#if relay.description}
							<div class="text-xs opacity-60">{relay.description}</div>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						{#if relay.isDefault}
							<span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Default</span>
						{:else}
							<button
								type="button"
								on:click={() => handleRemoveRelay(relay.url)}
								class="text-destructive hover:text-destructive/80 p-1"
								title="Remove relay"
								aria-label="Remove relay {relay.url}"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<RelayAutosuggestInput
			placeholder="Search or enter relay URL..."
			on:add={handleAddRelay}
		/>
		{#if newRelayError}
			<div class="text-xs text-red-500 mt-1">{newRelayError}</div>
		{/if}

		<div class="mt-4">
			<Button on:click={handleResetRelays} variant="ghost" class="text-xs opacity-60">
				Reset to defaults
			</Button>
		</div>
	</section>

	<section class="max-w-xl">
		<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Monitors</h2>

		<div class="space-y-5">
			<div>
				<div class="flex items-baseline justify-between mb-2">
					<label class="text-sm font-medium">Offline leniency</label>
					<span class="text-xs opacity-60">{$monitorsLivenessLeniency.toFixed(2)}×</span>
				</div>
				<input
					type="range"
					min="1"
					max="2"
					step="0.05"
					value={$monitorsLivenessLeniency}
					on:input={(e) => monitorsLivenessLeniency.set(Number((e.currentTarget as HTMLInputElement).value))}
					class="w-full"
				/>
				<div class="text-xs opacity-60 mt-1">
					1.0 = strict; 2.0 = 100% extra time (default {DEFAULT_MONITOR_LIVENESS_LENIENCY})
				</div>
			</div>

			<div>
				<label class="text-sm font-medium">Likely dead threshold</label>
				<div class="mt-2">
					<Input
						value={deadThresholdDraft}
						placeholder={DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD}
						on:focus={() => (editingDeadThreshold = true)}
						on:blur={() => {
							editingDeadThreshold = false;
							commitDeadThreshold();
						}}
						on:keydown={(e) => {
							allowedTimestringKey(e);
							if (e.key === 'Enter') {
								(e.currentTarget as HTMLInputElement).blur();
							}
						}}
						on:input={(e) => (deadThresholdDraft = (e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
				{#if deadThresholdError}
					<div class="text-xs text-red-500 mt-1">{deadThresholdError}</div>
				{:else}
					<div class="text-xs opacity-60 mt-1">Timestring (default {DEFAULT_MONITOR_LIVENESS_DEAD_THRESHOLD})</div>
				{/if}
			</div>
		</div>
	</section>

	<section class="max-w-xl">
		<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Derivation</h2>
		<p class="text-sm opacity-70 mb-4">
			Controls how dimension data (geocodes, software, ISPs, NIPs) is computed.
		</p>

		<div class="space-y-3">
			<label class="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors {$derivationMode === 'worker' ? 'border-primary bg-primary/5' : ''}">
				<input
					type="radio"
					name="derivation-mode"
					value="worker"
					checked={$derivationMode === 'worker'}
					on:change={() => derivationMode.set('worker')}
					class="mt-0.5"
				/>
				<div>
					<div class="font-medium">Web Workers</div>
					<div class="text-sm opacity-70">
						Compute dimensions off the main thread for better UI responsiveness.
						Recommended for most users.
					</div>
				</div>
			</label>

			<label class="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors {$derivationMode === 'legacy' ? 'border-primary bg-primary/5' : ''}">
				<input
					type="radio"
					name="derivation-mode"
					value="legacy"
					checked={$derivationMode === 'legacy'}
					on:change={() => derivationMode.set('legacy')}
					class="mt-0.5"
				/>
				<div>
					<div class="font-medium">Memory Relay</div>
					<div class="text-sm opacity-70">
						Use derived stores on the main thread. May cause UI lag with large datasets
						but useful for debugging or if Workers aren't supported.
					</div>
				</div>
			</label>
		</div>

		<div class="text-xs opacity-50 mt-2">
			Default: {DEFAULT_DERIVATION_MODE === 'worker' ? 'Web Workers' : 'Memory Relay'}
		</div>
	</section>

	<section class="max-w-xl">
		<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Developer</h2>
		<p class="text-sm opacity-70 mb-4">
			Options for debugging and development.
		</p>

		<label class="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors {$preferences.showDebugButton ? 'border-primary bg-primary/5' : ''}">
			<button
				type="button"
				on:click={() => preferences.setShowDebugButton(!$preferences.showDebugButton)}
				class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors {$preferences.showDebugButton ? 'bg-primary border-primary' : 'border-muted-foreground'}"
			>
				{#if $preferences.showDebugButton}
					<svg class="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</button>
			<div class="flex-1">
				<div class="font-medium">Show debug button</div>
				<div class="text-sm opacity-70">
					Shows a bug icon button to open debug panel. You can also press <kbd class="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Alt+D</kbd> to toggle.
				</div>
			</div>
		</label>
	</section>

	<section class="max-w-xl">
		<h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Clear Data</h2>
		<p class="text-sm opacity-70 mb-4">
			Remove cached data to free up space or resolve issues. The app will reload after clearing.
		</p>

		{#if Nip66Instance !== null}
			<div class="space-y-4">
				<div class="flex items-start justify-between gap-4 p-4 border rounded-md">
					<div class="flex-1">
						<div class="font-medium">Clear SQLite Cache</div>
						<div class="text-sm opacity-70 mt-1">
							Removes cached relay checks, events, and monitor data stored in the browser's SQLite database.
							This data will be re-fetched from the network.
						</div>
					</div>
					<Button
						on:click={handleWipeSqlite}
						variant="outline"
						disabled={wipingSqlite}
						class="shrink-0"
					>
						{wipingSqlite ? 'Clearing...' : 'Clear'}
					</Button>
				</div>

				<div class="flex items-start justify-between gap-4 p-4 border rounded-md">
					<div class="flex-1">
						<div class="font-medium">Reset Local Storage</div>
						<div class="text-sm opacity-70 mt-1">
							Clears preferences, UI state, and dimension caches stored in localStorage.
							Your preferences will be reset to defaults.
						</div>
					</div>
					<Button
						on:click={handleWipeLocalStorage}
						variant="outline"
						disabled={wipingLocalStorage}
						class="shrink-0"
					>
						{wipingLocalStorage ? 'Resetting...' : 'Reset'}
					</Button>
				</div>

				<div class="flex items-start justify-between gap-4 p-4 border border-destructive/50 rounded-md bg-destructive/5">
					<div class="flex-1">
						<div class="font-medium text-destructive">Clear All Data</div>
						<div class="text-sm opacity-70 mt-1">
							Performs a complete reset: clears SQLite cache, localStorage, and all in-memory stores.
							The app will fully reinitialize as if opened for the first time.
						</div>
					</div>
					<Button
						on:click={handleWipeAll}
						variant="destructive"
						disabled={wipingAll}
						class="shrink-0"
					>
						{wipingAll ? 'Clearing...' : 'Clear All'}
					</Button>
				</div>
			</div>
		{/if}
	</section>
</div>

<!-- <Stats /> -->
