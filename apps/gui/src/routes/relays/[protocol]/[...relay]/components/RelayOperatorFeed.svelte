<script lang="ts">
    import Feed from "$lib/components/partials/Feed.svelte";

    export let pubkey: string;

    const filters = [{
        authors: [pubkey],
        kinds: [1],
        limit: 20
    }];
</script>

<Feed {filters} />