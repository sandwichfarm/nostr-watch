<script lang="ts">
	import { relayCheckAggregates } from "$lib/stores";
	import { route66 } from "$lib/stores";
	import { isps, softwares } from "$lib/stores";
	import { onMount } from "svelte";
	import { writable, type Writable } from "svelte/store";

    const activeMonitors: Writable<number | null> = writable(null);
    const enabledMonitors: Writable<number | null> = writable(null);    

    const mount = async () => {
        await $route66.ready();
        activeMonitors.set($route66.services.monitors.activeMonitors?.length)
        enabledMonitors.set($route66.services.monitors.enabledMonitors?.length)
    }

    onMount(mount)

    $: countRelays = $relayCheckAggregates?.length  || null;
    $: countMonitorsEnabled = $enabledMonitors || null;
    $: countMonitorsActive = $activeMonitors || null;
    $: countSoftwares = $softwares?.length || null;
    $: countIsps = $isps?.length || null;
</script>

<div class="flex mt-9">
    <!--several blocks on a single row that are equal widths, and for small screen sizes collapse to a single column --> 
    <div class="w-1/5">
        <div class="hp-card">
            <div class="text-center">there are around</div>
            <div class="text-9xl font-bold text-center">{countRelays}</div>
            <div class="text-center">relays online</div>
        </div>
    </div>
    <div class="w-1/5">
        <div class="hp-card">
            <div class="text-center">reported by</div>
            <div class="text-9xl font-bold text-center">{countMonitorsEnabled}</div>
            <div class="text-center">enabled monitors</div>
        </div>
    </div>
    <div class="w-1/5">
        <div class="hp-card">
            <div class="text-center">out of</div>
            <div class="text-9xl font-bold text-center">{countMonitorsActive}</div>
            <div class="text-center">monitors presently active</div>
        </div>
    </div>
    <div class="w-1/5">
        <div class="hp-card">
            <div class="text-center">running on</div>
            <div class="text-9xl font-bold text-center">{countSoftwares}</div>
            <div class="text-center">software stacks</div>
        </div>
    </div>
    <div class="w-1/5">
        <div class="hp-card">
            <div class="text-center">served by</div>
            <div class="text-9xl font-bold text-center">{countIsps}</div>
            <div class="text-center">isps</div>
        </div>
    </div>
</div>


<style lang="postcss">
    .hp-card {
        @apply bg-white/10 dark:bg-black/10 py-20 rounded-lg shadow-md m-5;
    }
</style>