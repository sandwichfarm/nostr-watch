<script lang="ts">
    import Feed from "$lib/components/feeds/Feed.svelte";

    export let pubkey: string;

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 50
    }];
</script>

<Feed {filters} />