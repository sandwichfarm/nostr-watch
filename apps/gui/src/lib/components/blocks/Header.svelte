<script lang="ts">;
    import { page } from '$app/stores';
	import AutoSuggestRelays from '../partials/AutoSuggestRelaysCompact.svelte';
    import { doBootstrap } from '$lib/stores/routines';
	import { hasBeenBoostrapped } from '$lib/stores/app';
    import { totalMonitors } from '$lib/stores';
  
    $: isHomepage = $page.url.pathname === '/';
    $: isBootstrapped = hasBeenBoostrapped();
    $: loadedEnough = hasBeenBoostrapped() || $totalMonitors.size > 1
</script>

<header id="site-header">
    
    <h1>nostr.watch</h1>
    {#if loadedEnough || !$doBootstrap}
    <nav>
        <a href="/">home</a>
        <a href="/relays">relays</a>
        <a href="/monitors">monitors</a>
        <a href="/preferences">preferences</a>
    </nav>
    {/if}
    {#if !isHomepage}
    <div class="search-container">
        <search>
            <AutoSuggestRelays />        
        </search>
    </div>
    {/if}
</header>

<style>
    #site-header {
        @apply fixed top-0 right-0 left-0 flex items-center h-16 bg-black/25 backdrop-blur-lg text-white z-[8999];
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
        @apply ml-auto mr-4 w-96 backdrop-blur-lg;
    }

    search {
        @apply block backdrop-blur-lg;
    }
</style>
