<script lang="ts">
	import { page } from "$app/stores";
	import PageHeader from "$lib/components/layout/PageHeader.svelte";
	import type { User } from "$lib/models/User";
	import { dataRegister } from "$stores/data-register";
	import { pubkeyUserInstance$ } from "$stores/helpers/helpers-pubkey";
	import { truncateWithEllipsis } from "$utils/strings";
	import { onMount } from "svelte";
	import type { Readable } from "svelte/store";

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
</script>

<PageHeader 
    {title} 
    subtitle={about? truncateWithEllipsis(about, 100): undefined} 
    icon={photo}
    {banner}
    bgOpacity={0.5}
    />
