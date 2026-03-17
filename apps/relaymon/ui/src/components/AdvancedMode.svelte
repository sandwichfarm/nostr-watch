<script lang="ts">
  import { configState, saveCurrentConfig } from '../lib/configState.svelte.ts';
  import { validateNsec, validateConfig } from '../lib/validate.ts';
  import SeedingSelector from './SeedingSelector.svelte';
  import RelayUrlList from './RelayUrlList.svelte';
  import type { NetworkType, RetryExpiryConfig } from '../lib/types.ts';

  // ---- Timestring validation ----
  const TIMESTRING_RE = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;

  function validateTimestring(val: string): string | null {
    if (!val || val.trim() === '') return null; // optional
    if (!TIMESTRING_RE.test(val.trim())) {
      return 'Expected a timestring like 30s, 5m, 1h, 1d, or 500ms';
    }
    return null;
  }

  // ---- Seeding: derived config URL options ----
  const configUrls = $derived(
    (configState.data?.relaymon.seed.options?.config as string[] | undefined) ?? []
  );

  function setConfigUrls(urls: string[]): void {
    if (!configState.data) return;
    configState.data.relaymon.seed.options.config = urls;
    configState.dirty = true;
  }

  // ---- Seeding: NIP-65 (events) options ----
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

  let npubInput = $state('');

  function addNpub(): void {
    const trimmed = npubInput.trim();
    if (!trimmed) return;
    if (eventsPubkeys.includes(trimmed)) {
      npubInput = '';
      return;
    }
    ensureEventsOptions();
    const opts = (configState.data!.relaymon.seed.options as Record<string, unknown>).events as EventsOptions;
    opts.pubkeys = [...opts.pubkeys, trimmed];
    configState.dirty = true;
    npubInput = '';
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

  // ---- Seeding: network scale trawler relays ----
  const trawlerRelays = $derived(
    ((configState.data?.relaymon.seed.options as Record<string, unknown>)?.trawlerSeedRelays as string[])
    ?? ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
  );

  function setTrawlerRelays(relays: string[]): void {
    if (!configState.data) return;
    (configState.data.relaymon.seed.options as Record<string, unknown>).trawlerSeedRelays = relays;
    configState.dirty = true;
  }

  // Seed interval display
  let seedIntervalStr = $state('');

  $effect(() => {
    if (configState.data) {
      const ms = configState.data.relaymon.seed.interval;
      // Convert ms to a timestring for display
      if (ms && !seedIntervalStr) {
        seedIntervalStr = String(ms);
      }
    }
  });

  function onSeedIntervalInput(val: string): void {
    seedIntervalStr = val;
    const err = validateTimestring(val);
    if (!err && configState.data) {
      // Accept raw timestring — stored as string in advanced mode
      // Cast through unknown to bypass strict SeedConfig type check (interval accepts string in advanced mode)
      (configState.data.relaymon.seed as unknown as Record<string, unknown>).interval = val.trim() || configState.data.relaymon.seed.interval;
      configState.dirty = true;
    }
  }

  // ---- Monitor Identity ----
  function ensureGeo(): void {
    if (!configState.data) return;
    if (!configState.data.monitor.geo) {
      configState.data.monitor.geo = {
        city: '', country: '', countryCode: '', lat: 0, lon: 0, region: '', continent: ''
      };
    }
  }

  // ---- Publisher retry ----
  function ensurePublisherRetry(): void {
    if (!configState.data) return;
    if (!configState.data.publisher.retry) {
      configState.data.publisher.retry = {};
    }
  }

  // ---- Announce ----
  let announceFrequencyStr = $state('');

  $effect(() => {
    if (configState.data?.announce?.frequency !== undefined && !announceFrequencyStr) {
      announceFrequencyStr = String(configState.data.announce.frequency);
    }
  });

  function onAnnounceFrequencyInput(val: string): void {
    announceFrequencyStr = val;
    if (configState.data) {
      (configState.data.announce as Record<string, unknown>).frequency = val;
      configState.dirty = true;
    }
  }

  const announceUserMetaRelays = $derived(configState.data?.announce?.userMetaRelays ?? []);
  const announceNip66Relays = $derived(configState.data?.announce?.nip66Relays ?? []);

  function setAnnounceUserMetaRelays(relays: string[]): void {
    if (!configState.data) return;
    configState.data.announce.userMetaRelays = relays;
    configState.dirty = true;
  }

  function setAnnounceNip66Relays(relays: string[]): void {
    if (!configState.data) return;
    configState.data.announce.nip66Relays = relays;
    configState.dirty = true;
  }

  // ---- Checks ----
  const CHECK_TYPES = ['open', 'read', 'write', 'info', 'dns', 'geo', 'ssl'];

  function isCheckEnabled(check: string): boolean {
    return configState.data?.relaymon.checks.enabled.includes(check) ?? false;
  }

  function toggleCheck(check: string): void {
    if (!configState.data) return;
    const enabled = configState.data.relaymon.checks.enabled;
    const idx = enabled.indexOf(check);
    if (idx === -1) {
      configState.data.relaymon.checks.enabled = [...enabled, check];
    } else {
      configState.data.relaymon.checks.enabled = enabled.filter(c => c !== check);
    }
    configState.dirty = true;
  }

  let checksExpiresStr = $state('');
  let checksIntervalStr = $state('');

  $effect(() => {
    if (configState.data?.relaymon.checks.options) {
      if (!checksExpiresStr) checksExpiresStr = String(configState.data.relaymon.checks.options.expires ?? '');
      if (!checksIntervalStr) checksIntervalStr = String(configState.data.relaymon.checks.options.interval ?? '');
    }
  });

  // ---- Retry expiry tiers ----
  const retryTiers = $derived(configState.data?.relaymon.retry.expiry ?? []);

  function addRetryTier(): void {
    if (!configState.data) return;
    configState.data.relaymon.retry.expiry = [...retryTiers, { max: 1, delay: 60000 }];
    configState.dirty = true;
  }

  function removeRetryTier(idx: number): void {
    if (!configState.data) return;
    configState.data.relaymon.retry.expiry = retryTiers.filter((_, i) => i !== idx);
    configState.dirty = true;
  }

  function updateRetryTier(idx: number, field: keyof RetryExpiryConfig, value: number): void {
    if (!configState.data) return;
    const tiers = [...retryTiers];
    tiers[idx] = { ...tiers[idx], [field]: value };
    configState.data.relaymon.retry.expiry = tiers;
    configState.dirty = true;
  }

  // ---- Networks ----
  const ALL_NETWORKS: { value: NetworkType; label: string; help?: string }[] = [
    { value: 'clearnet', label: 'Clearnet' },
    { value: 'tor', label: 'Tor', help: 'Requires a transparent proxy for Tor' },
    { value: 'i2p', label: 'I2P', help: 'Requires a transparent proxy for I2P' },
    { value: 'lokinet', label: 'Lokinet', help: 'Requires a transparent proxy for Lokinet' },
  ];

  function isNetworkEnabled(net: string): boolean {
    return configState.data?.relaymon.networks.includes(net as NetworkType) ?? false;
  }

  function toggleNetwork(net: string): void {
    if (!configState.data) return;
    const networks = configState.data.relaymon.networks;
    const idx = networks.indexOf(net as NetworkType);
    if (idx === -1) {
      configState.data.relaymon.networks = [...networks, net as NetworkType];
    } else {
      if (networks.length <= 1) return;
      configState.data.relaymon.networks = networks.filter(n => n !== net);
    }
    configState.dirty = true;
  }

  // ---- Database ----
  function ensureDb(): void {
    if (!configState.data) return;
    if (!configState.data.db) {
      configState.data.db = { path: '/opt/data/relaymon.db', enableWAL: true };
    }
  }

  // ---- Queue ----
  function ensureQueue(): void {
    if (!configState.data) return;
    if (!configState.data.queue) {
      configState.data.queue = { workerConcurrency: 'auto' };
    }
  }

  const queueConcurrencyStr = $derived(
    configState.data?.queue?.workerConcurrency !== undefined
      ? String(configState.data.queue.workerConcurrency)
      : 'auto'
  );

  function onQueueConcurrencyInput(val: string): void {
    if (!configState.data) return;
    ensureQueue();
    const n = parseInt(val, 10);
    configState.data.queue!.workerConcurrency = isNaN(n) ? 'auto' : n;
    configState.dirty = true;
  }

  // ---- Ignore List ----
  function ensureIgnorelist(): void {
    if (!configState.data) return;
    if (!configState.data.relaymon.ignorelist) {
      configState.data.relaymon.ignorelist = {
        enabled: false,
        interval: '1h',
        deletion_interval: '24h',
        relays: [],
        pubkeys: [],
      };
    }
  }

  const ignorelistRelays = $derived(configState.data?.relaymon.ignorelist?.relays ?? []);
  const ignorelistPubkeys = $derived(configState.data?.relaymon.ignorelist?.pubkeys ?? []);

  function setIgnorelistRelays(relays: string[]): void {
    if (!configState.data) return;
    ensureIgnorelist();
    configState.data.relaymon.ignorelist!.relays = relays;
    configState.dirty = true;
  }

  let ignorePubkeyInput = $state('');

  function addIgnorePubkey(): void {
    const trimmed = ignorePubkeyInput.trim();
    if (!trimmed) return;
    ensureIgnorelist();
    if (!ignorelistPubkeys.includes(trimmed)) {
      configState.data!.relaymon.ignorelist!.pubkeys = [...ignorelistPubkeys, trimmed];
      configState.dirty = true;
    }
    ignorePubkeyInput = '';
  }

  function removeIgnorePubkey(idx: number): void {
    if (!configState.data?.relaymon.ignorelist) return;
    configState.data.relaymon.ignorelist.pubkeys = ignorelistPubkeys.filter((_, i) => i !== idx);
    configState.dirty = true;
  }

  // ---- Delta Events ----
  function ensureDelta(): void {
    if (!configState.data) return;
    if (!configState.data.relaymon.delta) {
      configState.data.relaymon.delta = {
        enabled: false,
        max_retries: 3,
        periods: { enabled: false, definitions: [] },
      };
    }
  }

  // ---- Health ----
  function ensureHealth(): void {
    if (!configState.data) return;
    if (!configState.data.health) {
      configState.data.health = {
        enabled: false,
        server: { enabled: false, host: '0.0.0.0', port: 8080, authEnabled: false },
        kuma: { enabled: false, intervalMs: '30s', degradedAsUp: false, startupGraceMs: '2m', msgVerbosity: 'summary' },
        thresholds: { checkIdleMs: '5m', publishBacklogMax: 100, errorRatePerMin: 10, startupGraceMs: '2m' },
      };
    }
  }

  // ---- Signing Key ----
  let nsecVisible = $state(false);
  let nsecError = $state<string | null>(null);

  function onNsecInput(): void {
    if (nsecError) nsecError = null;
    configState.dirty = true;
  }

  function onNsecBlur(): void {
    if (configState.nsec) {
      nsecError = validateNsec(configState.nsec);
    } else {
      nsecError = null;
    }
  }

  // ---- Publisher relays ----
  const publisherRelays = $derived(configState.data?.publisher.relays ?? []);

  function setPublisherRelays(relays: string[]): void {
    if (!configState.data) return;
    configState.data.publisher.relays = relays;
    configState.dirty = true;
  }

  // ---- Save ----
  let saving = $state(false);
  let formErrors = $state<string[]>([]);

  async function handleSave(): Promise<void> {
    if (!configState.data) return;
    if (configState.nsec) {
      const nsecErr = validateNsec(configState.nsec);
      if (nsecErr) {
        nsecError = nsecErr;
        return;
      }
    }
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

  // ---- Section open/closed state ----
  let openSections = $state<Record<string, boolean>>({
    seeding: true,
    identity: false,
    publisher: false,
    announce: false,
    checks: false,
    retry: false,
    networks: false,
    database: false,
    queue: false,
    logLevel: false,
    ignorelist: false,
    delta: false,
    health: false,
    signing: false,
  });

  function toggleSection(key: string): void {
    openSections[key] = !openSections[key];
  }
</script>

<div class="space-y-0">

  <!-- Section macro: each section is a <details>-like accordion -->

  <!-- 1. Seeding -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('seeding')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.seeding}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Seeding</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.seeding ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.seeding}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-5 border-t border-gray-100 dark:border-slate-700">
        {#if configState.data}
          <SeedingSelector />

          <!-- Seed interval -->
          <div>
            <label for="adv-seed-interval" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
              Seed Interval
            </label>
            <input
              id="adv-seed-interval"
              type="text"
              value={seedIntervalStr || String(configState.data.relaymon.seed.interval)}
              oninput={(e) => onSeedIntervalInput((e.target as HTMLInputElement).value)}
              placeholder="60s"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
            />
            <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">How often to re-seed relay list. Timestring: 30s, 5m, 1h, 1d.</p>
          </div>

          <!-- My Relays options (when config source active) -->
          {#if configState.data.relaymon.seed.sources.includes('config')}
            <div class="rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-4 space-y-3">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">My Relays URLs</h3>
              <RelayUrlList
                urls={configUrls}
                label="Relay URLs"
                placeholder="wss://relay.example.com"
                onchange={setConfigUrls}
              />
            </div>
          {/if}

          <!-- NIP-65 pubkeys (when events source active) -->
          {#if configState.data.relaymon.seed.sources.includes('events')}
            <div class="rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-4 space-y-4">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">NIP-65 Relay Lists</h3>
              <div>
                <label for="adv-npub-input" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">npub keys to follow</label>
                <div class="flex gap-2">
                  <input
                    id="adv-npub-input"
                    type="text"
                    bind:value={npubInput}
                    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNpub(); } }}
                    placeholder="npub1..."
                    autocomplete="off"
                    spellcheck="false"
                    class="flex-1 rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                      bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                      focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
                  />
                  <button type="button" onclick={addNpub} disabled={!npubInput.trim()}
                    class="rounded-lg px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
                    Add
                  </button>
                </div>
                {#if eventsPubkeys.length > 0}
                  <ul class="mt-2 flex flex-wrap gap-2">
                    {#each eventsPubkeys as pk, idx (pk)}
                      <li class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-dark-text">
                        <span class="truncate max-w-[200px] font-mono" title={pk}>{pk}</span>
                        <button type="button" onclick={() => removeNpub(idx)} aria-label="Remove {pk}"
                          class="rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
              <RelayUrlList
                urls={eventsRelays}
                label="Relays to fetch lists from"
                placeholder="wss://relay.nostr.watch"
                minItems={1}
                onchange={setEventsRelays}
              />
            </div>
          {/if}

          <!-- Network Scale (when db source active) -->
          {#if configState.data.relaymon.seed.sources.includes('db')}
            <div class="rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10 p-4 space-y-3">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">Network Scale — Trawler DB</h3>
              <div>
                <label for="adv-trawler-db-path" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Trawler DB Path</label>
                <input
                  id="adv-trawler-db-path"
                  type="text"
                  bind:value={(configState.data.relaymon.seed.options as Record<string, unknown> & { db?: { path: string } }).db!.path}
                  oninput={() => { configState.dirty = true; }}
                  placeholder="/opt/data/trawler.db"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors"
                />
              </div>
              <RelayUrlList
                urls={trawlerRelays}
                label="Trawler seed relays"
                placeholder="wss://relay.damus.io"
                minItems={3}
                onchange={setTrawlerRelays}
              />
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  <!-- 2. Monitor Identity -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('identity')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.identity}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Monitor Identity</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.identity ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.identity && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        <!-- Basic fields -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="adv-monitor-slug" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Slug</label>
            <input id="adv-monitor-slug" type="text" bind:value={configState.data.monitor.slug}
              oninput={() => { configState.dirty = true; }} placeholder="my-monitor" pattern="[a-z0-9-]+"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-monitor-name" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Name</label>
            <input id="adv-monitor-name" type="text" bind:value={configState.data.monitor.info.name}
              oninput={() => { configState.dirty = true; }} placeholder="My Relay Monitor"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
        </div>
        <div>
          <label for="adv-monitor-about" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">About</label>
          <input id="adv-monitor-about" type="text" bind:value={configState.data.monitor.info.about}
            oninput={() => { configState.dirty = true; }} placeholder="Monitoring Nostr relays"
            class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
        </div>
        <!-- Extended fields -->
        <div>
          <label for="adv-monitor-owner" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Owner pubkey (hex or npub)</label>
          <input id="adv-monitor-owner" type="text" bind:value={configState.data.monitor.owner}
            oninput={() => { configState.dirty = true; }} placeholder="npub1... or hex pubkey"
            autocomplete="off" spellcheck="false"
            class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="adv-monitor-nip05" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">NIP-05</label>
            <input id="adv-monitor-nip05" type="text" bind:value={configState.data.monitor.info.nip05}
              oninput={() => { configState.dirty = true; }} placeholder="user@domain.com"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-monitor-lud16" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Lightning Address (lud16)</label>
            <input id="adv-monitor-lud16" type="text" bind:value={configState.data.monitor.info.lud16}
              oninput={() => { configState.dirty = true; }} placeholder="user@wallet.com"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="adv-monitor-picture" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Picture URL</label>
            <input id="adv-monitor-picture" type="url" bind:value={configState.data.monitor.info.picture}
              oninput={() => { configState.dirty = true; }} placeholder="https://example.com/avatar.png"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-monitor-banner" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Banner URL</label>
            <input id="adv-monitor-banner" type="url" bind:value={configState.data.monitor.info.banner}
              oninput={() => { configState.dirty = true; }} placeholder="https://example.com/banner.png"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
        </div>
        <!-- Geo section -->
        <div class="rounded-lg border border-gray-100 dark:border-slate-700 p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">Geographic Location (optional)</h3>
            {#if !configState.data.monitor.geo}
              <button type="button" onclick={ensureGeo}
                class="text-xs text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">
                + Add geo
              </button>
            {/if}
          </div>
          {#if configState.data.monitor.geo}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label for="adv-geo-city" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">City</label>
                <input id="adv-geo-city" type="text" bind:value={configState.data.monitor.geo.city}
                  oninput={() => { configState.dirty = true; }} placeholder="San Francisco"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-geo-country" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Country</label>
                <input id="adv-geo-country" type="text" bind:value={configState.data.monitor.geo.country}
                  oninput={() => { configState.dirty = true; }} placeholder="United States"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-geo-countrycode" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Country Code</label>
                <input id="adv-geo-countrycode" type="text" bind:value={configState.data.monitor.geo.countryCode}
                  oninput={() => { configState.dirty = true; }} placeholder="US" maxlength="3"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-geo-lat" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Latitude</label>
                <input id="adv-geo-lat" type="number" step="any" bind:value={configState.data.monitor.geo.lat}
                  oninput={() => { configState.dirty = true; }} placeholder="37.7749"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-geo-lon" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Longitude</label>
                <input id="adv-geo-lon" type="number" step="any" bind:value={configState.data.monitor.geo.lon}
                  oninput={() => { configState.dirty = true; }} placeholder="-122.4194"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-geo-region" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Region</label>
                <input id="adv-geo-region" type="text" bind:value={configState.data.monitor.geo.region}
                  oninput={() => { configState.dirty = true; }} placeholder="California"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div class="sm:col-span-2">
                <label for="adv-geo-continent" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Continent</label>
                <input id="adv-geo-continent" type="text" bind:value={configState.data.monitor.geo.continent}
                  oninput={() => { configState.dirty = true; }} placeholder="North America"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- 3. Publisher -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('publisher')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.publisher}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Publisher</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.publisher ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.publisher && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        <RelayUrlList
          urls={publisherRelays}
          label="Publisher Relays"
          placeholder="wss://relay.nostr.watch"
          minItems={1}
          onchange={setPublisherRelays}
        />
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="adv-pub-maxretries" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Max Retries</label>
            <input id="adv-pub-maxretries" type="number" min="0" step="1"
              value={configState.data.publisher.retry?.maxRetries ?? ''}
              oninput={(e) => {
                if (!configState.data) return;
                ensurePublisherRetry();
                configState.data.publisher.retry!.maxRetries = parseInt((e.target as HTMLInputElement).value, 10) || undefined;
                configState.dirty = true;
              }}
              placeholder="3"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-pub-backoff" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Initial Backoff (ms)</label>
            <input id="adv-pub-backoff" type="number" min="0" step="100"
              value={configState.data.publisher.retry?.initialBackoffMs ?? ''}
              oninput={(e) => {
                if (!configState.data) return;
                ensurePublisherRetry();
                configState.data.publisher.retry!.initialBackoffMs = parseInt((e.target as HTMLInputElement).value, 10) || undefined;
                configState.dirty = true;
              }}
              placeholder="1000"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- 4. Announce -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('announce')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.announce}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Announce</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.announce ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.announce && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        <div>
          <label for="adv-announce-frequency" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Frequency</label>
          <input id="adv-announce-frequency" type="text"
            value={announceFrequencyStr || String(configState.data.announce.frequency ?? '')}
            oninput={(e) => onAnnounceFrequencyInput((e.target as HTMLInputElement).value)}
            placeholder="1h"
            class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">How often to re-announce. Timestring: 30s, 5m, 1h.</p>
        </div>
        <RelayUrlList
          urls={announceUserMetaRelays}
          label="User Meta Relays"
          placeholder="wss://relay.nostr.watch"
          onchange={setAnnounceUserMetaRelays}
        />
        <RelayUrlList
          urls={announceNip66Relays}
          label="NIP-66 Relays"
          placeholder="wss://relaypag.es"
          onchange={setAnnounceNip66Relays}
        />
      </div>
    {/if}
  </div>

  <!-- 5. Checks -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('checks')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.checks}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Checks</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.checks ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.checks && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        <!-- Enabled checks -->
        <div>
          <p class="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">Enabled Checks</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {#each CHECK_TYPES as check}
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={isCheckEnabled(check)}
                  onchange={() => toggleCheck(check)}
                  class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
                <span class="text-sm text-gray-700 dark:text-dark-text capitalize">{check}</span>
              </label>
            {/each}
          </div>
        </div>
        <!-- Options -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="adv-checks-expires" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Expires (ms)</label>
            <input id="adv-checks-expires" type="number" min="0"
              value={configState.data.relaymon.checks.options.expires}
              oninput={(e) => {
                if (!configState.data) return;
                configState.data.relaymon.checks.options.expires = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                configState.dirty = true;
              }}
              placeholder="86400000"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-checks-interval" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Interval (ms)</label>
            <input id="adv-checks-interval" type="number" min="0"
              value={configState.data.relaymon.checks.options.interval}
              oninput={(e) => {
                if (!configState.data) return;
                configState.data.relaymon.checks.options.interval = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                configState.dirty = true;
              }}
              placeholder="30000"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-checks-max" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Max Relays</label>
            <input id="adv-checks-max" type="number" min="0"
              value={typeof configState.data.relaymon.checks.options.max === 'number' ? configState.data.relaymon.checks.options.max : ''}
              oninput={(e) => {
                if (!configState.data) return;
                configState.data.relaymon.checks.options.max = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                configState.dirty = true;
              }}
              placeholder="200"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <div>
            <label for="adv-checks-statusinterval" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Status Interval (ms)</label>
            <input id="adv-checks-statusinterval" type="number" min="0"
              value={configState.data.relaymon.checks.options.statusInterval}
              oninput={(e) => {
                if (!configState.data) return;
                configState.data.relaymon.checks.options.statusInterval = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                configState.dirty = true;
              }}
              placeholder="100"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
        </div>
        <!-- Timeouts -->
        <div>
          <p class="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">Timeouts (ms)</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {#each CHECK_TYPES as checkType}
              <div>
                <label for="adv-timeout-{checkType}" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1 capitalize">{checkType}</label>
                <input id="adv-timeout-{checkType}" type="number" min="0"
                  value={(configState.data.relaymon.checks.options.timeout as Record<string, number | undefined>)[checkType] ?? ''}
                  oninput={(e) => {
                    if (!configState.data) return;
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    (configState.data.relaymon.checks.options.timeout as Record<string, number | undefined>)[checkType] = isNaN(val) ? undefined : val;
                    configState.dirty = true;
                  }}
                  placeholder="5000"
                  class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- 6. Retry / Backoff -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('retry')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.retry}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Retry / Backoff</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.retry ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.retry && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-3 border-t border-gray-100 dark:border-slate-700">
        <p class="text-xs text-gray-500 dark:text-dark-muted">Configure exponential backoff tiers. Relays that fail repeatedly are retried with increasing delays.</p>
        {#each retryTiers as tier, idx}
          <div class="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-dark-border p-3">
            <span class="text-xs font-medium text-gray-500 dark:text-dark-muted w-16 flex-shrink-0">Tier {idx + 1}</span>
            <div class="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label for="adv-retry-max-{idx}" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Max failures</label>
                <input id="adv-retry-max-{idx}" type="number" min="1"
                  value={tier.max}
                  oninput={(e) => updateRetryTier(idx, 'max', parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-retry-delay-{idx}" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Delay (ms)</label>
                <input id="adv-retry-delay-{idx}" type="number" min="0"
                  value={tier.delay}
                  oninput={(e) => updateRetryTier(idx, 'delay', parseInt((e.target as HTMLInputElement).value, 10) || 0)}
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            </div>
            <button type="button" onclick={() => removeRetryTier(idx)}
              aria-label="Remove tier {idx + 1}"
              class="flex-shrink-0 rounded p-1 text-red-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
        <button type="button" onclick={addRetryTier}
          class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-dark-border px-4 py-2 text-sm text-gray-600 dark:text-dark-muted hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add tier
        </button>
      </div>
    {/if}
  </div>

  <!-- 7. Network Modes -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('networks')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.networks}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Network Modes</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.networks ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.networks && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-3 border-t border-gray-100 dark:border-slate-700">
        {#each ALL_NETWORKS as net}
          <label class="flex items-start gap-3 cursor-pointer">
            <input type="checkbox"
              checked={isNetworkEnabled(net.value)}
              onchange={() => toggleNetwork(net.value)}
              disabled={net.value === 'clearnet' && (configState.data?.relaymon.networks.length ?? 1) <= 1}
              class="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            <div>
              <span class="text-sm font-medium text-gray-700 dark:text-dark-text">{net.label}</span>
              {#if net.help}
                <p class="text-xs text-gray-400 dark:text-slate-500">{net.help}</p>
              {/if}
            </div>
          </label>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 8. Database -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('database')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.database}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Database</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.database ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.database && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        {#if !configState.data.db}
          <button type="button" onclick={ensureDb}
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">
            + Configure custom database path
          </button>
        {:else}
          <div>
            <label for="adv-db-path" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Database Path</label>
            <input id="adv-db-path" type="text" bind:value={configState.data.db.path}
              oninput={() => { configState.dirty = true; }} placeholder="/opt/data/relaymon.db"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              bind:checked={configState.data.db.enableWAL}
              onchange={() => { configState.dirty = true; }}
              class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-dark-text">Enable WAL mode</span>
          </label>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 9. Queue -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('queue')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.queue}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Queue</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.queue ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.queue && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        <div>
          <label for="adv-queue-concurrency" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
            Worker Concurrency
          </label>
          <input id="adv-queue-concurrency" type="text"
            value={queueConcurrencyStr}
            oninput={(e) => onQueueConcurrencyInput((e.target as HTMLInputElement).value)}
            placeholder="auto"
            class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
              bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
              focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          <p class="mt-1 text-xs text-gray-400 dark:text-slate-500">Number of parallel check workers, or "auto" to use CPU count.</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- 10. Log Level -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('logLevel')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.logLevel}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Log Level</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.logLevel ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.logLevel && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-slate-700">
        <label for="adv-loglevel" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">Log Level</label>
        <select id="adv-loglevel"
          value={configState.data.logLevel ?? 'info'}
          onchange={(e) => {
            if (!configState.data) return;
            configState.data.logLevel = (e.target as HTMLSelectElement).value as 'debug' | 'info' | 'warn' | 'error';
            configState.dirty = true;
          }}
          class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
            bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
            focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors">
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
      </div>
    {/if}
  </div>

  <!-- 11. Ignore List -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('ignorelist')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.ignorelist}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Ignore List</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.ignorelist ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.ignorelist && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        {#if !configState.data.relaymon.ignorelist}
          <button type="button" onclick={ensureIgnorelist}
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">
            + Enable ignore list
          </button>
        {:else}
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              bind:checked={configState.data.relaymon.ignorelist.enabled}
              onchange={() => { configState.dirty = true; }}
              class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-dark-text">Enabled</span>
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="adv-ignorelist-interval" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Interval</label>
              <input id="adv-ignorelist-interval" type="text"
                bind:value={configState.data.relaymon.ignorelist.interval}
                oninput={() => { configState.dirty = true; }} placeholder="1h"
                class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
            </div>
            <div>
              <label for="adv-ignorelist-deletion" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Deletion Interval</label>
              <input id="adv-ignorelist-deletion" type="text"
                bind:value={configState.data.relaymon.ignorelist.deletion_interval}
                oninput={() => { configState.dirty = true; }} placeholder="24h"
                class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
            </div>
          </div>
          <RelayUrlList
            urls={ignorelistRelays}
            label="Ignored Relay URLs"
            placeholder="wss://relay.example.com"
            onchange={setIgnorelistRelays}
          />
          <!-- Pubkeys -->
          <div>
            <label for="adv-ignorelist-pubkey" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Ignored Pubkeys</label>
            <div class="flex gap-2">
              <input id="adv-ignorelist-pubkey" type="text"
                bind:value={ignorePubkeyInput}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIgnorePubkey(); } }}
                placeholder="npub1... or hex"
                autocomplete="off" spellcheck="false"
                class="flex-1 rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm font-mono
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              <button type="button" onclick={addIgnorePubkey} disabled={!ignorePubkeyInput.trim()}
                class="rounded-lg px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors">
                Add
              </button>
            </div>
            {#if ignorelistPubkeys.length > 0}
              <ul class="mt-2 flex flex-wrap gap-2">
                {#each ignorelistPubkeys as pk, idx (pk)}
                  <li class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-dark-text">
                    <span class="truncate max-w-[200px] font-mono" title={pk}>{pk}</span>
                    <button type="button" onclick={() => removeIgnorePubkey(idx)} aria-label="Remove {pk}"
                      class="rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 12. Delta Events -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('delta')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.delta}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Delta Events</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.delta ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.delta && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-4 border-t border-gray-100 dark:border-slate-700">
        {#if !configState.data.relaymon.delta}
          <button type="button" onclick={ensureDelta}
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">
            + Enable delta events
          </button>
        {:else}
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              bind:checked={configState.data.relaymon.delta.enabled}
              onchange={() => { configState.dirty = true; }}
              class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-dark-text">Enabled</span>
          </label>
          <div>
            <label for="adv-delta-maxretries" class="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">Max Retries</label>
            <input id="adv-delta-maxretries" type="number" min="0"
              value={configState.data.relaymon.delta.max_retries ?? ''}
              oninput={(e) => {
                if (!configState.data?.relaymon.delta) return;
                configState.data.relaymon.delta.max_retries = parseInt((e.target as HTMLInputElement).value, 10) || undefined;
                configState.dirty = true;
              }}
              placeholder="3"
              class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
          </div>
          {#if configState.data.relaymon.delta.periods}
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                bind:checked={configState.data.relaymon.delta.periods.enabled}
                onchange={() => { configState.dirty = true; }}
                class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
              <span class="text-sm font-medium text-gray-700 dark:text-dark-text">Enable Periods</span>
            </label>
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  <!-- 13. Health -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('health')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.health}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Health</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.health ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.health && configState.data}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-5 border-t border-gray-100 dark:border-slate-700">
        {#if !configState.data.health}
          <button type="button" onclick={ensureHealth}
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none">
            + Enable health monitoring
          </button>
        {:else}
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              bind:checked={configState.data.health.enabled}
              onchange={() => { configState.dirty = true; }}
              class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-dark-text">Enable Health Endpoint</span>
          </label>
          <!-- Server -->
          <div class="rounded-lg border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">Server</h3>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                bind:checked={configState.data.health.server.enabled}
                onchange={() => { configState.dirty = true; }}
                class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-dark-text">Enabled</span>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="adv-health-host" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Host</label>
                <input id="adv-health-host" type="text"
                  bind:value={configState.data.health.server.host}
                  oninput={() => { configState.dirty = true; }} placeholder="0.0.0.0"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-health-port" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Port</label>
                <input id="adv-health-port" type="number" min="1" max="65535"
                  bind:value={configState.data.health.server.port}
                  oninput={() => { configState.dirty = true; }} placeholder="8080"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                bind:checked={configState.data.health.server.authEnabled}
                onchange={() => { configState.dirty = true; }}
                class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-dark-text">Auth Required</span>
            </label>
          </div>
          <!-- Kuma -->
          <div class="rounded-lg border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">Uptime Kuma</h3>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                bind:checked={configState.data.health.kuma.enabled}
                onchange={() => { configState.dirty = true; }}
                class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-dark-text">Enabled</span>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="adv-kuma-interval" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Interval</label>
                <input id="adv-kuma-interval" type="text"
                  bind:value={configState.data.health.kuma.intervalMs as string}
                  oninput={() => { configState.dirty = true; }} placeholder="30s"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-kuma-grace" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Startup Grace</label>
                <input id="adv-kuma-grace" type="text"
                  bind:value={configState.data.health.kuma.startupGraceMs as string}
                  oninput={() => { configState.dirty = true; }} placeholder="2m"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            </div>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  bind:checked={configState.data.health.kuma.degradedAsUp}
                  onchange={() => { configState.dirty = true; }}
                  class="h-4 w-4 rounded border-gray-300 dark:border-dark-border text-primary-600 focus:ring-primary-500" />
                <span class="text-sm text-gray-700 dark:text-dark-text">Degraded as Up</span>
              </label>
            </div>
            <div>
              <label for="adv-kuma-verbosity" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Message Verbosity</label>
              <select id="adv-kuma-verbosity"
                bind:value={configState.data.health.kuma.msgVerbosity}
                onchange={() => { configState.dirty = true; }}
                class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
                  focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors">
                <option value="summary">summary</option>
                <option value="detailed">detailed</option>
              </select>
            </div>
          </div>
          <!-- Thresholds -->
          <div class="rounded-lg border border-gray-100 dark:border-slate-700 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-dark-text">Thresholds</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="adv-thresh-checkidle" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Check Idle</label>
                <input id="adv-thresh-checkidle" type="text"
                  bind:value={configState.data.health.thresholds.checkIdleMs as string}
                  oninput={() => { configState.dirty = true; }} placeholder="5m"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-thresh-publishbacklog" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Publish Backlog Max</label>
                <input id="adv-thresh-publishbacklog" type="number" min="0"
                  bind:value={configState.data.health.thresholds.publishBacklogMax}
                  oninput={() => { configState.dirty = true; }} placeholder="100"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-thresh-errorrate" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Error Rate / min</label>
                <input id="adv-thresh-errorrate" type="number" min="0"
                  bind:value={configState.data.health.thresholds.errorRatePerMin}
                  oninput={() => { configState.dirty = true; }} placeholder="10"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
              <div>
                <label for="adv-thresh-startupgrace" class="block text-xs font-medium text-gray-600 dark:text-dark-muted mb-1">Startup Grace</label>
                <input id="adv-thresh-startupgrace" type="text"
                  bind:value={configState.data.health.thresholds.startupGraceMs as string}
                  oninput={() => { configState.dirty = true; }} placeholder="2m"
                  class="w-full rounded border border-gray-300 dark:border-dark-border px-2 py-1.5 text-sm font-mono
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-400 transition-colors" />
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 14. Signing Key -->
  <div class="border border-gray-200 dark:border-dark-border rounded-xl mb-3 overflow-hidden">
    <button
      type="button"
      onclick={() => toggleSection('signing')}
      class="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
      aria-expanded={openSections.signing}
    >
      <span class="text-sm font-semibold text-gray-800 dark:text-dark-text">Signing Key</span>
      <svg class="w-4 h-4 text-gray-400 transition-transform {openSections.signing ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {#if openSections.signing}
      <div class="px-5 pb-5 pt-2 bg-white dark:bg-dark-card space-y-3 border-t border-gray-100 dark:border-slate-700">
        <p class="text-xs text-gray-500 dark:text-dark-muted">
          Your nsec is used to sign monitoring events. Stored in config file on your server.
        </p>
        <label for="adv-nsec-input" class="block text-sm font-medium text-gray-700 dark:text-dark-text">nsec (signing key)</label>
        <div class="relative flex items-center">
          {#if nsecVisible}
            <input id="adv-nsec-input" type="text"
              bind:value={configState.nsec}
              oninput={onNsecInput} onblur={onNsecBlur}
              placeholder="nsec1..." autocomplete="off" spellcheck="false"
              aria-invalid={!!nsecError}
              class="w-full rounded-lg border pr-10 px-3 py-2 text-sm font-mono transition-colors
                {nsecError
                  ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400'
                  : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2" />
          {:else}
            <input id="adv-nsec-input" type="password"
              bind:value={configState.nsec}
              oninput={onNsecInput} onblur={onNsecBlur}
              placeholder="nsec1..." autocomplete="new-password"
              aria-invalid={!!nsecError}
              class="w-full rounded-lg border pr-10 px-3 py-2 text-sm font-mono transition-colors
                {nsecError
                  ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-400'
                  : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
                bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                focus:outline-none focus:ring-2" />
          {/if}
          <button type="button" onclick={() => { nsecVisible = !nsecVisible; }}
            class="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
            aria-label={nsecVisible ? 'Hide signing key' : 'Show signing key'}>
            {#if nsecVisible}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            {:else}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            {/if}
          </button>
        </div>
        {#if nsecError}
          <p role="alert" class="text-xs text-red-600 dark:text-red-400">{nsecError}</p>
        {:else}
          <p class="text-xs text-gray-400 dark:text-slate-500">
            Leave blank if using the <code class="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">RELAYMON_NSEC</code> environment variable.
          </p>
        {/if}
      </div>
    {/if}
  </div>

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

  {#if configState.saveError}
    <div role="alert" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-400">
        <strong>Save failed:</strong> {configState.saveError}
      </p>
    </div>
  {/if}

  <!-- Save button (sticky) -->
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
