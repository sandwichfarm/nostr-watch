<script lang="ts">
    import { readable, type Readable } from 'svelte/store';
    import { noteReactionsCount$ } from '$stores/helpers/helpers-notes';
    import type { NostrEvent } from '@nostrwatch/route66/models';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';
	import { onDestroy, onMount } from 'svelte';

    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<NostrEvent, NostrEvent>;
    export let reactionsCountCache: number; 
    let reactions: Readable<number>;

    onMount( () => {
        reactions = noteReactionsCount$<NostrEvent>(note.id, memoryRelay);
        const unsub = reactions.subscribe( count => {
            if(count === 0) return;
            reactionsCountCache = count 
        })
        return () => {
            unsub()
            reactions = readable(reactionsCountCache);
        }
    })
</script>

{$reactions? $reactions : ''}