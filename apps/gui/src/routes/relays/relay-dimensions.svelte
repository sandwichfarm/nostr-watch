<script>

	import { page } from "$app/stores";

</script>

<div class="flex flex-row ml-3 opacity-70">
    <span class="ml-1 mr-1 text-sm italic">Dimension</span>
    <a href="/relays" class="dimension-link {$page.url.pathname === '/relays'? 'dimension-link-active': ''}">relay</a>
    <a href="/relays/software" class="dimension-link {$page.url.pathname === '/relays/software'? 'dimension-link-active': ''}">software</a>
    <a href="/relays/geography" class="dimension-link {$page.url.pathname === '/relays/geography'? 'dimension-link-active': ''}">geo</a>
    <a href="/relays/isps" class="dimension-link {$page.url.pathname === '/relays/isps'? 'dimension-link-active': ''}">isps</a>
</div>

<style lang="postcss">
	.dimension-link {
		@apply py-1 px-2 ml-3 text-sm rounded-sm bg-black/5 dark:bg-white/5 hover:bg-white/20 dark:bg-black/20;
	}

    .dimension-link-active {
        @apply py-1 px-2 ml-3 rounded-sm bg-white/20 dark:bg-black/20;
    }
</style>