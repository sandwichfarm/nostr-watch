<script lang="ts">
    import Feed from "$lib/components/feeds/Feed.svelte";

    export let pubkey: string;

    const type = 'grid'
    const infiniteScroll = false
    const maxWidth = 200
    

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 2,
    }];
</script>

<Feed {filters} {infiniteScroll} {type} {maxWidth} />