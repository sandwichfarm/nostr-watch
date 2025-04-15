<script lang="ts">
	import { page } from "$app/stores";
    import { onMount } from "svelte";
	import type { Readable } from "svelte/store";

	import PageHeader from "$lib/components/layout/PageHeader.svelte";
    import type { User } from "$lib/models/User";
	import { dataRegister } from "$stores/data-register";
	import { pubkeyUserInstance$ } from "$stores/helpers/helpers-pubkey";
	import { truncateWithEllipsis } from "$utils/strings";
	
    import * as Card from '$lib/components/ui/card';
    import Badge from "$ui/badge/badge.svelte";

    import { clickToCopy } from "$lib/utils/ux";

    import OperatorCountries from "./components/OperatorCountries.svelte";
	import OperatorRelays from "./components/OperatorRelays.svelte";
	import OperatorSoftware from "./components/OperatorSoftware.svelte";
	import OperatorIsps from "./components/OperatorIsps.svelte";
	

    let pubkey = $page.params.pubkey;
    
    const user: Readable<User> = pubkeyUserInstance$(pubkey);

    onMount(async ()=>{
        await $dataRegister.require(
            [ 
                'sync:cache',
                'sync:relay:operator' 
            ], 
            {
                'sync:relay:operator': [pubkey]
            }
        )
    })

    $: name = $user?.name || undefined;
    $: npub = $user?.npub || undefined;
    $: about = $user?.about || undefined;
    $: nprofile = $user?.reference || undefined;
    $: photo = $user?.photo || undefined;
    $: banner = $user?.banner || undefined;
    $: lud16 = $user?.lud16 || undefined;
    $: lud06 = $user?.lud06 || undefined;

    $: title = name
        ? name
        : npub
            ? truncateWithEllipsis(npub, 21)
            : truncateWithEllipsis(pubkey, 21)

    $: subtitle = about? truncateWithEllipsis(about, 100): undefined

</script>

<PageHeader 
    {title} 
    subtitle={subtitle} 
    icon={photo}
    {banner}
    bgOpacity={0.5}
    >
        <Badge>
            <span class="cursor-pointer" use:clickToCopy>{npub}</span>
        </Badge>
    </PageHeader>   

    <div class="flex flex-col gap-4 p-4">
        <!-- Basic Info -->
        <div class="card p-4">
            <h2 class="text-xl font-bold mb-2">Operator Info</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#if name}
                    <div>
                        <span class="font-semibold">Name:</span> {name}
                    </div>
                {/if}
                {#if npub}
                    <div>
                        <span class="font-semibold">Npub:</span> {truncateWithEllipsis(npub, 21)}
                    </div>
                {/if}
                {#if nprofile}
                    <div>
                        <span class="font-semibold">Nprofile:</span> {truncateWithEllipsis(nprofile, 21)}
                    </div>
                {/if}
                {#if lud16}
                    <div>
                        <span class="font-semibold">Lightning Address:</span> {lud16}
                    </div>
                {/if}
                {#if lud06}
                    <div>
                        <span class="font-semibold">LNURL:</span> {truncateWithEllipsis(lud06, 21)}
                    </div>
                {/if}
                {#if about}
                    <div class="col-span-2">
                        <span class="font-semibold">About:</span> {about}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Relay Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card.Root>
                <Card.Header>
                    <Card.Title class='[text-shadow:_2px_2px_0_rgb(99_102_241_/_0.2)] font-mono text-white/80 text-shad'>
                        softwares
                    </Card.Title>  
                </Card.Header>  
                <Card.Content>
                    <OperatorSoftware {pubkey} />
                </Card.Content>
                <Card.Footer>
                </Card.Footer>
            </Card.Root>

            <div class="card p-4">
                <h2 class="text-xl font-bold mb-4">Geographic Distribution</h2>
                <OperatorCountries {pubkey} />
            </div>

            <div class="card p-4">
                <h2 class="text-xl font-bold mb-4">ISP Distribution</h2>
                <OperatorIsps {pubkey} />
            </div>

            
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
