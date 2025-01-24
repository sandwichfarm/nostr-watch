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
                <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/{nipLeadingZero(nip)}.md" 
                    class="font-bold text-black/80 hover:text-black/90 py-1 px-2 bg-black/5 dark:bg-white/10 rounded-sm  dark:text-white/70">
                    {formatNip(nip)}
                </a>
                <span class="text-black/70 dark:text-white/70">{ $NIP_NAMES[ nipLeadingZero(nip).toString() ] }</span>
            </span>
           {/each}
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>
{/if}