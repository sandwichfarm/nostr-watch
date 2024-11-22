<script>
	import '../app.css';
	import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
	import Header from '$lib/components/blocks/Header.svelte';

    onMount(() => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);

        if (isMobile && $page.url.pathname !== '/mobile') {
            goto('/mobile'); // Redirect to the mobile-specific template
        }
    });

	let { children } = $props();
</script>

<Header />

{@render children()}
