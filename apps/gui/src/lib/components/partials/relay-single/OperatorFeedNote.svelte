<script lang="ts">
	import type { UserFeedItem } from '$lib/services/UserService';
    import { parseNote } from '$lib/utils/notes';
	import { timeAgo } from '$lib/utils/time';
	import type { IEvent } from '@nostrwatch/nip66/models/Event';
	import type { UserFeedItemRelatives } from '$lib/services/UserService';
	import { observeViewport } from '$lib/utils/ux';
	import { onDestroy, onMount } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
  
    export let noteExtended: UserFeedItem;

    const _comments: Writable<IEvent[]> = writable([]);
    const _reactions: Writable<IEvent[]> = writable([]);
    const _zaps: Writable<IEvent[]> = writable([]);
    const subscriptions: Set<string> = new Set();


    const relativesFetched: Writable<boolean> = writable(false);

    // Initialize content as Writable<string>
    let content: Writable<string>;

    const fetchRelatives = async (noteId: string) => {
        if(subscriptions.has(`relatives-${noteId}`)) return;
        subscriptions.add(`relatives-${noteId}`);    
        noteExtended.fetchRelatives().then( ({comments, reactions, zaps}: UserFeedItemRelatives) => {
            _comments.set(comments);
            _reactions.set(reactions);
            _zaps.set(zaps);
            relativesFetched.set(true);
        });
    }
  
    const mount = () => {
        content = parseNote(noteExtended.note.content, {
            removeHashtags: true,
            nip19: true,
            markdown: true,
            images: true,
            videos: true,
            truncate: true,
            truncateLength: 100,
            sanitize: false,
            replaceAmpersand: true,
        });
    }

    const destroy = () => {

    }

    // Assign the store directly upon component initialization
    onMount(mount)
    onDestroy(destroy)

    $: isComment = noteExtended.note.isComment
    $: user = noteExtended.user
    $: name = user?.name || user?.pubkey
    $: animationClass = $relativesFetched? 'animate' : ''
    
  </script>

<section 
    tabindex="-1" 
    id="note-{noteExtended.note.id}" 
    class="note px-8 py-5 rounded-lg bg-white/5 text-md block mb-3" 
    use:observeViewport
    on:viewportchange={(event: any) => {
        if(event.detail.isIntersecting) fetchRelatives(noteExtended.note.id)
    }}
    >
    <!-- role="region"  -->
    <!-- on:mouseover={() => fetchRelatives(noteExtended.note.id)}
    on:focus={() => {}}
    on:blur={() => {}} -->
    <div class="text-xs text-gray-400">
            <span class="text-xs text-gray-400">
                {name} 
                {#if isComment}
                commented
                {:else}
                posted
                {/if}
            </span>
        
        {#if noteExtended.note?.created_at}
            <span class="">{timeAgo(noteExtended.note.created_at*1000)}</span>
        {/if} 
        | 
        <a href="https://njump.me/{noteExtended.note.reference}" target="_blank">link</a>
    </div>
    
    <div class="content text-white/55 text-xl my-6 overflow-hidden overflow-ellipsis">
        {@html $content}
    </div>
    <div class="actions flex mt-2 hover:opacity-100 {animationClass}">
        <div class="flex-grow">
            <a href="">♡</a>
            {$_reactions.length}
        </div>
        <div class="flex-grow">
            <a href="">⚡</a>
            {$_zaps.length}
        </div>
        <div class="flex-grow">
            <a href="">🗨</a>
            {$_comments.length}
        </div>
    </div>
    
</section>
  
<style global>
    .note > .content {
        @apply leading-8 line-clamp-6;
    }

    .note > .content > p {
        margin-bottom: 10px;
    }
    .note > .content > ul {
        @apply p-2;
    }

    .note > .content > ul > li {
        @apply list-decimal list-item mb-4 list-inside leading-6 text-lg;
        padding: 5px;
    }

    .note > .actions {
        animation: none;
        opacity: 0;
    }
    
    .note > .actions.animate {
        animation: fadeIn 0.5s ease forwards;
    }

    .note > .actions > div > a  {
        @apply py-1 px-2 hover:bg-black/20 hover:rounded-full;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 0.5;
            transform: translateY(0);
        }
    }
</style>