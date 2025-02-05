<script lang="ts">
    import Feed from "$lib/components/feeds/Feed.svelte";
	import { operatorRelays$ } from "$stores/helpers/helpers-operator";
	import type { ParseConfig } from "$utils/notes";
	import { onMount } from "svelte";
	import { readable, writable, type Readable } from "svelte/store";

    export let pubkey: string;
    export let relays: Readable<string[] | undefined> = readable(undefined);

    const type = 'scroller'
    const infiniteScroll = true
    const maxWidth = 200
    const maxHeight = 350
    const noteClamp = 6
    const autoScroll = true;
    const parserOptions: ParseConfig = {
        markdown: true,
        images: false,
        videos: false,
        truncate: true,
        truncateLength: 500,
        sanitize: false,
        nip19: true,
    }

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 20,
    }];

    
    const show = writable(false)

    onMount( () => {
        show.set(true)
    })
</script>

{#if $show }
<Feed 
    {filters} 
    {relays}
    {infiniteScroll} 
    {type} 
    {maxWidth} 
    {maxHeight} 
    {noteClamp} 
    {autoScroll} 
    {parserOptions} />
{/if}