<script lang="ts">
    import * as Card from '$lib/components/ui/card';
	import { relayHostnameSiblings$ } from '$stores/helpers/helpers-hostnames';
	import { relayIpSiblings$ } from '$stores/helpers/helpers-ips';
	import { generateRelayUrlFromPath } from '$utils/routing';
	import { onMount } from 'svelte';
	import { readable, type Readable } from 'svelte/store';

    const relayUrl: string | undefined = generateRelayUrlFromPath();

    let relayHostnameSiblings: Readable<string[]> = readable([]);
    let relayIpSiblings: Readable<Map<string, string[]>> = readable(new Map());

    onMount( () => {
        if(!relayUrl) return;
        relayHostnameSiblings = relayHostnameSiblings$(relayUrl)
        relayIpSiblings = relayIpSiblings$(relayUrl)
    })

    $: {
        console.log("relayHostnameSiblings", $relayHostnameSiblings)
    }

</script>

<Card.Root class="w-full bg-black border-white/10 rounded-[3px]">
    <Card.Header>
        <Card.Title class='font-mono text-white/80'>similar relays</Card.Title>  
    </Card.Header>  
    <Card.Content>
        <div class="">

            {#if $relayHostnameSiblings.length}
            <div class="">
                {#each $relayHostnameSiblings as sibling}
                {(console.log('root domain siblings', relayUrl, sibling))}
                    <div class="w-full">{sibling}</div> <br />
                {/each}
            </div>
            {/if}

            {#if $relayIpSiblings.size}
            <div class="flex flex-col">
                {#each $relayIpSiblings.entries() as [ip, sibling]}
                {(console.log('ip siblings', relayUrl, sibling))}
                    <!-- <div class="block">{ip} {sibling.type} {sibling.relay}</div> -->
                {/each}
            </div>
            {/if}

        </div>
    </Card.Content>
    <Card.Footer>
        
    </Card.Footer>
</Card.Root>
