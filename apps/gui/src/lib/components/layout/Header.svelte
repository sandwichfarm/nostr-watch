<script lang="ts">;
    import { page } from '$app/stores';
	import AutoSuggestRelays from '../partials/AutoSuggestRelaysCompact.svelte';
    import { doBootstrap } from '$lib/stores/routines';
	import { hasBeenBootstrapped } from '$lib/stores/app';
    import { totalMonitors } from '$lib/stores';
	import { unsupported } from '$lib/stores/app';
	import Nav from './Nav.svelte';
  
    $: isHomepage = $page.url.pathname === '/';
    $: isBootstrapped = hasBeenBootstrapped();
    $: loadedEnough = hasBeenBootstrapped() || $totalMonitors > 1
</script>

<header id="site-header">
    {#if (loadedEnough || !$doBootstrap) && !$unsupported}
    <h1>nostr.watch</h1>
    <Nav />
    {/if}
    {#if !isHomepage && (loadedEnough || !$doBootstrap) && !$unsupported}
    <div class="search-container">
        <search>
            <AutoSuggestRelays maxResults={6} />        
        </search>
    </div>
    {/if}
</header>

<style lang="postcss" global>
    #site-header {
        @apply fixed top-0 right-0 left-0 flex items-center h-16 bg-black/25 dark:bg-white/25 backdrop-blur-lg text-white dark:text-black z-[999];
    }

    #site-header h1 {
        @apply ml-4 text-xl;
    }

    nav {
        @apply ml-10;
    }

    nav > a {
        @apply ml-4;
    }

    nav > a:hover {
        @apply underline;
    }

    .search-container {
        @apply ml-auto mr-4 w-96;
    }

    search {
        @apply block;
    }
</style>
