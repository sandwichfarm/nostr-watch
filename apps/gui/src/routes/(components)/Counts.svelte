<script lang="ts">
	import { geocodes, relayCheckAggregates } from "$lib/stores";
	import { isps, softwares } from "$lib/stores";
	import { operatorsPubkeysValid } from "$stores/operators";
	import { monitors } from "$stores/monitors";
	import { instance } from "$utils/lifecycle";
	import { onMount, onDestroy } from "svelte";
	import { derived, writable, type Readable, type Writable } from "svelte/store";
	import CountCard from "./CountCard.svelte";

    const activeMonitors: Writable<number | null> = writable(null);
    const enabledMonitors: Writable<number | null> = writable(null);

    let unsubscribeMonitors: (() => void) | null = null;

    const updateMonitorCounts = async () => {
        const $route66 = await instance();
        await $route66.ready();
        const service = $route66?.services?.monitors;
        if (!service) return;

        const active = service.activeMonitors?.length || 0;
        const enabled = service.activeEnabledMonitors?.length || 0;

        // Only update if we have monitors or values changed
        if (active > 0 || enabled > 0) {
            activeMonitors.set(active);
            enabledMonitors.set(enabled);
        }
    };

    onMount(async () => {
        // Initial check
        await updateMonitorCounts();

        // Re-check when monitors store changes (reactive to seed data loading)
        unsubscribeMonitors = monitors.subscribe(() => {
            updateMonitorCounts();
        });
    });

    onDestroy(() => {
        unsubscribeMonitors?.();
    });

    const countRelays = derived(relayCheckAggregates, ($relayCheckAggregates) => {
        if(!$relayCheckAggregates?.length) return null;
        return $relayCheckAggregates.filter((relay: any) => relay?.liveness === 'online').length || null;
    });
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

<div class="grid lg:grid-cols-3 xl:grid-cols-6 mt-9 mx-10">
    {#each values as { topText, bottomText, value, link }, index}
        <CountCard {topText} {value} {bottomText} {link} {index} class="" innerClass={'gradient-purple'} />
    {/each}
</div>
