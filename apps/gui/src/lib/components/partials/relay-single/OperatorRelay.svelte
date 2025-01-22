<script lang="ts">
	import type { Nip66CheckEvent } from "@nostrwatch/route66/models";
	import { formatRelayUrl } from "$lib/utils/routing.js";
	import type { Writable } from "svelte/store";
    import type Route66 from "@nostrwatch/route66";

    export let event: Nip66CheckEvent;
    export let route66: Writable<Route66>;

    $: status =
        $route66?.services?.monitors?.manager?.isRelayOnline(event)
            ? 'online'
            : $route66?.services?.monitors?.manager?.isRelayDead(event)
                ? 'dead'
                : 'offline'
    
    $: statusClass = status === 'online'
        ? 'bg-green-500'
        : status === 'offline'
            ? 'bg-red-500'
            : null
        
</script>
{#if event?.relay}
<div>
    {#if status === 'dead'}
    <span class="inline-block text-xs">☠️</span>
    {:else}
    <span class="inline-block mr-1 w-3 h-3 {statusClass} rounded-full"></span>
    {/if}
    <a href="/reload/relays/{formatRelayUrl(event.relay)}">
    {event?.relay}
</div>
{/if}