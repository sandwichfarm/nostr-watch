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
  import { checksStore, nip11Store, checkStatStore, preferencesStore, storeKey } from "$lib/stores"
  import type NDK from "@nostr-dev-kit/ndk"
  import { getContext } from "svelte"
  import { NDK_CONTEXT, PROFILES_CONTEXT } from "$lib/contextKeys"
  import { profileStore } from "$lib/stores/profileStore"
  import type NDKSvelte from "@nostr-dev-kit/ndk-svelte"
    import { monitorDb } from "@nostrwatch/idb"
    import type { NDKUserProfile } from "@nostr-dev-kit/ndk"

  export let relay: string;

  const ndk: NDKSvelte = getContext(NDK_CONTEXT)
  const profiles: NDKUserProfile[] = getContext(PROFILES_CONTEXT)

  $: key = storeKey(relay)
  $: check = $checksStore.get(key)
  $: nip11 = $nip11Store.get(key)
  $: icon = nip11?.json?.icon || undefined
  $: name = nip11?.json?.name || ""
  $: seenBy = $checkStatStore.get(relay) || ""
  $: seenByCount = seenBy?.length || ""
  $: createdAt = check?.createdAt  || ""
  $: open =  check?.open || ""
  $: geohash = check?.geohash || ""
  $: software = check?.software || ""
  $: version = check?.version || ""
  $: protocol = new URL(relay).protocol
  $: protocolNoSymbols = new URL(relay).protocol.replace(/:$/, "")
  $: relayNoProtocol = new URL(relay).href.replace(protocol+"//", "")
  $: userProfile = (pubkey: string): NDKUserProfile => $profileStore.get(pubkey)
  $: userName = (pubkey: string) => userProfile(pubkey)?.name || "anonymous"
  $: isPrimary =  (pubkey: string) => $preferencesStore.primaryMonitor === pubkey

</script>

<tr style="{$checksStore.get(key)? "": 'opacity:0.4'}">
  <td>{#if icon}<img src="{icon}" alt="{name}'s icon"/>{/if}</td>
  <td>{name}</td>
  <td><a href="/relay/{protocolNoSymbols}/{relayNoProtocol}">{relay}</a></td>
  <td>
    <Wrapper rich>  
      <Button hover>
        <Label>{seenByCount}</Label>
      </Button>
      <Tooltip>
        <Content>
          {#each seenBy as monitor}
            <li style="{isPrimary(monitor)? 'background-color:#f0f0f0': ''}">{ userName(monitor) }</li>
            <!-- {monitor} <br /> -->
          {/each}
        </Content>
      </Tooltip>
    </Wrapper>
  </td>
  <td>{#if createdAt}
    <Time relative title="last seen" timestamp="{createdAt*1000}" />
  {/if}</td>
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