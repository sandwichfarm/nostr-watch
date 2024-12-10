<script lang="ts">
    import Nip66Check from "$lib/components/partials/Nip66Check.svelte";
    import ProfileCompact from '../ProfileCompact.svelte';
    import type { Monitor } from "@nostrwatch/nip66/models";
    import { monitors } from '$lib/stores/monitors.js';
    import { PFP } from '$lib/utils/pfp.js';
    
    export let check: any;
    
    $: pubkey = check?.pubkey ?? null;
    $: monitor = pubkey ? $monitors.find((monitor: Monitor) => monitor.pubkey === pubkey) : null;
    $: monitorProfile = monitor ? monitor?.profile : null;
    $: monitorRelays = monitor ? monitor?.relays : null;
    $: monitorName = monitor?.name;
    $: monitorPhoto = monitor?.photo ?? PFP.generate(pubkey);
</script>

<div class="space-y-4">
    <div class="flex items-center space-x-4">
        <img src="{monitorPhoto}" alt="{monitorName}'s profile photo" class="h-12 w-12 rounded-full" />
        <div>
            <h3 class="text-lg font-semibold">{monitorName}</h3>
            <p class="text-sm text-gray-500">{pubkey}</p>
        </div>
    </div>
    <Nip66Check {check} />
</div>

<style>
.space-y-4 > * + * {
    margin-top: 1rem;
}
.flex.items-center {
    display: flex;
    align-items: center;
}
</style>
    