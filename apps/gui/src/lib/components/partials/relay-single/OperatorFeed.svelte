<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { get, writable, type Writable } from 'svelte/store';

    import Masonry from 'svelte-bricks'
    
    import type Route66 from "@nostrwatch/route66"
    import { route66 } from '$lib/stores';
    import { isLivesyncing } from '$lib/stores/app';

    
    
    import { User } from '$lib/models/User.js';
	import type { UserFeed } from '$lib/services/UserService';
    import { UserService } from '$lib/services/UserService';
    import { userService } from '$lib/stores/user.js';
    import OperatorFeedNote from './OperatorFeedNote.svelte';

    import { observeViewport } from '$lib/utils/ux';
	import { beginLiveSync, stopLiveSync } from '$lib/utils/lifecycle';

    export let pubkey: string; 

    let user: User;

    const feed: Writable<UserFeed> = writable([]);
    const until: Writable<number> = writable();
    const busy: Writable<boolean> = writable(false);

    let [minColWidth, maxColWidth, gap] = [300, 500, 21]
    let width:number, height: number

    const lastItemId = () => {
        return $feed[$feed.length - 1].id;
    }

    const middleItemId = () => {
        return $feed[Math.floor($feed.length / 2)].id;
    }

    const lowItemId = (id: string): boolean => {
        return $feed.slice(-4).map( item => item.id).includes(id);
    }

    $: items = $feed.map( item => {
        item.id = item.note.id 
        if(!$until) {
            until.set(item.note.created_at-1);
        }
        else if(item.note.created_at < $until) {
            until.set(item.note.created_at-1);
        }
        return item;
    });

    let wasLivesyncing = false;

    const mount = async () => {
        if($isLivesyncing) {
            wasLivesyncing = true;
            stopLiveSync()
        }
        const instance: Route66 = get(route66);
        while(!instance || !instance.ready) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if(!pubkey) return console.warn('relay operator pubkey not discovered');
        userService.set(new UserService(instance.adapters));
        if(!$userService) return console.warn('user service does not exist.');
        user = $userService.userFromPubkey(pubkey);  
        await user.ready();
        await $userService.feed(user, 20).then( (data: UserFeed) => {  
            feed.set(data);
        });
        userService.set($userService);
    }

    const destroy = async () => {
        $userService.unsubscribeAll();
        feed.set([]);
        if(wasLivesyncing) {
            beginLiveSync();
        }
    }
    
    const fetchMoreEvents = async () => {
        if($busy) return;
        busy.set(true);
        if(!$until) return;
        await $userService.feed(user, 20, $until).then( (data: UserFeed) => {
            feed.update( (old: UserFeed) => {
                return [...old, ...data]
            });
            busy.set(false);
        });
    }

    onMount(mount);

    onDestroy(destroy);
</script>

<section id="operator-feed" class="block relative">
    {#if $feed.length === 0}
    loading
    {/if}
    {#if $userService}
    <Masonry
        {items}
        {minColWidth}
        {maxColWidth}
        {gap}
        let:item
        bind:width
        bind:height >

        {#if lowItemId(item.id)}
            <div 
            use:observeViewport
            on:viewportchange={(event: any) => {
                if(event.detail.isIntersecting && $until) fetchMoreEvents();
            }}></div>
        {/if}
             
        <OperatorFeedNote noteExtended={item} />
    </Masonry>
    {/if}
    
    {#if $busy}
        <div class="mt-10 py-6 text-center text-xl bg-white/5 text-white/50 italic">
            Spamming {user?.name? user?.name: 'the operator'}'s relays for more notes... 
        </div>
    {/if}
    
</section>




