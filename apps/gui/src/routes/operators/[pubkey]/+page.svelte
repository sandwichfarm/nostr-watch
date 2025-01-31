<script lang="ts">
	import { page } from "$app/stores";
	import PageHeader from "$lib/components/layout/PageHeader.svelte";
	import type { User } from "$lib/models/User";
	import { pubkeyUserInstance$ } from "$stores/helpers/helpers-pubkey";
	import { truncateWithEllipsis } from "$utils/strings";
	import type { Readable } from "svelte/store";

    let pubkey = $page.params.pubkey;
    
    const user: Readable<User> = pubkeyUserInstance$(pubkey);

    $: name = $user?.name || undefined;
    $: npub = $user?.npub || undefined;
    $: about = $user?.about || undefined;
    $: nprofile = $user?.reference || undefined;
    $: photo = $user?.photo || undefined;
    $: banner = $user?.banner || undefined;
    $: lud16 = $user?.lud16 || undefined;
    $: lud06 = $user?.lud06 || undefined;
</script>

<PageHeader 
    title={name ?? truncateWithEllipsis(npub, 21) ?? truncateWithEllipsis(pubkey, 21)} 
    subtitle={about? truncateWithEllipsis(about, 100): undefined} 
    icon={photo}
    {banner}
    bgOpacity={0.5}
    />
