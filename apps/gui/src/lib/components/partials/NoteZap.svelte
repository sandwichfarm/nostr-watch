<script lang="ts">
	import { pubkeyProfile$, pubkeyRelays$ } from "$stores/helpers/helpers-pubkey";
	import type { NostrEvent } from "@nostrwatch/route66/models/Event";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import type { PubkeyRelays } from "@nostrwatch/route66/models/PubkeyRelays";
	// import { npubEncode } from "nostr-tools/nip19";
	import { onMount } from "svelte";
	import { type Readable } from "svelte/store";

    export let note: NostrEvent
    export let profile: PubkeyProfile | undefined = undefined;
    export let relays: string[] | undefined = undefined;

    $: pubkey = note.pubkey

    let pubkeyProfile: Readable<PubkeyProfile | undefined>
    let pubkeyRelays: Readable<PubkeyRelays | undefined>

    let initialized = false
    const initializeZapper = () => {
        if(!pubkey || !pubkeyRelays || !npub) return
        const el = document?.getElementById(note.id)
        if(!el) return
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
        id={note.id}
        href="#"
        data-npub={npub}
        data-note-id={note.reference}
        data-relays={relaysStr}
        class="ml-5 color-yellow-500 hover:color-yellow-400 bg-black/90 dark:bg-white/10 hover:bg-white/30 rounded-full h-6 w-6 text-center inline-block items-center justify-center"
        >
        ⚡
    </a>
{/if}