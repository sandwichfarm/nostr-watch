<script lang="ts">
	import { pubkeyProfile$, pubkeyRelays$ } from "$stores/helpers/helpers-pubkey";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import type { PubkeyRelays } from "@nostrwatch/route66/models/PubkeyRelays";
	// import { npubEncode } from "nostr-tools/nip19";
	import { onMount } from "svelte";
	import { derived, type Readable } from "svelte/store";

    export let pubkey;
    export let profile: PubkeyProfile | undefined = undefined;
    export let relays: string[] | undefined = undefined;

    let pubkeyProfile: Readable<PubkeyProfile | undefined>
    let pubkeyRelays: Readable<PubkeyRelays | undefined>

    let initialized = false
    const initializeZapper = () => {
        const el = document?.getElementById(npub)
        window?.nostrZap?.initTarget(el)
        initialized = true
    }

    if(profile){
        initializeZapper()
    }
    else {
        pubkeyProfile = pubkeyProfile$(pubkey);
    }

    if(!relays){
        pubkeyRelays = pubkeyRelays$(pubkey);
    }

    $: zapProfile = $pubkeyProfile || profile
    $: npub = zapProfile? zapProfile.npub: undefined
    $: lud16 = zapProfile?.lud16;
    $: lud06 = zapProfile?.lud06;
    $: relaysArr = relays || $pubkeyRelays?.relays
    $: relaysStr = relaysArr? relaysArr.join(',') : undefined;
    $: zappable = (lud06 || lud16) && relaysStr && npub

    onMount(async () => {
        if(!initialized && $pubkeyProfile){
            initializeZapper()
        }
    })
</script>
{#if zappable }
    <a  
        id={npub}
        href="#"
        data-npub={npub}
        data-relays={relaysStr}
        >
        zap
    </a>
{/if}