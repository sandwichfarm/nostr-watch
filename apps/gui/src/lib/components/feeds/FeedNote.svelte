<script lang="ts">
    import { parseNote, type ParseConfig } from '$lib/utils/notes';
	import { timeAgo } from '$lib/utils/time';
	import type { IEvent, NostrEvent } from '@nostrwatch/route66/models';
	import { observeViewport } from '$lib/utils/ux';
	import { onDestroy, onMount } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
	import { pubkeyUserInstance } from '$stores/helpers/helpers-pubkey';
	import type { SvelteMemoryRelay } from '@nostrwatch/memory-relay';
	import FeedNoteComments from './FeedNoteComments.svelte';
	import FeedNoteZaps from './FeedNoteZaps.svelte';
	import FeedNoteReactions from './FeedNoteReactions.svelte';
	import { fade, fly } from 'svelte/transition';

    export let note: NostrEvent;
    export let index: number = 0;
    export let memoryRelay: SvelteMemoryRelay<IEvent, NostrEvent>;
    export let relativesFetcher: undefined | (() => void) = undefined;
    export let noteClamp: number | undefined = 4;  
    export let parserOptions: ParseConfig = {};

    let isVisible: boolean = false;
    let content: Writable<string>;
    let relativesFetched: boolean = false;
    let commentsCountCache: number | undefined;
    let reactionsCountCache: number | undefined;
    let zapSumCache: string = '';
    let className: string = $$props.class || '';
    
    let show: Writable<boolean> =  writable(false);
    let mounted: Writable<boolean> = writable(false);

    const fetchRelatives = async () => {
        if(!relativesFetcher) return;
        if(relativesFetched) return;
        relativesFetcher()
        relativesFetched = true;
    }

    const defaultParserOptions: ParseConfig = {
        removeHashtags: true,
        nip19: true,
        markdown: true,
        images: true,
        videos: true,
        truncate: true,
        sanitize: false,
        replaceAmpersand: true
    }   
  
    const mount = async () => {
        content = parseNote(note.content, {  ...defaultParserOptions, ...parserOptions });
        setTimeout(() => {
            // if(isVisible) {
            show.set(true);
            // }
            mounted.set(true);
        }, 200*index+200);
    }

    const destroy = () => {
        content.set('');
    }

    onMount(mount)
    onDestroy(destroy)

    $: isComment = note.isComment
    $: user = pubkeyUserInstance(note.pubkey)
    $: name = user?.name || user?.pubkey
    $: actionsClass = isVisible? '' : 'opacity-0';
</script>
<div 
    use:observeViewport
    on:viewportchange={(event: any) => {
        isVisible = event.detail.isIntersecting;
        if(isVisible) {
            fetchRelatives()
        }
    }}
    class="w-96 mr-10"
    >
{#if $show}
<section 
    tabindex="-1" 
    in:fade
    id="note-{note.id}" 
    class="note gradient-blue mr-5 h-full px-8 py-5 rounded-lg bg-black/5 dark:bg-white/5 text-md mb-3 flex-shrink-0 w-96 {className}" 
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
    
    <div class="content text-black/55 dark:text-white/55 text-xl my-6 overflow-hidden overflow-ellipsis {noteClamp? `line-clamp-${noteClamp}` : ''}]">
        {@html $content}
    </div>
    <div class="actions flex mt-2 hover:opacity-100 {actionsClass} min-h-6">
        <div class="flex-grow">
            
            {#if isVisible}
                <div in:fly={{ y: 20, duration: 500 }}><span in:fade>
                    <a href="">♡</a>
                    <FeedNoteReactions {note} {memoryRelay} bind:reactionsCountCache={reactionsCountCache} />
                </span></div>
            {/if}
        </div>
        <div class="flex-grow">
            
            {#if isVisible}
            <div in:fly={{ y: 20, duration: 500 }}><span in:fade>
              <a href="">⚡</a>
              <FeedNoteZaps {note} {memoryRelay} bind:zapSumCache={zapSumCache} />
            </span></div>
            {/if}
        </div>
        <div class="flex-grow">
            
            {#if isVisible}
            <div in:fly={{ y: 20, duration: 500 }}><span in:fade>
                <a href="">🗨</a>
                <FeedNoteComments {note} {memoryRelay} bind:commentsCountCache={commentsCountCache} />
            </span></div>
            <!-- {:else}
            {commentsCountCache? commentsCountCache : ''} -->
            {/if}
        </div>
    </div>
</section>
{/if}
</div>

<style lang="postcss">

    /* Dark Mode Gradients */
    .gradient-violet-dark {
    @apply bg-gradient-to-br from-violet-600/5 to-violet-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-blue-dark {
    @apply bg-gradient-to-br from-blue-600/5 to-blue-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-green-dark {
    @apply bg-gradient-to-br from-green-600/5 to-green-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-yellow-dark {
    @apply bg-gradient-to-br from-yellow-600/5 to-yellow-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-orange-dark {
    @apply bg-gradient-to-br from-orange-600/5 to-orange-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-red-dark {
    @apply bg-gradient-to-br from-red-600/5 to-red-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-pink-dark {
    @apply bg-gradient-to-br from-pink-600/5 to-pink-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-purple-dark {
    @apply bg-gradient-to-br from-purple-600/5 to-purple-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-teal-dark {
    @apply bg-gradient-to-br from-teal-600/5 to-teal-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-indigo-dark {
    @apply bg-gradient-to-br from-indigo-600/5 to-indigo-600/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    /* Light Mode Gradients */
    .gradient-violet-light {
    @apply bg-gradient-to-br from-violet-300/5 to-violet-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-blue-light {
    @apply bg-gradient-to-br from-blue-300/5 to-blue-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-green-light {
    @apply bg-gradient-to-br from-green-300/5 to-green-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-yellow-light {
    @apply bg-gradient-to-br from-yellow-300/5 to-yellow-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-orange-light {
    @apply bg-gradient-to-br from-orange-300/5 to-orange-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-red-light {
    @apply bg-gradient-to-br from-red-300/5 to-red-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-pink-light {
    @apply bg-gradient-to-br from-pink-300/5 to-pink-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-purple-light {
    @apply bg-gradient-to-br from-purple-300/5 to-purple-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-teal-light {
    @apply bg-gradient-to-br from-teal-300/5 to-teal-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }

    .gradient-indigo-light {
    @apply bg-gradient-to-br from-indigo-300/5 to-indigo-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100;
    }


    .note {
        @apply  border-[1px] border-white/10 shadow-lg shadow-start hover:shadow-end;
    }
    
    .note > .content {
        @apply leading-8;
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