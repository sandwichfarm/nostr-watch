<script lang="ts">
    import Feed from "$lib/components/feeds/Feed.svelte";
	import type { ParseConfig } from "$utils/notes";

    export let pubkey: string;

    const type = 'scroller'
    const infiniteScroll = true
    const maxWidth = 200
    const noteClamp = 6
    const autoScroll = true;
    const parserOptions: ParseConfig = {
        markdown: true,
        images: false,
        videos: false,
        truncate: false,
        sanitize: false,
        nip19: true,
    }

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 20,
    }];
</script>

<Feed {filters} {infiniteScroll} {type} {maxWidth} {noteClamp} {autoScroll} {parserOptions} />