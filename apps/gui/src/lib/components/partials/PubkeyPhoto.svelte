<script lang="ts">
	import { pubkeyProfile, pubkeyProfile$ } from "$stores/helpers/helpers-pubkey";
	import { PFP } from "$utils/pfp";
	import type { PubkeyProfile } from "@nostrwatch/route66/models/PubkeyProfile";
	import type { Readable } from "svelte/store";

    export let pubkey: string;
    export let size: number = 10;

    let profile: Readable<PubkeyProfile | undefined> = pubkeyProfile$(pubkey)

    $: photo = $profile?.photo
</script>

{#if photo}
    <span class="overflow-hidden inline-block">
        <img src={photo} alt={photo} class="w-{size} h-{size} block rounded-full" />
    </span>
{:else}
    <span class="rounded-full overflow-hidden inline-block">
        <img src={PFP.generate(pubkey)} alt="${pubkey} photo" class="w-{size} h-{size}" />
    </span>
{/if}