<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { type Readable, type Writable } from 'svelte/store';

    import type { NostrEvent } from '@nostrwatch/route66/models';
	import { FeedService } from '$lib/services/FeedService';
    import FeedNote from './FeedNote.svelte';
	import { observeViewport } from '$lib/utils/ux';

    export let items: Readable<NostrEvent[]> | undefined;
    export let feedService: Writable<FeedService | null>;
    export let infiniteScroll: boolean = true;
    export let maxWidth: number | undefined = undefined;
    
    // const lastItemId = () => {
    //     return $items![$items!.length - 1].id;
    // }

    const middleItemId = () => {
        return $items![Math.floor($items!.length / 2)].id;
    }

    const lowItemId = (id: string): boolean => {
        return $items!.slice(Math.ceil($items.length/3*2)).map( item => item.id).includes(id);
    }

    const mount = async () => {}

    const destroy = () => {}

    onMount(mount);
    onDestroy(destroy);
</script>

{#if $feedService && $items?.length}
<div class="columns-2 space-x-4 px-20">

    {#each $items as item (item.id)}

        <FeedNote 
            note={item} 
            memoryRelay={$feedService.memoryRelay} 
            relativesFetcher={$feedService.relativeFetchers.get(item.id)} 
            />

        {#if infiniteScroll && lowItemId(item.id)}
            <div 
            use:observeViewport={ {infiniteScroll} }
            on:viewportchange={(event: any) => {
                if(!infiniteScroll) return;
                if(event.detail.isIntersecting) $feedService!.populate();
            }}></div>
        {/if}

    {/each}
    
</div>
{/if}