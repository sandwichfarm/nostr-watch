<script lang="ts">
    import { readable, type Readable } from 'svelte/store';
    import { noteCommentsCount$ } from '$stores/helpers/helpers-notes';
    import type { NostrEvent } from '@nostrwatch/route66/models';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';
	import { onDestroy, onMount } from 'svelte';

    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<NostrEvent, NostrEvent>;
    export let commentsCountCache: number; 
    let comments: Readable<number> = noteCommentsCount$<NostrEvent>(note.id, memoryRelay); 

    onMount( () => {
        comments = noteCommentsCount$<NostrEvent>(note.id, memoryRelay);
        const unsub = comments.subscribe( count => {
            commentsCountCache = count 
        })
        return () => {
            unsub()
            comments = readable(0);
            
        }
    })
</script>

{commentsCountCache? commentsCountCache : ''}