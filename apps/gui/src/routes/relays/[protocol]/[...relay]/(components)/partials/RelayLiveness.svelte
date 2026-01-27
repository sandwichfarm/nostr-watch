<script lang="ts">
	import { relayLastSeen$, relayLivenessChecks$, relayLivenessDetermination$ } from "$stores/helpers/helpers-relay";
	import { RelayLivenessType } from "$stores/relays.js";
	import { timeAgo } from "$utils/time";
	import { writable, type Writable } from "svelte/store";
	import { indexOf } from "lodash";
	import { generateRelayUrlFromPath } from "$utils/routing";

	const relayUrl = generateRelayUrlFromPath();
	const relayLivenessResult = relayLivenessDetermination$(relayUrl);

	const className = $$props.class;

    const lastSeen = relayLastSeen$(relayUrl);

    const lastSeenAgo: Writable<string | undefined> = writable(undefined);

    lastSeen.subscribe( value => {
        if(!value) return;
        const ago = timeAgo(value*1000)
        if(!ago) return;
        lastSeenAgo.set(ago);
    });

	$: liveness = $relayLivenessResult.determination;
	$: indicatorClass = { 
        'w-5 h-5 rounded-full block': true,
		'bg-green-500': liveness === RelayLivenessType.Online,
		'bg-red-500': liveness === RelayLivenessType.Offline,
		'bg-orange-500': liveness === RelayLivenessType.MaybeOffline
	}
	$: valueClass = { 
		'text-green-500': liveness === RelayLivenessType.Online,
		'text-red-500': liveness === RelayLivenessType.Offline,
		'text-orange-500': liveness === RelayLivenessType.MaybeOffline
	}
</script>
<div class="{className}">
    <div class="flex flex-row">
        <div class="flex-shrink">
            <!-- Note the removal of the extra curly braces -->
            <span 
                class:bg-green-500={liveness === RelayLivenessType.Online}
                class:bg-red-500={liveness === RelayLivenessType.Offline}
                class:bg-orange-500={liveness === RelayLivenessType.MaybeOffline}
                class="w-4 h-4 mr-2 mt-1.5 rounded-full block"
                ></span>
        </div>
        <div class="flex-grow">
            <span class={valueClass}>{liveness}</span>
        </div>
    </div>
    {#if $lastSeenAgo}
    <div class="text-xs">
        Last seen {$lastSeenAgo}
    </div>
    {/if}
</div>