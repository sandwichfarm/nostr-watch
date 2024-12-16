<script lang="ts">
import '../app.css';
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { onMount, getContext, onDestroy } from 'svelte';
import { doBootstrap } from '$lib/stores/routines.js';

import Header from '$lib/components/blocks/Header.svelte';
import { instance, bootstrap, seedFromCache } from '$lib/utils/lifecycle';
import { get, writable, type Writable } from 'svelte/store';
import { eventsArray } from '$lib/stores/events';
import { navigating } from '$app/stores';
import type Nip66 from '@nostrwatch/nip66';
import { destroy } from '$lib/utils/lifecycle';
import { createTabLifecycle } from '$lib/utils/tab-lifecycle';
	import { delay } from '@nostrwatch/utils';
  // import { bootstrap, destroy } from '$lib/utils/lifecycle.js';

const isLeader: Writable<boolean> = writable(false);

const lifecycle = createTabLifecycle();

lifecycle.onStartLeader(async () => {
  isLeader.set(true);
  await loadData(); 
  console.log('Leader tab: DB initialized.');
});

lifecycle.onReleaseLeader(async () => {
  console.log("Leader tab: Releasing..."); 
  const nip66 = await instance();
  console.log("Leader tab: awaiting ready..."); 
  await nip66.ready();
  console.log("Leader tab: ready, awaiting shutdown..."); 
  await nip66.shutdown();
  console.log("Leader tab: shutdown..."); 
  await delay(1000);
  destroy();
  isLeader.set(false);
  console.log("Leader tab: Released.");
});

lifecycle.onWaitForLeaderRelease(() => {
  console.log('Non-leader tab: Waiting for DB to be released by leader...');
});

lifecycle.onLeaderAcquired(async () => {
  console.log('Non-leader tab: Just became leader, initializing DB.');
  isLeader.set(true);
  await loadData(); 
});


const { data, children } = $props();
let unsubs: (() => any)[] = [];

let busy = false 
let doBootstrapCache = undefined;

unsubs.push(doBootstrap.subscribe(doBootstrap.set));

const unsubscribe = () => {
    unsubs.forEach(unsub => unsub());
}

const loadData = async () => {
    if(!$doBootstrap) {
      ( async () => {
        const n66: Nip66 = await instance()
        await n66.ready();
        await n66.adapters.cacheAdapter.ready();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('!!! SEEDING FROM CACHE')
        await seedFromCache();
        console.log('!!! SEEDED FROM CACHE', $eventsArray.length)
      })()
    } else if(!busy) {
      busy = true
      bootstrap().then( () => busy = false );
  }    
}

onDestroy(unsubscribe);

onMount(async () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);

    if (isMobile && $page.url.pathname !== '/mobile') {
        goto('/mobile'); // Redirect to the mobile-specific template
    }
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    if(typeof $doBootstrap === 'undefined') {
        doBootstrap.set(true);
    }

    lifecycle.acquireLeadership();
    
});

$effect(() => {
  if ($navigating) {
    loadData();
  }
});
</script>

{#if $isLeader}
<Header />
<div id="content-wrapper" class="mt-16 block">
{@render children()}
</div>
{:else}
<div class="flex flex-col items-center justify-center h-screen">
  <div class="text-2xl">Another Session Detected</div>
  <div class="text-lg">Please wait while we terminate existing session (from another tab or window)</div>
</div>
{/if}

<style global>

:root {
  --scrollbar-primary: black;
  --scrollbar-secondary: rgba(255,255,255,0.2);
}

body {
  @apply pb-10;
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-secondary) var(--scrollbar-primary);
}

/* Chrome, Edge, and Safari */
*::-webkit-scrollbar {
  width: 15px;
}

*::-webkit-scrollbar-track {
  background: var(--scrollbar-primary);
  border-radius: 5px;
}

*::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-secondary);
  border-radius: 14px;
  border: 3px solid var(--scrollbar-primary);
}


</style>