<script lang="ts">
	import type { NostrEvent } from "@nostrwatch/route66/models";
	import type { Readable } from "svelte/motion";
	import { writable, type Writable } from "svelte/store";
	import FeedNoteContent from "../feeds/FeedNoteContent.svelte";
	import Button from "$ui/button/button.svelte";
	import Reader from "../modal/Reader.svelte";

    export let wikis: Readable<NostrEvent[]> | Writable<NostrEvent[]>;

    $: firstNote = $wikis?.[0];

    let expanded: Writable<boolean> = writable(false);

    // $: expandedClass = $expanded? '' : 'line-clamp-[5]';
    $: expandedClass = $expanded? '' : ''
</script>

<section class="wiki {expandedClass}">
    <FeedNoteContent 
        note={firstNote} 
        parserOptions={{
            truncate: false,
            markdown: true
        }} 
        useReaderModal={true}
        readerTitle="About"
    />
</section>

<!-- <Button 
    size="sm"
    variant="secondary"
    class="mt-10"
    on:click={() => expanded.set(!$expanded)}>
    
    {$expanded? 'show less' : 'read more'}
</Button> -->

<style lang="postcss" global>
    .wiki {
        @apply p-4 m-auto;
    }

    .wiki > h2 {
        @apply text-lg py-5 mb-5 w-full border-b-[1px];
    }

    .wiki * {
        @apply leading-relaxed;
    }

    .wiki > p {
        @apply block !my-10;
    }

    .wiki table {
        @apply border border-white/5 w-full bg-black/5 dark:bg-white/5;
    }

    .wiki table th {
        @apply underline;
    }

    .wiki table td, .wiki table th {
        @apply border border-white/5 py-2 px-3;
    }

    .wiki table td:first-child,
    .wiki table th:first-child {
        @apply font-bold text-center;
    }
</style>