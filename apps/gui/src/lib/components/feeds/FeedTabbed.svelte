<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs"; 
	import { pubkeyProfile, pubkeyProfile$ } from '$stores/helpers/helpers-pubkey';
	import { truncateWithEllipsis } from '$utils/strings';

    export let items: Readable<NostrEvent[]> | undefined;
    export let feedService: Writable<FeedService | null>;
    export let infiniteScroll: boolean = true;

    
</script>

<Tabs.Root value="visiblity" class="">
    <Tabs.List>
        {#each $items as note}
        <Tabs.Trigger value={note.id}>{get(pubkeyProfile$(note.pubkey))?.name || truncateWithEllipsis(note.pubkey, 16)}</Tabs.Trigger>
        {/each}
        <Tabs.Trigger value="visiblity">Visiblity</Tabs.Trigger>
    </Tabs.List>

    {#each $items as note}
    <Tabs.Content value={note.id} class="py-4 px-8">
        
    </Tabs.Content>
    {/each}
</Tabs.Root>