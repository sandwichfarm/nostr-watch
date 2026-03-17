<script lang="ts">
  import { onMount } from 'svelte';
  import { initTheme, toggleTheme, theme } from './lib/theme.svelte.ts';

  onMount(() => {
    initTheme();
  });
</script>

<div class="relative min-h-screen bg-white dark:bg-dark-bg">
  <!-- Theme toggle button -->
  <button
    onclick={toggleTheme}
    class="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border transition-colors"
    aria-label="Toggle dark mode"
  >
    {#if theme.dark}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    {/if}
  </button>

  <!-- Main content -->
  <main class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-4">
        Relay Monitor
      </h1>
      <p class="text-gray-500 dark:text-dark-muted">
        Loading dashboard...
      </p>
    </div>
  </main>
</div>
