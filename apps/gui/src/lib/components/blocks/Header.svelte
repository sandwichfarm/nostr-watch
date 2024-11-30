<script lang="ts">
    import { page } from '$app/stores';
</script>

<header id="site-header">
    <h1>nostr.watch</h1>
    <nav>
        <a href="/">home</a>
        <a href="/relays">relays</a>
        <a href="/monitors">monitors</a>
        <a href="/preferences">preferences</a>
    </nav>
</header>

<style>
    #site-header {
        @apply fixed top-0 right-0 left-0 flex items-center h-16 bg-black text-white z-[9999];
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
</style>