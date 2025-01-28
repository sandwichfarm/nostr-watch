<script lang="ts">
	import { page } from "$app/stores";
	import BootstrapLoading from "$lib/components/partials/BootstrapLoading.svelte";
	import Nip66Check from "$lib/components/partials/Nip66Check.svelte";
	import PubkeyPhoto from "$lib/components/partials/PubkeyPhoto.svelte";
	import { hasBeenBoostrapped } from "$stores/app";
	import { softwareGeos$, softwareIsps$, softwareOperatorsPubkeys$, softwareRelays$ } from "$stores/helpers/helpers-software";
	import Badge from "$ui/badge/badge.svelte";
	import { instance } from "$utils/lifecycle";
	import { parseNote } from "$utils/notes";
	import { formatRelayUrl } from "$utils/routing";
	import { clickToCopy, observeViewport } from "$utils/ux";
	import { NostrEvent, type IEvent } from "@nostrwatch/route66/models";
	import { deterministicHash } from "@nostrwatch/route66/utils";
	import countryCodeToFlagEmoji from "country-code-to-flag-emoji";
	import { stringify } from "json-source-map";
	import { map } from "lodash";
	import { onMount } from "svelte";
	import { get, writable, type Readable, type Writable } from "svelte/store";

    const WIKI_KIND = 30818;

    const softwareKeyBase64 = $page.params.softwareKey;
    const softwareKey = atob(softwareKeyBase64);

    const relays: Readable<Nip66Check[]> = softwareRelays$(softwareKey);
    const isps: Readable<string[]> = softwareIsps$(softwareKey);
    const operators: Readable<string[]> = softwareOperatorsPubkeys$(softwareKey);
    const geocodes: Readable<string[]> = softwareGeos$(softwareKey);

    const wikis: Writable<NostrEvent[]> = writable([]);

    $: bootstrapped = hasBeenBoostrapped();

    onMount(async () => {
        const route66 = await instance();
        await route66.ready();
        const filters = {
            kinds: [WIKI_KIND],
            '#d': [softwareKeyBase64]
        }
        const relays = ['wss://relay.wikifreedia.xyz']
        const options = {
            cache: true,
            stream: false,
            keepAlive: false,
            returnResults: true
        }
        let results = await route66.adapters?.websocketAdapter?.subscribe({relays, filters, options});
        results = results.map((ev: IEvent) => new NostrEvent(ev))
        wikis.set(results);
    });
</script>

<header
  id="relay-header"
  class="relative bg-center bg-cover bg-no-repeat h-48 px-3 py-10 bg-black/20 dark:!bg-white/5"
>

  

  <div class="relative z-10 flex justify-between p-6 h-full">
    <div class="flex">
      <div class="">
        <h1 class="copy-this relative">
          <span 
            class="block -mt-2 relative text-black/50 dark:text-white text-6xl py-2 px-3 rounded-lg cursor-pointer hover:bg-white/50 hover:dark:bg-black/50" 
            use:clickToCopy 
            aria-label="Copy software descriptor"
          >
            {softwareKey}
          </span>
          <span class="copy-message">click to copy software key</span>
        </h1>
      </div>
      
      
    </div>
    
  </div>
  <div class="text-xs block clear-both ml-10 font-mono opacity-50" use:clickToCopy>
    {$page.params.softwareKey}
  </div>
</header>

{#if !bootstrapped}
    <BootstrapLoading />
{:else}

{#if $wikis.length}
    <section class="p-4 mt-20">
        <h2 class="text-xl font-semibold mb-2">About</h2>
        {#each $wikis as wiki (wiki)}
            <p>{get(parseNote(wiki.content))}</p>
        {/each}
    </section>
{/if}
 
<section>
    <div class="mt-10 flex flex-row w-full items-center   justify-center gap-10">
        <div class="flex flex-col items-center">
            <h2 class="text-xl font-semibold mb-2">Deployed by</h2>
            <div class="h-28 w-28 rounded-full bg-blue-500 text-white flex items-center justify-center text-4xl font-bold">
                {$operators.length}
            </div>
            <p class="mt-2 text-lg font-medium">Operators</p>
        </div>
        <div class="flex flex-col items-center">
            <h2 class="text-xl font-semibold mb-2">In</h2>
            <div class="h-28 w-28 rounded-full bg-green-500 text-white flex items-center justify-center text-4xl font-bold">
                {$geocodes.length}
            </div>
            <p class="mt-2 text-lg font-medium">Countries</p>
        </div>
        <div class="flex flex-col items-center">
            <h2 class="text-xl font-semibold mb-2">Served by</h2>
            <div class="h-28 w-28 rounded-full bg-red-500 text-white flex items-center justify-center text-4xl font-bold">
                {$isps.length}
            </div>
            <p class="mt-2 text-lg font-medium">ISPs</p>
        </div>
        <div class="flex flex-col items-center">
            <h2 class="text-xl font-semibold mb-2">Powering</h2>
            <div class="h-28 w-28 rounded-full bg-yellow-500 text-white flex items-center justify-center text-4xl font-bold">
                {$relays.length}
            </div>
            <p class="mt-2 text-lg font-medium">Relays</p>
        </div>
    </div>

    <div class="flex flex-col gap-10">
        <!-- Operators Section -->
        <div class="row flex">
            <div class="flex flex-col items-center">
                <h2 class="text-xl font-semibold mb-2">Deployed by</h2>
                <div class="h-28 w-28 rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                    {$operators.length}
                </div>
                <p class="mt-2 text-lg font-medium">Operators</p>
            </div>
            <div class="ml-20 flex-grow mt-2">
                {#if $operators.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each $operators as operator (operator)}
                            <PubkeyPhoto pubkey={operator} />
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Geocodes Section -->
        <div class="row flex">
            <div class="flex flex-col items-center">
                <h2 class="text-xl font-semibold mb-2">In</h2>
                <div class="h-28 w-28 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl font-bold">
                    {$geocodes.length}
                </div>
                <p class="mt-2 text-lg font-medium">Countries</p>
            </div>
            <div class="ml-20 flex-grow mt-2">
                {#if $geocodes.length > 0}
                    <div class="flex flex-wrap gap-2 text-7xl">
                        {#each $geocodes as geocode (geocode)}
                            <span>{countryCodeToFlagEmoji(geocode)}</span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- ISPs Section -->
        <div class="row flex">
            <div class="flex flex-col items-center">
                <h2 class="text-xl font-semibold mb-2">Served by</h2>
                <div class="h-28 w-28 rounded-full bg-red-500 text-white flex items-center justify-center text-2xl font-bold">
                    {$isps.length}
                </div>
                <p class="mt-2 text-lg font-medium">ISPs</p>
            </div>
            <div class="ml-20 flex-grow mt-2">
                {#if $isps.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each $isps as isp (isp)}
                            <span class="mr-2 mb-2 py-2 px-4 inline-block rounded-sm bg-white/20">{isp}</span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Relays Section -->
        <div class="row flex">
            <div class="flex flex-col items-center">
                <h2 class="text-xl font-semibold mb-2">Powering</h2>
                <div class="h-28 w-28 rounded-full bg-yellow-500 text-white flex items-center justify-center text-2xl font-bold">
                    {$relays.length}
                </div>
                <p class="mt-2 text-lg font-medium">Relays</p>
            </div>
            <div class="ml-20 flex-grow mt-2">
                {#if $relays.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each $relays as check (check)}
                            <a class="mr-2 mb-1 py-2 px-2 text-md inline-block text-white/80 hover:text-white rounded-sm bg-white/10 hover:bg-white/30" href="/relays/{formatRelayUrl(check.relay)}">{check.relay.replace('wss://', '').replace('ws://')}</a>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</section>

{/if}

<style lang="postcss">

    h1 > .copy-message {
        @apply hidden absolute bg-black/50 dark:bg-white/50 text-white dark:text-black text-xs px-1 rounded;
    }

    h1:hover > .copy-message {
        @apply block -top-1;
    }
    
    .row {
        @apply mt-10 m-auto mx-10 bg-white/5 rounded-lg border border-white/5 px-10 py-14;
        
    }

    h2,
    p {
        @apply text-center;
    }

    .row > div:first-child {
        @apply flex-shrink-0;
    }
</style>

