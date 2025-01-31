<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { type Readable, type Writable } from 'svelte/store';

    import Masonry from 'svelte-bricks';

    import type { NostrEvent } from '@nostrwatch/route66/models';
	import { FeedService } from '$lib/services/FeedService';
    import FeedMasonryNote from './FeedMasonryNote.svelte';
	import { observeViewport } from '$lib/utils/ux';

    export let items: Readable<NostrEvent[]> | undefined;
    export let feedService: Writable<FeedService | null>;
    export let infiniteScroll: boolean = true;

    let [minColWidth, maxColWidth, gap] = [400, 600, 21]
    let width:number, height: number
    
    // const lastItemId = () => {
    //     return $items![$items!.length - 1].id;
    // }

    const middleItemId = () => {
        return $items![Math.floor($items!.length / 2)].id;
    }

    const lowItemId = (id: string): boolean => {
        return $items!.slice(-9).map( item => item.id).includes(id);
    }

    const mount = async () => {}

    const destroy = () => {}

    onMount(mount);
    onDestroy(destroy);
</script>

{#if $feedService && $items?.length}
<Masonry
    items={$items as NostrEvent[]}
    {minColWidth}
    {maxColWidth}
    {gap}
    let:item
    bind:width
    bind:height >

    {#if lowItemId(item.id)}
        <div 
        use:observeViewport={ {infiniteScroll} }
        on:viewportchange={(event: any) => {
            if(!infiniteScroll) return;
            if(event.detail.isIntersecting) $feedService!.populate();
        }}></div>
    {/if}
            
    <FeedMasonryNote note={item} memoryRelay={$feedService.memoryRelay} relativesFetcher={$feedService.relativeFetchers.get(item.id)} />
</Masonry>
{/if}