<script lang="ts">
    import Feed from "$lib/components/feeds/Feed.svelte";

    export let pubkey: string;

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 10
    }];
</script>

<Feed {filters} />