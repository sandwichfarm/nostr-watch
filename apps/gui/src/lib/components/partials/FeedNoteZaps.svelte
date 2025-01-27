<script lang="ts">
    import Bolt11 from 'light-bolt11-decoder';
    import { readable, type Readable } from 'svelte/store';
    import { noteCommentsCount$, noteZaps$ } from '$stores/helpers/helpers-notes';
    import type { NostrEvent } from '@nostrwatch/route66/models';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';
	import { onDestroy, onMount } from 'svelte';

    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<NostrEvent, NostrEvent>;
    export let zapSumCache: string; 
    let zaps: Readable<NostrEvent[]> = noteZaps$<NostrEvent>(note.id, memoryRelay);

    $: bolt11s = $zaps.map(zap => {
            const b11 = zap.tags.find(tag => tag[0] === 'bolt11')?.[1]
            if(!b11) return null
            return Bolt11.decode(b11)
        }).filter( b11 => b11 !== null )

    $: zapSum = abbrNum(
        Math
            .round(
                bolt11s
                    .reduce((acc, b11) => acc += parseInt(
                        b11.sections.find( 
                            section => section?.name === 'amount')?.value || "0"
                        )
                        , 0)
                /1000
            )
        );


    

    function abbrNum(num: number): string {
        if(num === 0) return '';
        if (num < 1000) return num.toString();
        const units = ["", "K", "M", "B", "T", "P", "E"];
        const magnitude = Math.floor(Math.log10(num) / 3);
        const precision = magnitude - 1; 
        const scaled = num / Math.pow(1000, magnitude); 
        return `${scaled.toFixed(precision + 1)}${units[magnitude]}`;
    }

    onMount( () => {
        const unsub = zaps.subscribe( () => {
            zapSumCache = zapSum
        })
        return () => {
            unsub()
            zaps = readable([]);
        }
    })
    
</script>

{zapSum? zapSum : ''}