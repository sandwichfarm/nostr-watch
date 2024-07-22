<script lang="ts">
  import { checksStore, nip11Store, checkStatStore } from "$lib/stores"

  export let item: string;

  $: relay = item

  $: icon = $nip11Store.get(relay)?.json?.icon || undefined
  $: name = $nip11Store.get(relay)?.json?.name || ""
  $: seenBy = $checkStatStore.get(relay) || ""
  $: seenByCount = seenBy?.length || ""
  $: createdAt = $checksStore.get(relay)?.createdAt  || ""
  $: open =  $checksStore.get(relay)?.open || ""
  $: geohash = $checksStore.get(relay)?.geohash || ""
  $: software = $checksStore.get(relay)?.software || ""
  $: version = $checksStore.get(relay)?.version || ""
</script>

<span>{#if icon}<img src="{icon}" alt="{name}'s icon"/>{/if}</span>
<span>{name}</span>
<span>{relay}</span>
<span>{seenByCount}</span>
<span>{createdAt}</span>
<span>{open}</span>
<span>{geohash}</span>
<span>{software}</span>
<span>{version}</span>