<script lang="ts">
	import { geocodes, relayCheckAggregates } from "$lib/stores";
	import { isps, softwares } from "$lib/stores";
	import { operatorsPubkeysValid } from "$stores/operators";
	import { instance } from "$utils/lifecycle";
	import { onMount } from "svelte";
	import { derived, writable, type Readable, type Writable } from "svelte/store";
	import CountCard from "./CountCard.svelte";

    const activeMonitors: Writable<number | null> = writable(null);
    const enabledMonitors: Writable<number | null> = writable(null);    

    const mount = async () => {
        const $route66 = await instance();
        await $route66.ready()
        activeMonitors.set($route66!.services.monitors!.activeMonitors?.length || 0)
        enabledMonitors.set($route66!.services.monitors!.activeEnabledMonitors?.length)
    }

    onMount(mount)

    const countRelays = derived(relayCheckAggregates, $relayCheckAggregates => $relayCheckAggregates?.length  || null);
    const countMonitorsEnabled = derived(enabledMonitors, $enabledMonitors => $enabledMonitors || null);
    const countMonitorsActive = derived(activeMonitors, $activeMonitors => $activeMonitors || null);
    const countMonitors = derived([countMonitorsEnabled, countMonitorsActive], ([$countMonitorsEnabled, $countMonitorsActive]) => {
        if(!$countMonitorsEnabled || !$countMonitorsActive) return null;
        return `${$countMonitorsEnabled}/${$countMonitorsActive}`
    });
    const countSoftwares = derived(softwares, $softwares => $softwares?.length || null);
    const countIsps = derived(isps, $isps => $isps?.length || null);
    const countOperators = derived(operatorsPubkeysValid, $operatorsPubkeysValid => $operatorsPubkeysValid?.length || null);
    const countCountries = derived(geocodes, $geocodes => $geocodes?.length || null);

    type CountCardValues = {
        topText: string;
        bottomText: string;
        value: Readable<string | number | null>;
        link: string;
    }

    const values: CountCardValues[] = [
        {
            topText: 'there are around',
            bottomText: 'relays online',
            value: countRelays,
            link: '/relays',
        },
        {
            topText: 'reported by',
            bottomText: 'active monitors',
            value: countMonitors,
            link: '/monitors',
        },
        {
            topText: 'operated by',
            bottomText: 'relay operators',
            value: countOperators,
            link: '/operators',
        },
        {
            topText: 'running on',
            bottomText: 'software stacks',
            value: countSoftwares,
            link: '/relays/software',
        },
        {
            topText: 'served by',
            bottomText: 'isps',
            value: countIsps,
            link: '/relays/isps',
        },
        {
            topText: 'in',
            bottomText: 'countries',
            value: countCountries,
            link: '/relays/geography',
        }
    ]
</script>

<div class="flex mt-9 mx-10">
    <!--several blocks on a single row that are equal widths, and for small screen sizes collapse to a single column --> 
    {#each values as { topText, bottomText, value, link }, index}
        <CountCard {topText} {value} {bottomText} {link} {index} class="w-full md:w-1/3 lg:w-1/6" innerClass={'gradient-purple'} />
    {/each}
</div>