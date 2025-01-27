<script lang="ts">
	import type { UserFeedItem } from '$lib/services/UserService';
    import { parseNote } from '$lib/utils/notes';
	import { timeAgo } from '$lib/utils/time';
	import type { IEvent, NostrEvent } from '@nostrwatch/route66/models';
	import type { UserFeedItemRelatives } from '$lib/services/UserService';
	import { observeViewport } from '$lib/utils/ux';
	import { onDestroy, onMount } from 'svelte';
    import { writable, type Readable, type Writable } from 'svelte/store';
	import { pubkeyUserInstance } from '$stores/helpers/helpers-pubkey';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';
    import { noteCommentsCount$, noteReactionsCount$, noteZaps$ } from '$stores/helpers/helpers-notes';  
	import { activeMonitorChecksCount } from '$stores/monitors';
	import FeedNoteComments from './FeedNoteComments.svelte';
	import FeedNoteZaps from './FeedNoteZaps.svelte';
	import FeedNoteReactions from './FeedNoteReactions.svelte';
	import { delay } from '@nostrwatch/utils';

    
    export let note: NostrEvent;
    export let memoryRelay: SvelteMemoryRelay<IEvent, NostrEvent>;
    export let relativesFetcher: undefined | (() => void) = undefined;

    let content: Writable<string>;

    const fetchRelatives = async () => {
        if(!relativesFetcher) return;
        if(relativesFetched) return;
        relativesFetcher()
    }
  
    const mount = async () => {
        content = parseNote(note.content, {
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
        content.set('');
    }

    onMount(mount)
    onDestroy(destroy)

    $: isComment = note.isComment
    $: user = pubkeyUserInstance(note.pubkey)
    $: name = user?.name || user?.pubkey
    
    let isVisible: boolean = true;

    $: actionsClass = isVisible? '' : 'opacity-0';

    let commentsCountCache: number | undefined;
    let reactionsCountCache: number | undefined;
    let zapSumCache: string = '';

    let relativesFetched: boolean = false;
</script>

<section 
    tabindex="-1" 
    id="note-{note.id}" 
    class="note px-8 py-5 rounded-lg bg-black/5 dark:bg-white/5 text-md block mb-3" 
    use:observeViewport
    on:viewportchange={(event: any) => {
        isVisible = event.detail.isIntersecting;
        if(isVisible) fetchRelatives()
    }}
    >
    <div class="text-xs text-gray-400">
            <span class="text-xs text-gray-400">
                {name} 
                {#if isComment}
                commented
                {:else}
                posted
                {/if}
            </span>
        
        {#if note?.created_at}
            <span class="">{timeAgo(note.created_at*1000)}</span>
        {/if} 
        | 
        <a href="https://njump.me/{note.reference}" target="_blank">link</a>
    </div>
    
    <div class="content text-black/55 dark:text-white/55 text-xl my-6 overflow-hidden overflow-ellipsis">
        {@html $content}
    </div>
    <div class="actions flex mt-2 hover:opacity-100 {actionsClass} min-h-6">
        <div class="flex-grow">
            <a href="">♡</a>
            {#if isVisible}
            <FeedNoteReactions {note} {memoryRelay} bind:reactionsCountCache={reactionsCountCache} />
            {:else}
            {reactionsCountCache? reactionsCountCache : ''}
            {/if}
        </div>
        <div class="flex-grow">
            <a href="">⚡</a>
            {#if isVisible}
            <FeedNoteZaps {note} {memoryRelay} bind:zapSumCache={zapSumCache} />
            {:else}
            {zapSumCache? zapSumCache : ''}
            {/if}
        </div>
        <div class="flex-grow">
            <a href="">🗨</a>
            {#if isVisible}
            <FeedNoteComments {note} {memoryRelay} bind:commentsCountCache={commentsCountCache} />
            {:else}
            {commentsCountCache? commentsCountCache : ''}
            {/if}
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

    .note > .content pre {
        display:none;
    }

    .note > .actions {
        animation: none;
        opacity: 0.6;
    }
    
    /* .note > .actions.animate {
        animation: fadeIn 0.5s ease forwards;
    } */

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