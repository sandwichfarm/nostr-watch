<script lang="ts">;
    import { page } from '$app/stores';
	import AutoSuggestRelays from '../partials/AutoSuggestRelaysCompact.svelte';
	import { unsupported } from '$lib/stores/app';
	import Nav from './Nav.svelte';
    import { HeaderConfigStore } from '$stores/header-config';

    export let navDisabled: boolean = false;

    HeaderConfigStore.update( p => {
        p.showDataViewModifiers = true;
        return p
    })

    $: isHomepage = $page.url.pathname === '/';
    $: disabledHrefs = navDisabled ? ['/relays', '/operators', '/monitors'] : [];
</script>

<header id="site-header">
    {#if !$unsupported}
        <h1>nostr.watch</h1>
        <Nav {disabledHrefs} />
         {#if !navDisabled}
            <div class="search-container">
                <search>
                    <AutoSuggestRelays maxResults={6} />
                </search>
            </div>
        {/if}
        {#if $HeaderConfigStore.showDataViewModifiers} 
            <!-- modifiers -->
        {/if}
    {/if}
</header>

<style lang="postcss" global>
    #site-header {
        @apply !h-[30px] gradient-purple border-b-[1px] border-white/10 fixed top-0 right-0 left-0 flex items-center h-12 bg-black/25 dark:bg-white/25 backdrop-blur-lg text-white dark:text-black z-[999];
    }

    #site-header h1 {
        @apply ml-4 text-sm font-bold font-mono;
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
