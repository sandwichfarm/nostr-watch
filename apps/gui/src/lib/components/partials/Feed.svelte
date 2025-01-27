<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get, writable, type Readable, type Writable } from 'svelte/store';

    import Masonry from 'svelte-bricks';
    import type { Filter } from 'nostr-tools';

    import { route66 } from '$lib/stores';
    import { User } from '$lib/models/User.js';
	import type { UserFeed } from '$lib/services/UserService';

	import { FeedService } from '$lib/services/FeedService';
	
	import { deterministicHash } from '@nostrwatch/route66/utils';
	import type { NostrEvent } from '@nostrwatch/route66/models';
	import FeedNote from './FeedNote.svelte';

    import { observeViewport } from '$lib/utils/ux';
    import { pauseLiveSync } from '$lib/utils/lifecycle';

    export let filters: Filter[]; 
    export let infiniteScroll: boolean = true;

    let user: User | undefined;
    let resumer: Function | undefined;

    const feedService: Writable<FeedService | null> = writable(null);
    const feed: Writable<UserFeed> = writable([]);
    const until: Writable<number> = writable();
    const busy: Writable<boolean> = writable(false);
    let items: Readable<NostrEvent[]> | undefined;

    let [minColWidth, maxColWidth, gap] = [400, 600, 21]
    let width:number, height: number
    
    const lastItemId = () => {
        return $items![$feed.length - 1].id;
    }

    const middleItemId = () => {
        return $items![Math.floor($feed.length / 2)].id;
    }

    const lowItemId = (id: string): boolean => {
        return $items!.slice(-4).map( item => item.id).includes(id);
    }

    const mount = async () => {
        resumer = await pauseLiveSync();
        if(!$route66) return console.warn('route66 does not exist.');
        await $route66.ready();
        feedService.set(new FeedService($route66.adapters, filters));
        $feedService!.populate();
        items = $feedService!.memoryRelay.$req(deterministicHash(filters), filters)
    }

    const destroy = () => {
        $feedService!.unsubscribeAll().then( () => {
            $feedService!.destroy();
            feedService.set(null) 
        });
        resumer?.()
    }

    onMount(mount);
    onDestroy(destroy);

    $: count = $feedService? $feedService?.memoryRelay.count([{}]): 0;
</script>

<section id="operator-feed" class="block relative">
    {#if $items?.length === 0}
        <div class="flex flex-col text-center items-center justify-center h-[600px]">
            <span class="text-2xl text-center">loading</span>
        </div>
    {/if}

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
             
        <FeedNote note={item} memoryRelay={$feedService.memoryRelay} relativesFetcher={$feedService.relativeFetchers.get(item.id)} />
    </Masonry>
    {/if}
    
</section>




