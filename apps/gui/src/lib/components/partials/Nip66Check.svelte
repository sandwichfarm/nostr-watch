<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { Monitor, type Nip66Event } from '@nostrwatch/nip66/models';
  import { onMount } from 'svelte';
  import { formatSeconds, timeAgo } from '$lib/utils/time.js';
	import { clickToCopy } from "$lib/utils/ux";
	import { nip19 } from "nostr-tools";

  export let check: Nip66Event;
  // export let monitor: Monitor | undefined;

  onMount(() => {});

  $: elapsed = timeAgo(check.created_at * 1000);
  $: reference = check.reference;
</script>

<div id="encoded" class="overflow-hidden overflow-ellipsis bg-white/5 py-3 px-6 rounded-md cursor-pointer font-mono max-w-full" use:clickToCopy>
  {reference}
</div>

<Tabs.Root value="general-info" class="w-full">
  <Tabs.List>
    <Tabs.Trigger value="general-info">Parsed</Tabs.Trigger>
    <Tabs.Trigger value="empty">Raw JSON</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="general-info">
    <table>
      <thead>
        <tr>
          <th colspan="2">General</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Relay</td>
          <td>{check.relay}</td>
        </tr>
        <tr>
          <td>Monitor Pubkey</td>
          <td>{check.monitorPubkey}</td>
        </tr>
        <tr>
          <td>Reported Online</td>
          <td>{elapsed}</td>
        </tr>
        <tr>
          <td>Operator Pubkey</td>
          <td>{check.operatorPubkey}</td>
        </tr>
      </tbody>
    </table>
    
    <table>
      <thead>
        <tr>
          <th colspan="2">Network Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Network</td>
          <td>{check.networks?.join(', ') || 'N/A'}</td>
        </tr>
        <tr>
          <td>Round Trip Time (RTT)</td>
          <td>{check.rtt ? `${check.rtt} ms` : 'N/A'}</td>
        </tr>
        <tr>
          <td>Supported NIPs</td>
          <td>{check.supportedNips?.join(', ') || 'N/A'}</td>
        </tr>
        <tr>
          <td>Software</td>
          <td>{check.software}</td>
        </tr>
        <tr>
          <td>Version</td>
          <td>{check.version}</td>
        </tr>
      </tbody>
    </table>
    
    <table>
      <thead>
        <tr>
          <th colspan="2">Geolocation Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Country Code Alpha-2</td>
          <td>{check.geocodeAlpha2}</td>
        </tr>
        <tr>
          <td>Country Code Alpha-3</td>
          <td>{check.geocodeAlpha3}</td>
        </tr>
        <tr>
          <td>Country Code Numeric</td>
          <td>{check.geocodeNumeric}</td>
        </tr>
        <tr>
          <td>ISP</td>
          <td>{check.isp}</td>
        </tr>
        <tr>
          <td>AS</td>
          <td>{check.as}</td>
        </tr>
        <tr>
          <td>AS Name</td>
          <td>{check.asname}</td>
        </tr>
      </tbody>
    </table>
    
    {#if check.networks.includes('clearnet')}
    <table>
      <thead>
        <tr>
          <th colspan="2">IP and SSL Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>IPv4 Addresses</td>
          <td>{check.ipv4?.join(', ') || 'N/A'}</td>
        </tr>
        <tr>
          <td>IPv6 Addresses</td>
          <td>{check.ipv6?.join(', ') || 'N/A'}</td>
        </tr>
        <tr>
          <td>SSL Valid To</td>
          <td>{check.sslValidTo}</td>
        </tr>
        <tr>
          <td>SSL Issuer</td>
          <td>{check.sslIssuer}</td>
        </tr>
      </tbody>
    </table>
    {/if}
    
    <table>
      <thead>
        <tr>
          <th colspan="2">Requirements</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Payment Required</td>
          <td>{check.paymentRequired ? 'Yes' : 'No'}</td>
        </tr>
        <tr>
          <td>Auth Required</td>
          <td>{check.authRequired ? 'Yes' : 'No'}</td>
        </tr>
        <tr>
          <td>Proof of Work (PoW) Required</td>
          <td>{check.powRequired ? 'Yes' : 'No'}</td>
        </tr>
      </tbody>
    </table>
  </Tabs.Content>

  <Tabs.Content value="empty">
    <pre class="m-4 py-5 px-7 bg-white/10 rounded-lg text-sm">{JSON.stringify(check.json, null, 2)}</pre>
  </Tabs.Content>
</Tabs.Root>

<style lang="postcss">
  table {
    @apply w-full border-collapse;
  }

  th, td {
    @apply border-t border-white/5 py-2 px-2;
  }

  th {
    @apply bg-white/10
  }

  table tbody tr td:first-child {
    @apply w-64 text-white/50;

  }
</style>
