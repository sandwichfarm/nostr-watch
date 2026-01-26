<script>
    import { page } from '$app/stores';
    import { derived } from 'svelte/store';
    
    export let navLinks = [
      // { href: '/', label: 'relays' },
      // { href: '/relays', label: 'relays' },
      // { href: '/operators', label: 'operators' },
      // { href: '/monitors', label: 'monitors' },
      { href: '/preferences', label: '⚙', class: 'text-xl' }
    ];

    export let disabledHrefs = [];
    export let disableAll = false;

    const currentPath = derived(page, ($page) => $page.url.pathname);

    const isActive = (href, path) => {
      return (path.includes(href) && href !== '/') || path === href;
    };

    const isDisabled = (href) => {
      if (disableAll) return true;
      return Array.isArray(disabledHrefs) && disabledHrefs.includes(href);
    };
  </script>
  
  <nav class="flex">
    {#each navLinks as link}
      {#if isDisabled(link.href)}
        <span
          aria-disabled="true"
          class={`disabled ${
            (link?.class? link.class: ''),
            isActive(link.href, $currentPath)
              ? 'bg-white/10'
              : ''
          }`}
        >
          {link.label}
        </span>
      {:else}
        <a
          href="{link.href}"
          class={`${
            isActive(link.href, $currentPath)
              ? 'bg-white/10'
              : ''
          }`}
        >
          {link.label}
        </a>
      {/if}
    {/each}
  </nav>
  

  <style lang="postcss">
    nav {
        @apply ml-7;
    }

    nav > a,
    nav > span {
        @apply ml-1 py-1.5 px-3 text-sm font-mono font-bold text-purple-200;
    }

    nav > a:hover {
        @apply underline;
    }

    nav > span.disabled {
        @apply opacity-40 cursor-not-allowed;
    }
  </style>
