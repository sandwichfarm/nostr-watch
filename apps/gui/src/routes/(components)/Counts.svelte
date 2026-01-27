<script lang="ts">
	import { geocodes, relayCheckAggregates } from "$lib/stores";
	import { isps, softwares } from "$lib/stores";
	import { operatorsPubkeysValid } from "$stores/operators";
	import { monitorRows } from "$stores/monitors";
	import { derived, type Readable } from "svelte/store";
	import CountCard from "./CountCard.svelte";

    const countRelays = derived(relayCheckAggregates, ($relayCheckAggregates) => {
        if(!$relayCheckAggregates?.length) return null;
        return $relayCheckAggregates.filter((relay: any) => relay?.liveness === 'online').length || null;
    });
    const countMonitors = derived(monitorRows, ($rows) => {
        if (!$rows?.length) return null;
        const active = $rows.filter((row: any) => row?.active).length;
        const enabledActive = $rows.filter((row: any) => row?.enabled && row?.active).length;
        if (!active || !enabledActive) return null;
        return `${enabledActive}/${active}`;
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

<div class="grid lg:grid-cols-3 xl:grid-cols-6 mt-10">
    {#each values as { topText, bottomText, value, link }, index}
        <CountCard {topText} {value} {bottomText} {link} {index} class="" innerClass={'gradient-purple'} />
    {/each}
</div>
