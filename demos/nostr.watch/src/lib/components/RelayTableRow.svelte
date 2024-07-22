<script lang="ts">
  import Time from "svelte-time";
  import Tooltip, {
    Wrapper,
    Title,
    Content,
    Link,
    RichActions,
  } from '@smui/tooltip';
  import Button, { Label } from '@smui/button';
  // import { checksStore, nip11Store, checkStatStore } from "$lib/stores"
  import type { NDKRelayMeta } from "@nostr-dev-kit/ndk"

  export let relay: NDKRelayMeta;

  $: nip11 = JSON.parse(relay?.content)
  // $: checks = $checksStore.get(relay)
  $: icon = nip11?.json?.icon || undefined
  $: name = nip11?.json?.name || ""
  // $: seenBy = $checkStatStore.get(relay) || ""
  // $: seenByCount = seenBy?.length || ""
  $: createdAt = relay?.createdAt  || ""
  $: open =  relay?.open || ""
  $: geohash = relay?.geohash || ""
  $: software = relay?.software || ""
  $: version = relay?.version || ""
</script>

<tr style="{$checksStore.get(relay)? "": 'opacity:0.4'}">
  <td>{#if icon}<img src="{icon}" alt="{name}'s icon"/>{/if}</td>
  <td>{name || ""}</td>
  <td>{relay}</td>
  <!-- <td>
    <Wrapper rich>
      <Button hover>
        <Label>{seenByCount}</Label>
      </Button>
      <Tooltip>
        <Content>
          {#each seenBy as monitor}
            {monitor} <br />
          {/each}
        </Content>
      </Tooltip>
    </Wrapper>
  </td> -->
  <td><Time relative title="last seen" timestamp="{createdAt*1000}" /></td>
  <td>{open}</td>
  <td>{geohash}</td>
  <td>{software}</td>
  <td>{version}</td>
</tr>

<style>
  img {
    width: auth;
    height: 32px;
  }
</style>