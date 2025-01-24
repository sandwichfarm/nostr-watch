<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import { formatNip } from '$lib/utils/nostr';	
	import { NIP_NAMES } from '$lib/stores/nips';
	import { nipLeadingZero } from '$lib/utils/nostr';

    export let supportedNips: number[];
</script>
{#if supportedNips.length}
    <Card.Root class="relay-card">
        <Card.Header>
            <Card.Title>Supported Nips</Card.Title>  
        </Card.Header>  
        <Card.Content>
           {#each supportedNips as nip}
            <span class="block mb-2">
                <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/{nipLeadingZero(nip)}.md" class="font-bold text-white/80 hover:text-white/90 py-1 px-2 bg-white/5 dark:bg-black/5 rounded-sm hover:text-white/10 dark:text-black/10">
                    {formatNip(nip)}
                </a>
                <span class="text-white/5 dark:text-black/50">{ $NIP_NAMES[ nipLeadingZero(nip).toString() ] }</span>
            </span>
           {/each}
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}