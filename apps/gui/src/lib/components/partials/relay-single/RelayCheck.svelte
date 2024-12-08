<script lang="ts">
    import { Accordion } from 'radix-svelte';
    import Nip66Check from "$lib/components/partials/Nip66Check.svelte"
    import Badge from '$lib/components/ui/badge/badge.svelte';
    import { monitors } from '$lib/stores/monitors.js';
    import ProfileCompact from '../ProfileCompact.svelte';
    import type { Monitor } from "@nostrwatch/nip66/models"
    import { PFP } from '$lib/utils/pfp.js';
    
    export let check: any;

    $: pubkey = check?.pubkey ?? null
    $: monitor = pubkey? $monitors.find( (monitor: Monitor) => monitor.pubkey === pubkey ): null
    $: monitorProfile = monitor? monitor?.profile: null;
    $: monitorRelays = monitor? monitor?.relays: null;
    $: monitorName = monitor?.name
    $: monitorPhoto = monitor?.photo ?? PFP.generate(pubkey)
</script>

{console.log('the monitor', monitor)}
<Accordion.Item class="accordion-item max-h-none overflow-x-auto" value={check.pubkey}>
    <Accordion.Header class="py-2 px-2 border-b-2">
        <Accordion.Trigger>
            <img src="{monitorPhoto}" alt="{monitorName}'s profile photo" class="h-6 w-6 overflow-hidden rounded-full inline-block" /> <span class="inline-block">
                {monitorName}
            </span>
        </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content transition={true}>
        <div class="mx-3 my-2 py-2 px-3 bg-white/10 max-w-80">
            <ProfileCompact pubkey={check.pubkey} profile={monitorProfile} />
        </div>
        <Nip66Check {check} />
    </Accordion.Content>
</Accordion.Item>