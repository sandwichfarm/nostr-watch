<script lang="ts">
    import { User } from '$lib/models/User.js';
	import type { UserFeed } from '$lib/services/UserService';
    import { UserService } from '$lib/services/UserService';
	import { nip66 } from '$lib/stores';
	import { parseNote } from '$lib/utils/notes';
	import { onMount } from 'svelte';
	import { get, writable, type Writable } from 'svelte/store';
    import { userService } from '$lib/stores/user.js';

    import OperatorFeedNote from './OperatorFeedNote.svelte';

    export let pubkey: string; 

    let user: User;

    const feed: Writable<UserFeed> = writable([]);

    onMount( async () => {
        const instance = get(nip66);
        while(!instance || !instance.ready || !pubkey) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        userService.set(new UserService(instance.adapters));
        if(!$userService) return console.warn('user service does not exist.');
        console.log('user pubkey', pubkey)
        user = $userService.userFromPubkey(pubkey);  
        console.log(user)
        await user.ready();
        console.log('user feed: user', user)
        await $userService.feed(user).then( (data: UserFeed) => {
            console.log('user feed: data', data)    
            feed.set(data);
        });
        userService.set($userService);
    });
</script>

<section id="operator-feed" class="block">
wtf <br/>
    <h2>Operator Feed</h2>
    {#if $userService}
    <ul>
        {#each $feed as noteExtended}
            <OperatorFeedNote {noteExtended} />
        {/each}
    </ul>   
    {/if}
</section>

