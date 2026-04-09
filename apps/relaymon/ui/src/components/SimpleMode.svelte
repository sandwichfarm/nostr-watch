<script lang="ts">
  import { configState, saveCurrentConfig } from '../lib/configState.svelte.ts';
  import { validateNpub, validateNsec, validateConfig } from '../lib/validate.ts';
  import SeedingSelector from './SeedingSelector.svelte';
  import RelayUrlList from './RelayUrlList.svelte';

  // --- Derived seeding mode state ---
  const isMyRelays = $derived(
    configState.data?.relaymon.seed.sources.includes('config') ?? false
  );
  const isRelayLists = $derived(
    configState.data?.relaymon.seed.sources.includes('events') ?? false
  );
  const isNetworkScale = $derived(
    configState.data?.relaymon.seed.sources.includes('db') ?? false
  );

  // --- Relay URLs (My Relays mode) ---
  const configUrls = $derived(
    configState.data?.relaymon.seed.options.config ?? []
  );

  function setConfigUrls(urls: string[]): void {
    if (!configState.data) return;
    configState.data.relaymon.seed.options.config = urls;
    configState.dirty = true;
  }

  // --- NIP-65 pubkeys (Relay Lists mode) ---
  let npubInput = $state('');
  let npubError = $state<string | null>(null);

  type EventsOptions = { pubkeys: string[]; relays: string[] };

  function getEventsOpts(): EventsOptions | undefined {
    return (configState.data?.relaymon.seed.options as Record<string, unknown>)?.events as EventsOptions | undefined;
  }

  const eventsPubkeys = $derived(getEventsOpts()?.pubkeys ?? []);
  const eventsRelays = $derived(
    getEventsOpts()?.relays ?? ['wss://relay.nostr.watch', 'wss://relaypag.es', 'wss://purplepag.es']
  );

  function ensureEventsOptions(): void {
    if (!configState.data) return;
    const opts = configState.data.relaymon.seed.options as Record<string, unknown>;
    if (!opts.events || typeof opts.events !== 'object') {
      opts.events = {
        pubkeys: [],
        relays: ['wss://relay.nostr.watch', 'wss://relaypag.es', 'wss://purplepag.es'],
      };
    }
  }

  function addNpub(): void {
    const err = validateNpub(npubInput.trim());
    if (err) {
      npubError = err;
      return;
    }
    if (eventsPubkeys.includes(npubInput.trim())) {
      npubError = 'This npub is already in the list.';
      return;
    }
    ensureEventsOptions();
    const opts = (configState.data!.relaymon.seed.options as Record<string, unknown>).events as EventsOptions;
    opts.pubkeys = [...opts.pubkeys, npubInput.trim()];
    configState.dirty = true;
    npubInput = '';
    npubError = null;
  }

  function removeNpub(idx: number): void {
    ensureEventsOptions();
    const opts = (configState.data!.relaymon.seed.options as Record<string, unknown>).events as EventsOptions;
    opts.pubkeys = opts.pubkeys.filter((_, i) => i !== idx);
    configState.dirty = true;
  }

  function setEventsRelays(relays: string[]): void {
    if (!configState.data) return;
    ensureEventsOptions();
    const opts = (configState.data.relaymon.seed.options as Record<string, unknown>).events as EventsOptions;
    opts.relays = relays;
    configState.dirty = true;
  }

  function onNpubInput(): void {
    if (npubError) npubError = null;
  }

  function onNpubKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNpub();
    }
  }

  // --- Network Scale trawler seed relays ---
  const trawlerRelays = $derived(
    ((configState.data?.relaymon.seed.options as Record<string, unknown>)?.trawlerSeedRelays as string[])
    ?? ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
  );

  function setTrawlerRelays(relays: string[]): void {
    if (!configState.data) return;
    (configState.data.relaymon.seed.options as Record<string, unknown>).trawlerSeedRelays = relays;
    configState.dirty = true;
  }

  // --- nsec field ---
  let nsecVisible = $state(false);
  let nsecError = $state<string | null>(null);

  function onNsecInput(): void {
    if (nsecError) nsecError = null;
    if (configState.nsec) {
      const err = validateNsec(configState.nsec);
      if (!err) nsecError = null;
    }
    configState.dirty = true;
  }

  function onNsecBlur(): void {
    if (configState.nsec) {
      nsecError = validateNsec(configState.nsec);
    } else {
      nsecError = null;
    }
  }

  // --- Networks ---
  const ALL_NETWORKS = [
    { value: 'clearnet', label: 'Clearnet', help: null },
    { value: 'tor', label: 'Tor', help: 'Requires a transparent proxy for Tor' },
    { value: 'i2p', label: 'I2P', help: 'Requires a transparent proxy for I2P' },
  ] as const;

  function isNetworkEnabled(net: string): boolean {
    return configState.data?.relaymon.networks.includes(net as 'clearnet' | 'tor' | 'i2p' | 'lokinet') ?? false;
  }

  function toggleNetwork(net: string): void {
    if (!configState.data) return;
    const networks = configState.data.relaymon.networks;
    const idx = networks.indexOf(net as 'clearnet' | 'tor' | 'i2p' | 'lokinet');
    if (idx === -1) {
      configState.data.relaymon.networks = [...networks, net as 'clearnet' | 'tor' | 'i2p' | 'lokinet'];
    } else {
      // Don't remove clearnet if it's the last network
      if (networks.length <= 1) return;
      configState.data.relaymon.networks = networks.filter(n => n !== net);
    }
    configState.dirty = true;
  }

  // --- Publisher relays ---
  const publisherRelays = $derived(configState.data?.publisher.relays ?? []);

  function setPublisherRelays(relays: string[]): void {
    if (!configState.data) return;
    configState.data.publisher.relays = relays;
    configState.dirty = true;
  }

  // --- Save ---
  let saving = $state(false);
  let formErrors = $state<string[]>([]);

  async function handleSave(): Promise<void> {
    if (!configState.data) return;
    // Validate nsec if provided
    if (configState.nsec) {
      const nsecErr = validateNsec(configState.nsec);
      if (nsecErr) {
        nsecError = nsecErr;
        return;
      }
    }
    // Validate config
    const errors = validateConfig(configState.data);
    if (errors.length > 0) {
      formErrors = errors;
      return;
    }
    formErrors = [];
    saving = true;
    try {
      await saveCurrentConfig();
    } finally {
      saving = false;
    }
  }

  // --- Reactive initialization ---
  $effect(() => {
    if (configState.data) {
      // Ensure seed options structure is initialized
      if (!configState.data.relaymon.seed.options) {
        configState.data.relaymon.seed.options = {};
      }
      // Ensure networks array exists
      if (!Array.isArray(configState.data.relaymon.networks)) {
        configState.data.relaymon.networks = ['clearnet'];
      }
    }
  });
</script>

<div class="space-y-8">

  <!-- Section: Seeding Mode -->
  <section aria-labelledby="seeding-mode-heading">
    <h2 id="seeding-mode-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-3">
      Seeding Mode
    </h2>
    {#if configState.data}
      <SeedingSelector />
    {:else}
      <div class="h-24 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse"></div>
    {/if}
  </section>

  <!-- Section: Relay URLs (My Relays) -->
  {#if isMyRelays && configState.data}
    <section aria-labelledby="my-relays-heading" class="rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-5">
      <h2 id="my-relays-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-3">
        Relays to Monitor
      </h2>
      <RelayUrlList
        urls={configUrls}
        label="Relay URLs"
        placeholder="wss://relay.example.com"
        onchange={setConfigUrls}
      />
    </section>
  {/if}

  <!-- Section: NIP-65 Pubkeys (Relay Lists) -->
  {#if isRelayLists && configState.data}
    <section aria-labelledby="relay-lists-heading" class="rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-5 space-y-5">
      <div>
        <h2 id="relay-lists-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-1">
          NIP-65 Relay Lists
        </h2>
        <p class="text-xs text-gray-500 dark:text-dark-muted mb-3">
          Monitor the relays listed in someone's NIP-65 relay list by entering their npub.
        </p>

        <!-- npub input -->
        <label for="npub-input" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
          npub keys to follow
        </label>
        <div class="flex gap-2">
          <input
            id="npub-input"
            type="text"
            bind:value={npubInput}
            onkeydown={onNpubKeyDown}
            oninput={onNpubInput}
            placeholder="npub1..."
            autocomplete="off"
            spellcheck="false"
            aria-describedby={npubError ? 'npub-error' : undefined}
            aria-invalid={!!npubError}
            class="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors
              {npubError
                ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400'
                : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
              placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2"
          />
          <button
            type="button"
            onclick={addNpub}
            disabled={!npubInput.trim() || !!validateNpub(npubInput.trim())}
            class="rounded-lg px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700
              disabled:opacity-40 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
          >
            Add
          </button>
        </div>
        {#if npubError}
          <p id="npub-error" role="alert" class="mt-1 text-xs text-red-600 dark:text-red-400">{npubError}</p>
        {/if}

        <!-- npub pills -->
        {#if eventsPubkeys.length > 0}
          <ul class="mt-2 flex flex-wrap gap-2" aria-label="npub keys list">
            {#each eventsPubkeys as pubkey, idx (pubkey)}
              <li class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-dark-text max-w-full">
                <span class="truncate max-w-[220px] font-mono" title={pubkey}>{pubkey}</span>
                <button
                  type="button"
                  onclick={() => removeNpub(idx)}
                  aria-label="Remove {pubkey}"
                  class="flex-shrink-0 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="mt-2 text-xs text-gray-400 dark:text-slate-500 italic">No npub keys added yet.</p>
        {/if}
      </div>

      <!-- Relays to fetch lists from -->
      <div>
        <RelayUrlList
          urls={eventsRelays}
          label="Relays to fetch lists from"
          placeholder="wss://relay.nostr.watch"
          minItems={1}
          onchange={setEventsRelays}
        />
        <p class="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
          These relays are queried to fetch NIP-65 relay lists for the npubs above.
        </p>
      </div>
    </section>
  {/if}

  <!-- Section: Network Scale -->
  {#if isNetworkScale && configState.data}
    <section aria-labelledby="network-scale-heading" class="rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-5 space-y-4">
      <div>
        <h2 id="network-scale-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-1">
          Network Scale
        </h2>
        <p class="text-sm text-gray-500 dark:text-dark-muted">
          Trawler will discover relays from the network. Database path is configured automatically.
        </p>
      </div>

      <RelayUrlList
        urls={trawlerRelays}
        label="Trawler seed relays"
        placeholder="wss://relay.damus.io"
        minItems={3}
        onchange={setTrawlerRelays}
      />
    </section>
  {/if}

  <!-- Section: Signing Key -->
  <section aria-labelledby="signing-key-heading" class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-5">
    <h2 id="signing-key-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-1">
      Signing Key
    </h2>
    <p class="text-xs text-gray-500 dark:text-dark-muted mb-3">
      Your nsec is used to sign monitoring events. It is stored in the config file on your server.
    </p>

    <div>
      <label for="nsec-input" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
        nsec (signing key)
      </label>
      <div class="relative flex items-center">
        {#if nsecVisible}
          <input
            id="nsec-input"
            type="text"
            bind:value={configState.nsec}
            oninput={onNsecInput}
            onblur={onNsecBlur}
            placeholder="nsec1..."
            autocomplete="off"
            spellcheck="false"
            aria-describedby={nsecError ? 'nsec-error' : 'nsec-help'}
            aria-invalid={!!nsecError}
            class="w-full rounded-lg border pr-10 px-3 py-2 text-sm font-mono transition-colors
              {nsecError
                ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400'
                : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
              placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2"
          />
        {:else}
          <input
            id="nsec-input"
            type="password"
            bind:value={configState.nsec}
            oninput={onNsecInput}
            onblur={onNsecBlur}
            placeholder="nsec1..."
            autocomplete="new-password"
            aria-describedby={nsecError ? 'nsec-error' : 'nsec-help'}
            aria-invalid={!!nsecError}
            class="w-full rounded-lg border pr-10 px-3 py-2 text-sm font-mono transition-colors
              {nsecError
                ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400'
                : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
              placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2"
          />
        {/if}
        <!-- Show/hide toggle -->
        <button
          type="button"
          onclick={() => { nsecVisible = !nsecVisible; }}
          class="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
          aria-label={nsecVisible ? 'Hide signing key' : 'Show signing key'}
        >
          {#if nsecVisible}
            <!-- Eye-off icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          {:else}
            <!-- Eye icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          {/if}
        </button>
      </div>
      {#if nsecError}
        <p id="nsec-error" role="alert" class="mt-1 text-xs text-red-600 dark:text-red-400">{nsecError}</p>
      {:else}
        <p id="nsec-help" class="mt-1 text-xs text-gray-400 dark:text-slate-500">
          Leave blank if using the <code class="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">RELAYMON_NSEC</code> environment variable.
        </p>
      {/if}
    </div>
  </section>

  <!-- Section: Monitor Identity -->
  <section aria-labelledby="monitor-identity-heading" class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-5 space-y-4">
    <h2 id="monitor-identity-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text">
      Monitor Identity
    </h2>

    <div>
      <label for="monitor-name" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
        Monitor Name
      </label>
      <input
        id="monitor-name"
        type="text"
        bind:value={configState.data!.monitor.info.name}
        oninput={() => { configState.dirty = true; }}
        placeholder="My Relay Monitor"
        class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
          bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
          focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
      />
    </div>

    <div>
      <label for="monitor-description" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
        Description
      </label>
      <input
        id="monitor-description"
        type="text"
        bind:value={configState.data!.monitor.info.about}
        oninput={() => { configState.dirty = true; }}
        placeholder="Monitoring Nostr relays since 2024"
        class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
          bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
          focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
      />
    </div>

    <div>
      <label for="monitor-slug" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
        Monitor Slug
      </label>
      <input
        id="monitor-slug"
        type="text"
        bind:value={configState.data!.monitor.slug}
        oninput={() => { configState.dirty = true; }}
        placeholder="my-monitor"
        pattern="[a-z0-9-]+"
        class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
          bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
          focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
      />
      <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">Used as a unique identifier. Use lowercase letters, numbers, and hyphens.</p>
    </div>
  </section>

  <!-- Section: Publisher Relays -->
  <section aria-labelledby="publisher-relays-heading" class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-5">
    <h2 id="publisher-relays-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-1">
      Publisher Relays
    </h2>
    <p class="text-xs text-gray-500 dark:text-dark-muted mb-3">
      Relays where monitoring results are published
    </p>
    <RelayUrlList
      urls={publisherRelays}
      label="Publisher Relays"
      placeholder="wss://relay.nostr.watch"
      minItems={1}
      onchange={setPublisherRelays}
    />
  </section>

  <!-- Section: Network Modes -->
  <section aria-labelledby="network-modes-heading" class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card p-5">
    <h2 id="network-modes-heading" class="text-base font-semibold text-gray-800 dark:text-dark-text mb-3">
      Network Modes
    </h2>

    <div class="space-y-3">
      {#each ALL_NETWORKS as net}
        <label class="flex items-start gap-3 cursor-pointer">
          <div class="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={isNetworkEnabled(net.value)}
              onchange={() => toggleNetwork(net.value)}
              disabled={net.value === 'clearnet' && (configState.data?.relaymon.networks.length ?? 1) <= 1}
              class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <span class="text-sm font-medium text-gray-700 dark:text-dark-text capitalize">{net.label}</span>
            {#if net.help}
              <p class="text-xs text-gray-400 dark:text-slate-500">{net.help}</p>
            {/if}
          </div>
        </label>
      {/each}
    </div>
  </section>

  <!-- Validation errors -->
  {#if formErrors.length > 0}
    <div role="alert" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Please fix the following errors before saving:</p>
      <ul class="list-disc list-inside space-y-1">
        {#each formErrors as err}
          <li class="text-xs text-red-600 dark:text-red-400">{err}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- configState save error -->
  {#if configState.saveError}
    <div role="alert" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-400">
        <strong>Save failed:</strong> {configState.saveError}
      </p>
    </div>
  {/if}

  <!-- Save button -->
  <div class="sticky bottom-0 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm border-t border-gray-200 dark:border-dark-border -mx-6 px-6 py-4 flex items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      {#if configState.saveSuccess}
        <span role="status" class="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Saved successfully
        </span>
      {/if}
      {#if configState.dirty && !configState.saveSuccess}
        <span class="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
      {/if}
    </div>

    <button
      type="button"
      onclick={handleSave}
      disabled={saving || configState.loading || !configState.dirty}
      class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold
        bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800
        disabled:opacity-40 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
    >
      {#if saving || configState.loading}
        <!-- Loading spinner -->
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
      {:else}
        Save Configuration
      {/if}
    </button>
  </div>

</div>
