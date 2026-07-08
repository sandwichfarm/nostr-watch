
<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    
    import * as Card from '$lib/components/ui/card';
	import ProfileCompact from '$lib/components/partials/ProfileCompact.svelte';
    import { darkMode } from '$lib/stores/app';
    import { bannerStyleString } from '$utils/style-helpers';
    import { delay } from "@nostrwatch/utils";
	
	import { route66 } from '$lib/stores';

	import type { PubkeyProfile, PubkeyRelays } from '@nostrwatch/route66/models';
	import { Monitor } from '@nostrwatch/route66/models';
	import { readable, type Readable, type Unsubscriber } from 'svelte/store';
	import { pubkeyProfile$, pubkeyRelays$ } from '$stores/helpers/helpers-pubkey';
    import { relayOperatorPubkey$ } from '$stores/helpers/helpers-relay';
	import RelayOperatorMiniFeed from '../RelayOperatorMiniFeed.svelte';
	import { operatorRelays$, operatorRelaysOperated$ } from '$stores/helpers/helpers-operator';
	import Badge from '$lib/components/ui/badge/badge.svelte';
    import Button from '$lib/components/ui/button/button.svelte';
	import { truncateWithEllipsis } from '$utils/strings';

    import { generateRelayUrlFromPath } from '$utils/routing';

    const relayUrl = generateRelayUrlFromPath() as string;

    let pubkey: Readable<string | undefined> = readable(undefined);

    let profile: Readable<PubkeyProfile | undefined> = readable(undefined, () => {});
    let relayListNote: Readable<PubkeyRelays | undefined> = readable(undefined, () => {});
    let operatorRelaysOperated: Readable<string[]> = readable([]);

    let pubkeyUnsub: Unsubscriber = () => {};

    const mount = async () => {
        if(!$route66) return;
        await $route66.ready();
        pubkey = relayOperatorPubkey$(relayUrl);
        pubkeyUnsub = pubkey.subscribe(async (value) => {
            if(value){
                profile = pubkeyProfile$(value);
                relayListNote = pubkeyRelays$(value);
                operatorRelaysOperated = operatorRelaysOperated$(value);
            }
        })
    }

    const destroy = () => {
        pubkeyUnsub();
        // profile = readable(undefined, () => {});
        // relayListNote = readable(undefined, () => {});
    }

    

    onMount(mount)
    onDestroy(destroy)

    $: name = $profile?.name ?? undefined
    $: relays = $relayListNote?.tags
        .filter(tag => tag[0] === 'r')
        .map(tag => tag[1])
        .flat()
    
</script>


{#if $pubkey}
<Card.Root class="w-full bg-black border-white/10 rounded-[3px]">
    <Card.Header>
        <Card.Title class='font-mono text-white/80'>operator</Card.Title>  
    </Card.Header>  
    <Card.Content class="flex flex-col xl:flex-row pt-10">
        <div class="flex-row xl:flex-none w-full xl:w-1/4">
            <div
                class="p-3 pr-10 -mr-5 rounded-md relative"
                style={
                    $profile?.banner
                        ? bannerStyleString($profile.banner, { darkMode: $darkMode, opacity: 0.8 })
                        : ''
                }
                >
                <div class="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none z-10"></div>

                {#if $profile && $pubkey}
                <ProfileCompact pubkey={$pubkey} {profile}  />
                    {#if $profile?.about}
                    <p class="mt-2 p-4 bg-black/10 dark:bg-white/10 line-clamp-6">{truncateWithEllipsis($profile?.about, 170)}</p>
                    {/if}
                {/if}
                {#if $operatorRelaysOperated && $operatorRelaysOperated?.length > 1}
                <div class="text-black/80 dark:text-white/80 my-6 text-xl text-center block">
                    operates 
                    <Badge class="rounded-full inline-block text-xl">
                        {$operatorRelaysOperated.length-1}
                    </Badge> other relays
                </div>
                {/if}
            </div>
        </div>
        <div class="w-full xl:w-3/4 px-10 min-h-[320px]">
            {#if relays && $pubkey}
             <RelayOperatorMiniFeed pubkey={$pubkey} relays={readable(relays)} />
            {:else}
                <span class="font-mono text-lg text-center">Could not locate operator's relay list</span>
            {/if}
        </div>
        
        <!-- {#if otherRelaysCount > 0}
        <div class="text-black/80 dark:text-white/80 my-6">
            <span class="bg-black/5 dark:bg-white/5 py-1 px-2 rounded-sm">{name}</span> operates <Badge class="rounded-full">{otherRelaysCount}</Badge> other relays
        </div>
        {/if} -->
        <!-- <OperatorRelays {pubkey} {relayUrl} {monitors} bind:otherRelaysCount /> -->
    </Card.Content>
    <Card.Footer>
        <Button variant="secondary">
            {name}'s page
        </Button>
    </Card.Footer>
</Card.Root>
{/if}