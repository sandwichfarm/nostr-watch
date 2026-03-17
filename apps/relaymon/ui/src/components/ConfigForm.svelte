<script lang="ts">
  import { configState, setMode } from '../lib/configState.svelte.ts';
  import type { ConfigMode } from '../lib/types.ts';
  import SimpleMode from './SimpleMode.svelte';

  const TABS: { id: ConfigMode; label: string }[] = [
    { id: 'simple', label: 'Simple' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'raw', label: 'YAML' },
  ];
</script>

<div class="bg-white dark:bg-dark-card rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-dark-border transition-colors duration-200 overflow-hidden">

  <!-- Mode selector tabs -->
  <div class="border-b border-gray-200 dark:border-dark-border px-6 pt-4">
    <div class="flex gap-1" role="tablist" aria-label="Config editing mode">
      {#each TABS as tab}
        <button
          type="button"
          role="tab"
          aria-selected={configState.mode === tab.id}
          aria-controls={`tab-panel-${tab.id}`}
          id={`tab-${tab.id}`}
          onclick={() => setMode(tab.id)}
          class="relative px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900
            {configState.mode === tab.id
              ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20'
              : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-800'}"
        >
          {tab.label}
          {#if configState.mode === tab.id}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"></span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Tab panels -->
  <div class="p-6">

    {#if configState.mode === 'simple'}
      <div
        id="tab-panel-simple"
        role="tabpanel"
        aria-labelledby="tab-simple"
      >
        {#if configState.loading && !configState.data}
          <!-- Loading skeleton -->
          <div class="space-y-4">
            {#each [1, 2, 3] as _}
              <div class="h-16 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse"></div>
            {/each}
          </div>
        {:else if configState.saveError && !configState.data}
          <!-- Error state -->
          <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center">
            <p class="text-sm text-red-700 dark:text-red-400 font-medium">Failed to load configuration</p>
            <p class="mt-1 text-xs text-red-600 dark:text-red-400">{configState.saveError}</p>
          </div>
        {:else if configState.data}
          <SimpleMode />
        {:else}
          <div class="text-center py-8 text-sm text-gray-400 dark:text-dark-muted">
            Loading configuration...
          </div>
        {/if}
      </div>

    {:else if configState.mode === 'advanced'}
      <div
        id="tab-panel-advanced"
        role="tabpanel"
        aria-labelledby="tab-advanced"
        class="py-8 text-center"
      >
        <p class="text-gray-400 dark:text-dark-muted text-sm">Advanced mode — coming next</p>
      </div>

    {:else if configState.mode === 'raw'}
      <div
        id="tab-panel-raw"
        role="tabpanel"
        aria-labelledby="tab-raw"
        class="py-8 text-center"
      >
        <p class="text-gray-400 dark:text-dark-muted text-sm">Raw YAML — coming next</p>
      </div>
    {/if}

  </div>
</div>
