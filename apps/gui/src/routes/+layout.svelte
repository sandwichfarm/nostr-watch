<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount, getContext, onDestroy } from 'svelte';
	import Header from '$lib/components/blocks/Header.svelte';
    import { doBootstrap as _doBootstrap } from '$lib/stores/routines.js';
    // import { bootstrap, destroy } from '$lib/utils/lifecycle.js';

    const { data, children } = $props();
    let doBootstrap: boolean = true;

    let unsubscribe = page.subscribe(() => {
        _doBootstrap.set(true);
    });

    _doBootstrap.subscribe((value) => {
        const newValue = value 
        if(doBootstrap === false && newValue === true) {
            loadData()
        }
        doBootstrap = value
    });
    onDestroy(unsubscribe);

    const loadData = async () => {
        const bootstrap = (await import('$lib/utils/lifecycle.js')).bootstrap;
        bootstrap()
    }

    onMount(async () => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);

        if (isMobile && $page.url.pathname !== '/mobile') {
            goto('/mobile'); // Redirect to the mobile-specific template
        }
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        
        if($page.url.pathname.includes('/note/')) return console.log('Skipping bootstrap');

        if(!doBootstrap) return 
        await loadData()

    });
</script>

<Header />

<br /><br /><br /><br /><br /><br /><br />
{JSON.stringify(data)}

{@render children()}
