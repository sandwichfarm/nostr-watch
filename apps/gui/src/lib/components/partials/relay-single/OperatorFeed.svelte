<script lang="ts">
    import Masonry from 'svelte-bricks'
    import { onMount } from 'svelte';
    import { User } from '$lib/models/User.js';
	import type { UserFeed } from '$lib/services/UserService';
    import { UserService } from '$lib/services/UserService';
	import { nip66 } from '$lib/stores';
	import { get, writable, type Writable } from 'svelte/store';
    import { userService } from '$lib/stores/user.js';

    import OperatorFeedNote from './OperatorFeedNote.svelte';

    export let pubkey: string; 

    let user: User;

    const feed: Writable<UserFeed> = writable([]);

    let [minColWidth, maxColWidth, gap] = [300, 500, 21]
    let width:number, height: number

    $: items = $feed.map( item => {
        item.id = item.note.id 
        return item;
    });

    onMount( async () => {
        const instance = get(nip66);
        while(!instance || !instance.ready || !pubkey) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        userService.set(new UserService(instance.adapters));
        if(!$userService) return console.warn('user service does not exist.');
        user = $userService.userFromPubkey(pubkey);  
        await user.ready();
        await $userService.feed(user, 100).then( (data: UserFeed) => {  
            feed.set(data);
        });
        userService.set($userService);
    });
</script>

<section id="operator-feed" class="block">
    {#if $userService}
    <Masonry
                    {items}
                    {minColWidth}
                    {maxColWidth}
                    {gap}
                    let:item
                    bind:width
                    bind:height
                >

        <OperatorFeedNote noteExtended={item} />

    </Masonry>
    {/if}
</section>

