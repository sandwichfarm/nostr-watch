<script lang="ts">
	import { page } from "$app/stores";
    import { onMount } from "svelte";
	import type { Readable } from "svelte/store";

	import PageHeader from "$lib/components/layout/PageHeader.svelte";
    import type { User } from "$lib/models/User";
	import { dataRegister } from "$stores/data-register";
	import { pubkeyProfile$, pubkeyUserInstance$, type StorePubkeyProfile, type StoreUser } from "$stores/helpers/helpers-pubkey";
	import { truncateWithEllipsis } from "$utils/strings";
	import { StateManager } from "@nostrwatch/route66";
	import { nip19 } from "nostr-tools";
	
    import * as Card from '$lib/components/ui/card';
    import Badge from "$ui/badge/badge.svelte";

    import { clickToCopy } from "$lib/utils/ux";

    import OperatorCountries from "./components/OperatorCountries.svelte";
	import OperatorRelays from "./components/OperatorRelays.svelte";
	import OperatorSoftware from "./components/OperatorSoftware.svelte";
	import OperatorIsps from "./components/OperatorIsps.svelte";
	import PubkeyZap from "$lib/components/partials/PubkeyZap.svelte";
	import PubkeyNip05 from "$lib/components/partials/PubkeyNip05.svelte";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import { decode } from "html-entities";
    let pubkey = $page.params.pubkey;
    
    const user: Readable<StoreUser> = pubkeyUserInstance$(pubkey);
    const profile: Readable<StorePubkeyProfile> = pubkeyProfile$(pubkey);

	$: cachedOperator = (() => {
		const rows = StateManager.get('aggregate:operators') as any[] | undefined;
		if (!Array.isArray(rows)) return undefined;
		return rows.find((row) => row?.pubkey === pubkey);
	})();

    onMount(async ()=>{
        void $dataRegister
            .require(
                [ 
                    'sync:cache',
                    'sync:operator:meta' 
                ], 
                {
                    'sync:operator:meta': [pubkey]
                }
            )
            .catch((err) => console.error('[DataRegister] require failed', err));
    })

    $: name = $user?.name ?? cachedOperator?.name ?? undefined;
    $: npub = $user?.npub ?? (pubkey ? nip19.npubEncode(pubkey) : undefined);
    $: about = $user?.about ?? cachedOperator?.about ?? undefined;
    $: nip05 = $user?.profile?.nip05 ?? undefined;
    $: nprofile = $user?.reference ?? cachedOperator?.reference ?? undefined;
    $: photo = $user?.photo ?? cachedOperator?.photo ?? undefined;
    $: banner = $user?.banner ?? cachedOperator?.banner ?? undefined;
    $: lud16 = $user?.lud16 ?? cachedOperator?.lud16 ?? undefined;
    $: lud06 = $user?.lud06 ?? cachedOperator?.lud06 ?? undefined;

    $: title = name
        ? name
        : npub
            ? truncateWithEllipsis(npub, 21)
            : truncateWithEllipsis(pubkey, 21)

    // $: subtitle = about? truncateWithEllipsis(about, 100): undefined

</script>

<PageHeader 
    {title} 
    icon={photo}
    {banner}
    bgOpacity={0.5}
    />

<div class="flex flex-col gap-4 p-4 overflow-y-auto">

    <Card.Root class="bg-gray-800/50">
        <Card.Header>
            <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                about
            </Card.Title>  
        </Card.Header>  
        <Card.Content class="text-2xl text-black/80 dark:text-white/80">
            {#if about && typeof about === 'string'}
            <div class="flex flex-row gap-2">
                {decode(about)} 
                </div>
            {/if}
            <div class="mt-4 pt-2 border-t border-white/10">
                <div class="">
                    {#if $user?.lud16}
                        <PubkeyZap 
                            {pubkey} 
                            showLud16={true}
                            />
                    {/if}
                </div>
                <div class="text-sm p-2">
                    {#if nip05}
                        <PubkeyNip05 {pubkey} {profile} showNip05={true}/>
                    {/if}
                </div>
                <div class="">
                    <span class="font-mono uppercase text-xs inline-block w-16">pubkey</span>
                    <Badge class="truncate text-white/50 bg-black/5 hover:bg-black/10      dark:bg-purple-100/5 dark:hover:bg-purple-100/30">
                        <span class="cursor-pointer truncate max-w-[450px]" use:clickToCopy>{pubkey}</span>
                    </Badge>
                </div>
                
                <div class="">
                    <span class="font-mono uppercase text-xs inline-block w-16">npub</span>
                    <Badge class="truncate text-white/50 bg-black/5 hover:bg-black/10      dark:bg-purple-100/5 dark:hover:bg-purple-100/30">
                        
                        <span class="cursor-pointer truncate max-w-[450px]" use:clickToCopy>{npub}</span>
                    </Badge>
                </div>
                <div>
                    <span class="font-mono uppercase text-xs inline-block w-16">nprofile</span>
                    <Badge class="truncate  text-white/50 bg-black/5 hover:bg-black/10 dark:bg-purple-100/5 dark:hover:bg-purple-100/30">
                        <span class="cursor-pointer truncate max-w-[450px]" use:clickToCopy>{nprofile}</span>  
                    </Badge>
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    <!-- Relay Statistics -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card.Root>
            <Card.Header>
                <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                    deployed software
                </Card.Title>  
            </Card.Header>  
            <Card.Content>
                <OperatorSoftware {pubkey} />
            </Card.Content>
            <Card.Footer>
            </Card.Footer>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                    geographic distribution
                </Card.Title>  
            </Card.Header>  
            <Card.Content>
                <OperatorCountries {pubkey} />
            </Card.Content>
            <Card.Footer>
            </Card.Footer>
        </Card.Root>

        <Card.Root>
            <Card.Header>
                <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                    isp distribution
                </Card.Title>  
            </Card.Header>  
            <Card.Content>
                <OperatorIsps {pubkey} />
            </Card.Content>
            <Card.Footer>
            </Card.Footer>
        </Card.Root>
        
    </div>

    <Card.Root>
        <Card.Header>
            <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                operator relays
            </Card.Title>  
        </Card.Header>  
        <Card.Content>
            <OperatorRelays {pubkey} />
        </Card.Content>
        <Card.Footer>
        </Card.Footer>
    </Card.Root>

</div>
