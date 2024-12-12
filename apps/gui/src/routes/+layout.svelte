<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, getContext, onDestroy } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';

  import Header from '$lib/components/blocks/Header.svelte';
	import { instance, bootstrap, seedFromCache } from '$lib/utils/lifecycle';
	import { get } from 'svelte/store';
	import { eventsArray } from '$lib/stores/events';
  import { navigating } from '$app/stores';
  import type Nip66 from '@nostrwatch/nip66';
    // import { bootstrap, destroy } from '$lib/utils/lifecycle.js';

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
          const n66: Nip66 = await instance()
          await n66.ready();
          await n66.adapters.cacheAdapter.ready();
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('!!! SEEDING FROM CACHE')
          await seedFromCache();
          console.log('!!! SEEDED FROM CACHE', $eventsArray.length)
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

        loadData();
    });

    $effect(() => {
      if ($navigating) {
        loadData();
      }
    });
</script>

<Header />
<div id="content-wrapper" class="mt-20 block">
{@render children()}
</div>

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