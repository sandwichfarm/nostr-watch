<script lang="ts">
	import { parseNote } from "$utils/notes";
	import type { NostrEvent } from "@nostrwatch/route66/models";
	import { onMount } from "svelte";
	import { writable, type Writable } from "svelte/store";

    export let note: NostrEvent;
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

    onMount(() => {
        content = parseNote(note.content, parserOptions);  
    });
</script>
{@html $content}