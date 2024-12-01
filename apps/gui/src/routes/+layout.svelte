<script>
	import '../app.css';
	import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
	import Header from '$lib/components/blocks/Header.svelte';
    // import { bootstrap, destroy } from '$lib/utils/lifecycle.js';

    onMount(async () => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);

        if (isMobile && $page.url.pathname !== '/mobile') {
            goto('/mobile'); // Redirect to the mobile-specific template
        }
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        
        if($page.url.pathname.includes('/note/')) return console.log('Skipping bootstrap');
        const bootstrap = (await import('$lib/utils/lifecycle')).bootstrap;
        bootstrap()

    });

	let { children } = $props();
</script>

<Header />

{@render children()}
