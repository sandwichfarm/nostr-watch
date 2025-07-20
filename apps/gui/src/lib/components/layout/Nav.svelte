<script>
    import { page } from '$app/stores';
    import { derived } from 'svelte/store';
    
    export let navLinks = [
      { href: '/', label: 'home' },
      { href: '/relays', label: 'relays' },
      { href: '/operators', label: 'operators' },
      { href: '/monitors', label: 'monitors' },
      { href: '/preferences', label: 'preferences' }
    ];
    const currentPath = derived(page, ($page) => $page.url.pathname);
  </script>
  
  <nav class="flex">
    {#each navLinks as link}
      <a
        href="{link.href}"
        class={`${
          link.href === '/' 
            ? $currentPath === link.href ? 'bg-white/10' : ''
            : $currentPath.startsWith(link.href) ? 'bg-white/10' : ''
        }`}
      >
        {link.label}
      </a>
    {/each}
  </nav>
  

  <style lang="postcss">
    nav {
        @apply ml-7;
    }

    nav > a {
        @apply ml-1 py-1.5 px-3 rounded-md;
    }

    nav > a:hover {
        @apply underline;
    }
  </style>