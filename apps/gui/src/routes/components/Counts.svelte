<script lang="ts">
	import { geocodes, relayCheckAggregates } from "$lib/stores";
	import { isps, softwares } from "$lib/stores";
	import { operatorsPubkeys, operatorsPubkeysValid } from "$stores/operators";
	import { instance } from "$utils/lifecycle";
	import { isPubkey } from "$utils/nostr";
	import { onMount } from "svelte";
	import { writable, type Writable } from "svelte/store";

    const activeMonitors: Writable<number | null> = writable(null);
    const enabledMonitors: Writable<number | null> = writable(null);    

    const mount = async () => {
        const $route66 = await instance();
        await $route66.ready()
        activeMonitors.set($route66!.services.monitors!.activeMonitors?.length || 0)
        enabledMonitors.set($route66!.services.monitors!.activeEnabledMonitors?.length)
    }

    onMount(mount)

    $: countRelays = $relayCheckAggregates?.length  || null;
    $: countMonitorsEnabled = $enabledMonitors || null;
    $: countMonitorsActive = $activeMonitors || null;
    $: countSoftwares = $softwares?.length || null;
    $: countIsps = $isps?.length || null;
    $: countOperators = $operatorsPubkeysValid?.length || null;
    $: countCountries = $geocodes?.length || null;
</script>

<div class="flex mt-9 mx-10">
    <!--several blocks on a single row that are equal widths, and for small screen sizes collapse to a single column --> 
    <div class="w-1/6">
        <div class="hp-card">
            <div class="label text-center">there are around</div>
            <div class="value text-7xl font-bold text-center"><a href="/relays">{countRelays}</a></div>
            <div class="label text-center">relays online</div>
        </div>
    </div>
    <div class="w-1/6">
        <div class="hp-card">
            <div class="label text-center">reported by</div>
            <div class="value text-7xl font-bold text-center"><a href="/monitors">{countMonitorsEnabled}/{countMonitorsActive} </a></div>
            <div class="label text-center">active monitors</div>
        </div>
    </div>
    <div class="w-1/6  drop-shadow-[0_35px_35px_rgba(255,255,255,0.15)]">
        <div class="hp-card">
            <div class="label text-center">operated by</div>
            <div class="value text-7xl font-bold text-center"><a href="/operators">{countOperators}</div>
            <div class="label text-center">relay operators</div>
        </div>
    </div>
    <div class="w-1/6 drop-shadow-[0_35px_35px_rgba(255,255,255,0.15)]">
        <div class="hp-card">
            <div class="label text-center">running on</div>
            <div class="value text-7xl font-bold text-center"><a href="/relays/software">{countSoftwares}</a></div>
            <div class="label text-center">software stacks</div>
        </div>
    </div>
    <div class="w-1/6 drop-shadow-[0_35px_35px_rgba(255,255,255,0.15)]">
        <div class="hp-card">
            <div class="label text-center">served by</div>
            <div class="value text-7xl font-bold text-center">
                <a href="/relays/isps">{countIsps}</a>
            </div>
            <div class="label text-center">isps</div>
        </div>
    </div>
    <div class="w-1/6 drop-shadow-[0_35px_35px_rgba(255,255,255,0.15)]  ">
        <div class="hp-card">
            <div class="label text-center">in</div>
            <div class="value text-7xl font-bold text-center"><a href="/relays/geography">{countCountries}</a></div>
            <div class="label text-center">countries</div>
        </div>
    </div>
</div>


<style lang="postcss">
    .hp-card {
        @apply border-white/5 border-[2px] 
                bg-white/10 dark:bg-black/10 hover:bg-white/15 
                py-14 rounded-md m-5 shadow-start hover:shadow-end transition-shadow duration-200 drop-shadow-[0_25px_25px_rgba(255,255,255,0.35)];
    }

    .hp-card:hover {
        @apply bg-white/20 dark:bg-black/15;
    }

    .hp-card .label {
        @apply opacity-50 hover:opacity-60;
    }

    .hp-card:hover .label {
        @apply opacity-60;
    }

    .hp-card:hover .value {
        @apply opacity-100;
    }

    .hp-card .value {
        @apply opacity-70;
    }
</style>