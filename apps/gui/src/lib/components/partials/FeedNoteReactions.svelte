<script lang="ts">
    import { type Readable } from 'svelte/store';
    import { noteReactionsCount$ } from '$stores/helpers/helpers-notes';
    import type { NostrEvent } from '@nostrwatch/route66/models';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';

    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<NostrEvent, NostrEvent>;
    export let reactionsCountCache: number; 
    const reactions: Readable<number> = noteReactionsCount$<NostrEvent>(note.id, memoryRelay);
    reactions.subscribe( count => reactionsCountCache = count )
</script>

{$reactions? $reactions : ''}