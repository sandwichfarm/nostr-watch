<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, getContext, onDestroy } from 'svelte';
  import { doBootstrap } from '$lib/stores/routines.js';

  import Header from '$lib/components/blocks/Header.svelte';
    // import { bootstrap, destroy } from '$lib/utils/lifecycle.js';

    const { data, children } = $props();
    let unsubscribe: () => any = () => {};

    doBootstrap.subscribe((value: boolean) => {
        const newValue = value 
        if($doBootstrap === false && newValue === true) {
            loadData()
        }
        doBootstrap.set(value)
        console.log(`doBootstrap ${value}`)
    });

    onDestroy(unsubscribe);

    const loadData = async () => {
        (await import('$lib/utils/lifecycle.js')).bootstrap();
    }

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
        
        if(!$doBootstrap || ['/note/', '/relays/', '/preferences/'].includes($page.url.pathname)) return console.log('Skipping bootstrap');
        await loadData()

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