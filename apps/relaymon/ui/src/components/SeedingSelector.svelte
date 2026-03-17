<script lang="ts">
  import { configState } from '../lib/configState.svelte.ts';

  // --- Derived active state ---
  function isActive(source: string): boolean {
    return configState.data?.relaymon.seed.sources.includes(source) ?? false;
  }

  function toggle(source: string): void {
    if (!configState.data) return;

    const sources = configState.data.relaymon.seed.sources;
    const options = configState.data.relaymon.seed.options;

    if (source === 'db') {
      // Network Scale is mutually exclusive — deactivate config + events
      const newSources = sources.filter(s => s !== 'config' && s !== 'events');
      if (!newSources.includes('db')) {
        newSources.push('db');
      }
      if (!options.db) {
        options.db = { path: '/opt/data/trawler.db' };
      }
      configState.data.relaymon.seed.sources = newSources;
    } else {
      // My Relays (config) or Relay Lists (events)
      // Deactivate Network Scale if it was active
      const newSources = sources.filter(s => s !== 'db');

      const idx = newSources.indexOf(source);
      if (idx === -1) {
        // Activate
        newSources.push(source);
        // Initialize options if needed
        if (source === 'config' && !options.config) {
          options.config = [];
        }
        if (source === 'events') {
          if (!options.events) {
            (options as Record<string, unknown>).events = {
              pubkeys: [],
              relays: ['wss://relay.nostr.watch', 'wss://relaypag.es', 'wss://purplepag.es'],
            };
          }
        }
      } else {
        // Deactivate — remove from sources but keep options
        newSources.splice(idx, 1);
      }

      configState.data.relaymon.seed.sources = newSources;
    }

    configState.dirty = true;
  }

  $effect(() => {
    // Ensure sources array is initialized
    if (configState.data && !Array.isArray(configState.data.relaymon.seed.sources)) {
      configState.data.relaymon.seed.sources = [];
    }
  });
</script>

<div class="space-y-3">
  <p class="text-sm font-medium text-gray-700 dark:text-dark-text">
    What do you want to monitor?
  </p>
  <p class="text-xs text-gray-500 dark:text-dark-muted mb-3">
    Select one or more seeding modes. My Relays and Relay Lists can be combined.
  </p>

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">

    <!-- My Relays card -->
    <button
      type="button"
      onclick={() => toggle('config')}
      class="relative text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        {isActive('config')
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-primary-300 dark:hover:border-primary-700'}
        {isActive('db') ? 'opacity-50' : ''}"
      aria-pressed={isActive('config')}
    >
      <div class="flex items-start gap-3">
        <!-- Server/antenna icon -->
        <span class="flex-shrink-0 mt-0.5">
          <svg class="w-6 h-6 {isActive('config') ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-dark-muted'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        </span>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold {isActive('config') ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-dark-text'}">
              My Relays
            </span>
            {#if isActive('config')}
              <span class="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-800/40 px-1.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                Active
              </span>
            {/if}
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-dark-muted">
            Monitor specific relays
          </p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
            Enter relay URLs you want to monitor
          </p>
        </div>
      </div>
    </button>

    <!-- Relay Lists card -->
    <button
      type="button"
      onclick={() => toggle('events')}
      class="relative text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        {isActive('events')
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card hover:border-primary-300 dark:hover:border-primary-700'}
        {isActive('db') ? 'opacity-50' : ''}"
      aria-pressed={isActive('events')}
    >
      <div class="flex items-start gap-3">
        <!-- List/users icon -->
        <span class="flex-shrink-0 mt-0.5">
          <svg class="w-6 h-6 {isActive('events') ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-dark-muted'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </span>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold {isActive('events') ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-dark-text'}">
              Relay Lists
            </span>
            {#if isActive('events')}
              <span class="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-800/40 px-1.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                Active
              </span>
            {/if}
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-dark-muted">
            Follow someone's relay list
          </p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
            Enter an npub to monitor their NIP-65 relay list
          </p>
        </div>
      </div>
    </button>

    <!-- Network Scale card (power mode — violet accent) -->
    <button
      type="button"
      onclick={() => toggle('db')}
      class="relative text-left rounded-xl border-2 p-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        {isActive('db')
          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-400'
          : 'border-primary-200 dark:border-primary-900 bg-primary-50/30 dark:bg-primary-900/10 hover:border-primary-400 dark:hover:border-primary-700'}
        {(isActive('config') || isActive('events')) && !isActive('db') ? 'opacity-50' : ''}"
      aria-pressed={isActive('db')}
    >
      <div class="flex items-start gap-3">
        <!-- Globe/network icon -->
        <span class="flex-shrink-0 mt-0.5">
          <svg class="w-6 h-6 {isActive('db') ? 'text-primary-600 dark:text-primary-400' : 'text-primary-400 dark:text-primary-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold {isActive('db') ? 'text-primary-700 dark:text-primary-300' : 'text-primary-600 dark:text-primary-400'}">
              Network Scale
            </span>
            {#if isActive('db')}
              <span class="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-800/40 px-1.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                Active
              </span>
            {/if}
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-dark-muted">
            Discover all relays
          </p>
          <p class="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
            Crawl the entire Nostr network using trawler
          </p>
        </div>
      </div>
      <!-- Power mode indicator stripe -->
      <div class="absolute top-0 right-0 h-1 w-16 rounded-tr-xl bg-gradient-to-r from-primary-400 to-primary-600 opacity-60"></div>
    </button>

  </div>
</div>
