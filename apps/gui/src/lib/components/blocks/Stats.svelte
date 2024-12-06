<script lang="ts">
    import {
        nip11s,
        geocodes,
        eventsArray,
        relays,
        softwares,
        versions,
        isps,
        monitors
    } from '$lib/stores/index.js';

    // Reactive variables for determining fade-in state
    $: monitorsClass = $monitors.length > 0 ? 'faded' : '';
    $: relaysClass = Array.from($relays.values()).length > 0 ? 'faded' : '';
    $: eventsClass = $eventsArray.length > 0 ? 'faded' : '';
    $: nip11sClass = Array.from($nip11s).length > 0 ? 'faded' : '';
    $: geocodesClass = $geocodes.length > 0 ? 'faded' : '';
    $: softwaresClass = $softwares.length > 0 ? 'faded' : '';
    $: versionsClass = $versions.length > 0 ? 'faded' : '';
    $: ispsClass = $isps.length > 0 ? 'faded' : '';
</script>

<div id="stats-bar">
    <span class={monitorsClass}>
        <span>Monitors</span>
        <span>{$monitors.length}</span>
    </span>
    <span class={relaysClass}>
        <span>Relays</span>
        <span>{Array.from($relays.values()).length}</span>
    </span>
    <span class={eventsClass}>
        <span>Checks</span>
        <span>{$eventsArray.length}</span>
    </span>
    <span class={nip11sClass}>
        <span>NIP11s</span>
        <span>{Array.from($nip11s, ([name, value]) => ({ name, value })).length}</span>
    </span>
    <span class={geocodesClass}>
        <span>Countries</span>
        <span>{$geocodes.length}</span>
    </span>
    <span class={softwaresClass}>
        <span>Softwares</span>
        <span>{$softwares.length}</span>
    </span>
    <span class={versionsClass}>
        <span>Versions</span>
        <span>{$versions.length}</span>
    </span>
    <span class={ispsClass}>
        <span>ISPs</span>
        <span>{$isps.length}</span>
    </span>
</div>

<style>
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    #stats-bar {
        @apply p-2 flex uppercase text-sm fixed bottom-0 right-0 left-0 bg-black/25 backdrop-blur-lg z-[9999];
    }

    #stats-bar > span {
        @apply mr-3 text-gray-600 inline-block;
        opacity: 0;
        animation: none;
    }

    #stats-bar > span span:first-child {
        @apply font-semibold;
    }

    #stats-bar > span span:nth-child(2) {
        @apply text-green-500 font-bold text-lg;
    }

    #stats-bar > span.faded {
        animation: fadeIn 0.5s ease forwards;
    }
</style>



