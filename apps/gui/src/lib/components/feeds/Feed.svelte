<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get, writable, type Readable, type Writable } from 'svelte/store';

    import type { Filter } from 'nostr-tools';

    import { route66 } from '$lib/stores';
	import { FeedService } from '$lib/services/FeedService';
	import { deterministicHash } from '@nostrwatch/route66/utils';
	import type { NostrEvent } from '@nostrwatch/route66/models';
    import { pauseLiveSync } from '$lib/utils/lifecycle';
	import Loading from '../partials/Loading.svelte';
	import FeedMasonry from './FeedMasonry.svelte';
	import FeedGrid from './FeedGrid.svelte';
    import Scroller from '$lib/components/partials/Scroller.svelte';
	import type { ParseConfig } from '$utils/notes';

    type FeedType = 'masonry' | 'list' | 'grid' | 'table' | 'scroller' | 'wiki';

    export let type: FeedType = 'masonry';
    export let filters: Filter[]; 
    export let infiniteScroll: boolean = true;
    export let tabbed: boolean = false;
    export let maxWidth: number | undefined = undefined; 
    export let noteClamp: number | undefined = undefined;  
    export let autoScroll: boolean = false;
    export let parserOptions: ParseConfig = {}; 

    let resumer: Function | undefined;

    const feedService: Writable<FeedService | null> = writable(null);
    let items: Readable<NostrEvent[]> | undefined;

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

</script>

    {#if $items?.length === 0}
       <Loading />
    {/if}

    {#if $feedService && $items?.length}
        {#if type === 'masonry'}
        <section id="operator-feed" class="block relative">
            <FeedMasonry {items} {feedService} {infiniteScroll} />
        </section>
        {/if}

        {#if type === 'grid'}
        <section id="operator-feed" class="block relative">
            <FeedGrid {items} {feedService} {infiniteScroll} {maxWidth} {parserOptions} />
        </section>
        {/if}

        {#if type === 'scroller'}
            <Scroller orientation="horizontal" autoScrollInterval={5000} scrollAmount={200}  {autoScroll}  class="overflow-x-auto overflow-y-hidden">
                <FeedGrid {items} {feedService} {infiniteScroll} {maxWidth} {noteClamp} {parserOptions} />
            </Scroller>
        {/if}

        {#if type === 'list'}

        {/if}

        {#if type === 'table'}

        {/if}

        {#if type === 'wiki'}
        {/if}

        {#if type === 'tabbed'}

        {/if}
    {/if}




