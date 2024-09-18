<script lang="ts">
  import { page } from '$app/stores';
  import { checksStore, storeKey, monitorsStore, preferencesStore, type Preferences } from '$lib/stores';
  
  let preferences: Preferences = {}

  preferencesStore.subscribe(_preferences => {
    preferences = _preferences;
  })

  const protocol: string = $page.params.protocol
  const relayNoProtocol: string = $page.params.relay

  $: relay = new URL(`${protocol}://${relayNoProtocol}`).toString()
  $: primaryData = $checksStore.get(storeKey(relay))
  $: secondaryDatas = Array.from($monitorsStore.keys())
    .filter(m => m !== preferences?.primaryMonitor )
    .map(m => $checksStore.get(storeKey(relay, m)))
</script>

{relay}

<h1>primary</h1>
{JSON.stringify(primaryData, null, 2)}


<h1>secondary</h1>
{JSON.stringify(secondaryDatas, null, 2)}