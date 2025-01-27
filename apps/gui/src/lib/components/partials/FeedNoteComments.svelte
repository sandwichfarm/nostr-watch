<script lang="ts">
    import { type Readable } from 'svelte/store';
    import { noteCommentsCount$ } from '$stores/helpers/helpers-notes';
    import type { NostrEvent } from '@nostrwatch/route66/models';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';

    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<NostrEvent, NostrEvent>;
    export let commentsCountCache: number; 
    const comments: Readable<number> = noteCommentsCount$<NostrEvent>(note.id, memoryRelay); 
    comments.subscribe( count => commentsCountCache = count )
</script>

{commentsCountCache? commentsCountCache : ''}