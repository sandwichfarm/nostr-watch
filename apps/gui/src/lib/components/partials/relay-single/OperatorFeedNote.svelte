<script lang="ts">
	import type { UserFeedItem } from '$lib/services/UserService';
    import { parseNote } from '$lib/utils/notes';
	import { timeAgo } from '$lib/utils/time';
	import { onMount } from 'svelte';
    import type { Writable } from 'svelte/store';
  
    export let noteExtended: UserFeedItem;
  
    // Initialize content as Writable<string>
    let content: Writable<string>;
  
    // Assign the store directly upon component initialization
    onMount( () => {
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
    })

    $: isComment = noteExtended.note.isComment
    $: user = noteExtended.user
    $: name = user?.name || user?.pubkey
    
  </script>

<section id="note-{noteExtended.note.id}" class="note px-8 py-5 rounded-lg bg-white/5 text-md block mb-3">
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
    <div class="actions flex mt-2 opacity-25 hover:opacity-100">
        <div class="flex-grow">
            <a href="">♡</a>
            {noteExtended.reactions.length}
        </div>
        <div class="flex-grow">
            <a href="">⚡</a>
            {noteExtended.zaps.length}
        </div>
        <div class="flex-grow">
            <a href="">🗨</a>
            {noteExtended.comments.length}
        </div>
    </div>
    
</section>
  
<style global>
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

    .note > .actions > div > a  {
        @apply py-1 px-2 hover:bg-black/20 hover:rounded-full;
    }
</style>