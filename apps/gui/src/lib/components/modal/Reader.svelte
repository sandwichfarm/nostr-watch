<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog"
	import Button from "$ui/button/button.svelte";
	import { parseNote } from "$utils/notes";
	import type { NostrEvent } from "@nostrwatch/route66/models";
	import { onMount } from "svelte";
	import { writable, type Readable, type Writable } from "svelte/store";
    

    const showReader: Writable<boolean> = writable(false);

    export let note: Readable<NostrEvent> | Writable<NostrEvent>;
    export let triggerText: string = "Open" 
    export let readerTitle: string | undefined = undefined;
    export let clickFn: () => void = () => {};
    export let showSummary: boolean = true;
    export let gradientColor: string = 'gray-900';
    export let parserOptions: any | undefined = {
        removeHashtags: true,
        nip19: true,
        markdown: true,
        images: true,
        videos: true,
        truncate: true,
        truncateLength: 100,
        sanitize: false,
        replaceAmpersand: true,
    };
    
    let content: Writable<string | undefined> = writable(undefined);

    const toggleReader = () => {
        showReader.update((v) => !v);
        if ($showReader) {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    showReader.set(false);
                }
            });
        } else {
            window.removeEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    showReader.set(false);
                }
            });
        }

    }

    const noteUnsub = note.subscribe((n) => {
        content = parseNote(n.content, parserOptions);  
    });

    onMount(() => {
        content = parseNote($note.content, parserOptions);  
        return () => {
            noteUnsub();
        }
    });

    $: readerClass = $showReader? 'block' : 'hidden';
    
</script>


{#if showSummary}
<section class="reader-content line-clamp-6 relative">
    {@html $content}
    <div class="absolute bottom-0 right-0 left-0 bg-gradient-to-t from-{gradientColor} h-20"></div>
</section>
{/if}

<Button class="mt-10" on:click={() => { 
    toggleReader()
    clickFn()
}}>
{triggerText}
</Button>

<div
    on:mousedown={showReader.set(false)}
    id="reader-bg" 
    class="fixed top-0 right-0 left-0 bottom-0 bg-white/80 dark:bg-black/80 blur-md z-[9000] {readerClass}">

</div>

<section id="reader" class="py-20 px-32 bg-black rounded-2xl border-[10px] border-white/10 shadow-2xl shadow-white/10 absolute top-20 left-20 right-20 z-[9001]  {readerClass}"> 
    <Button class="font-mono font-bold absolute top-2 right-2 bg-transparent text-black dark:text-white hover:bg-black/20 dark:hover:bg-white/10 " on:click={() => showReader.set(false)}>[ x ]</Button>
    {#if readerTitle}
    <h2 class="font-mono lowercase relative -top-10">
        <a href="https://njump.me/{$note.reference}" target="_blank" rel="noopener noreferrer">
            {readerTitle} 🔗
        </a>
    </h2>
    {/if}
    <section class="reader-content">
        {@html $content}
    </section>
</section>

<!-- <Dialog.Root>
    <Dialog.Trigger>{triggerText}</Dialog.Trigger>
    <Dialog.Content class="w-3/4">
      <Dialog.Header>
        {#if readerTitle}
          <Dialog.Title>{readerTitle}</Dialog.Title>
        {/if}
        <Dialog.Description>
        <section class="reader-content">
            {@html $readerContent}
        </section>
        </Dialog.Description>
      </Dialog.Header>
    </Dialog.Content>
</Dialog.Root> -->

<style lang="postcss" global>
    .reader-content {
        @apply p-4 text-xl overflow-y-scroll max-w-[750px] m-auto opacity-80;
    }

    .reader-content > h2 {
        @apply text-2xl mb-5 border-b-[1px] border-white/50 pb-4 mt-10;
    }

    .reader-content > * {
        @apply text-left;
    }

    .reader-content * {
        @apply leading-10 ;
    }

    .reader-content > p {
        @apply block my-5;
    }

    .reader-content table {
        @apply border border-white/5  bg-black/5 dark:bg-white/5;
    }

    .reader-content table th {
        @apply underline;
    }

    .reader-content table td, .reader-content table th {
        @apply border border-white/5 py-2 px-3;
    }

    .reader-content table td:first-child,
    .reader-content table th:first-child {
        @apply font-bold text-center;
    }

</style>