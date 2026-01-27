<script lang="ts">
    import Button from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card';
	import { readable, type Readable, type Writable } from 'svelte/store';
	import SummarizeRelayChecks from '../SummarizeRelayChecks.svelte';
	import RelayMap from '../RelayMap.svelte';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { relayLivenessChecks, relayLivenessChecks$ } from '$stores/helpers/helpers-relay';
	import { onMount } from 'svelte';
	import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';

    const relayUrl = generateRelayUrlFromPath() as string;

    let checks: Readable<Nip66CheckEvent[]> = readable([]); 

    onMount( () => {
        checks = relayLivenessChecks$(relayUrl);
    })

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
                <RelayMap class="flex-grow" />
            </div>
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}