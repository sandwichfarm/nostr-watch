<script lang="ts">
    import Nip66Check from "$lib/components/partials/Nip66Check.svelte"
    import Badge from '$lib/components/ui/badge/badge.svelte';
    import { monitors } from '$lib/stores/monitors.js';
    import ProfileCompact from '../ProfileCompact.svelte';
    import type { Monitor } from "@nostrwatch/route66/models"
    import { PFP } from '$lib/utils/pfp.js';
	import { timeAgo } from "$lib/utils/time";
    
    export let check: any;

    $: pubkey = check?.pubkey ?? null
    $: monitor = pubkey? $monitors.find( (monitor: Monitor) => monitor.pubkey === pubkey ): null
    $: monitorProfile = monitor? monitor?.profile: null;
    $: monitorRelays = monitor? monitor?.relays: null;
    $: monitorName = monitor?.name
    $: monitorPhoto = monitor?.photo ?? PFP.generate(pubkey)
</script>

<div class="py-2">
<img src="{monitorPhoto}" alt="{monitorName}'s profile photo" class="h-6 w-6 mr-2 overflow-hidden rounded-full inline-block" /> <span class="inline-block">
    {monitorName}
    <span class="text-white/5 dark:text-black/50 text-sm italic">{timeAgo(check.created_at*1000)}</span>
</span> 
</div>