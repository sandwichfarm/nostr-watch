<script lang="ts">;
    import { page } from '$app/stores';
	import AutoSuggestRelays from '../partials/AutoSuggestRelaysCompact.svelte';
	import { unsupported } from '$lib/stores/app';
	import Nav from './Nav.svelte';

    export let navDisabled: boolean = false;
  
    $: isHomepage = $page.url.pathname === '/';
    $: disabledHrefs = navDisabled ? ['/relays', '/operators', '/monitors'] : [];
</script>

<header id="site-header">
    {#if !$unsupported}
        <h1>nostr.watch</h1>
        <Nav {disabledHrefs} />
        {#if !isHomepage && !navDisabled}
            <div class="search-container">
                <search>
                    <AutoSuggestRelays maxResults={6} />
                </search>
            </div>
        {/if}
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
