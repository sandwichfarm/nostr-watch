<script lang="ts">
  import Masonry from 'svelte-bricks'
  import RelayGridItem from './RelayGridItem.svelte';
  // import { relayStore } from '$lib/stores'
  import type { IRelay } from '@nostrwatch/idb'

  const minColWidth = 350 
  const maxColWidth = 400
  const gap = 10

  let width, height

  $: relays = relayStore;
  $: items = $relays?.map( relay => relay.relay )
</script>


{#if items && items?.length}
<Masonry
  {items}
  {minColWidth}
  {maxColWidth}
  {gap}
  let:item
  bind:masonryWidth={width}
  bind:masonryHeight={height}
>
  <RelayGridItem {item} />
</Masonry>
{/if}