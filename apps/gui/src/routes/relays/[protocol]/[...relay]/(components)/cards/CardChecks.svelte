<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
	import type { Writable } from 'svelte/store';
	import SummarizeRelayChecks from '../SummarizeRelayChecks.svelte';
	import RelayMap from '../RelayMap.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayLivenessChecks$ } from '$stores/helpers/helpers-relay';

    const relayUrl = generateRelayUrlFromPath();
    export const prerender = true;

    const checks = relayLivenessChecks$(relayUrl);

</script>

{#if $checks?.length}
    <Card.Root>
        <Card.Header>
            <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>general</Card.Title>  
        </Card.Header>  
        <Card.Content>
            <div class="flex flex-row">
                <div class="flex-grow">
                    <SummarizeRelayChecks {checks} />
                </div>
                <RelayMap class="flex-grow" />
            </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}