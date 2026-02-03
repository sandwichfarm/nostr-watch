<script lang="ts">
    import { browser } from '$app/environment';
    import * as Card from '$lib/components/ui/card';
	import { readable, type Readable } from 'svelte/store';
	import SummarizeRelayChecks from '../SummarizeRelayChecks.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { onMount } from 'svelte';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';

    const relayUrl = generateRelayUrlFromPath() as string;

    let checks: Readable<Nip66CheckEvent[]> = readable([]); 
	let RelayMapComponent: any = null;
	let mapLoading = false;
	let mapError: string | null = null;

	async function loadRelayMap() {
		if (!browser) return;
		if (RelayMapComponent || mapLoading || mapError) return;

		mapLoading = true;
		try {
			const mod = await import('../RelayMap.svelte');
			RelayMapComponent = mod.default;
		} catch (err) {
			mapError = err instanceof Error ? err.message : String(err);
			console.warn('[CardChecks] Failed to load RelayMap:', err);
		} finally {
			mapLoading = false;
		}
	}

    onMount(() => {
        checks = relayLivenessChecks$(relayUrl);

		// Only attempt to load the map once we have actual checks to display.
		const unsubscribe = checks.subscribe((val) => {
			if (val?.length) {
				void loadRelayMap();
				unsubscribe();
			}
		});

		return () => unsubscribe();
    });

</script>

{#if $checks?.length}
    <Card.Root>
        <Card.Header>
            <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                checks
            </Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="flex flex-row">
                <div class="flex-grow">
                    <SummarizeRelayChecks {checks} />
                </div>
				<div class="flex-grow">
					{#if RelayMapComponent}
						<svelte:component this={RelayMapComponent} class="flex-grow" />
					{:else if mapError}
						<div class="rounded border border-white/10 bg-black/30 p-3 text-xs text-white/50">
							Map unavailable: {mapError}
						</div>
					{:else}
						<div class="rounded border border-white/10 bg-black/30 p-3 text-xs text-white/50">
							Loading map…
						</div>
					{/if}
				</div>
            </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}
