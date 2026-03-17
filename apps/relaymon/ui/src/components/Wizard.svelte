<script lang="ts">
  import { configState, saveCurrentConfig } from '../lib/configState.svelte.ts';
  import { validateNsec } from '../lib/validate.ts';
  import SeedingSelector from './SeedingSelector.svelte';
  import RelayUrlList from './RelayUrlList.svelte';

  // ---- Step state ----
  let step = $state(0); // 0=Welcome, 1=Seeding, 2=Sources, 3=Key, 4=Review

  // ---- Local wizard state ----
  let nsecInput = $state('');
  let nsecVisible = $state(false);
  let nsecError = $state<string | null>(null);

  let monitorName = $state('');
  let monitorDescription = $state('');
  let monitorNameError = $state<string | null>(null);

  let saving = $state(false);

  // ---- Derived helpers ----
  const sources = $derived(configState.data?.relaymon?.seed?.sources ?? []);
  const hasConfig = $derived(sources.includes('config'));
  const hasEvents = $derived(sources.includes('events'));
  const hasDb = $derived(sources.includes('db'));

  const configRelays = $derived(
    Array.isArray((configState.data?.relaymon?.seed?.options as Record<string, unknown>)?.config)
      ? ((configState.data?.relaymon?.seed?.options as Record<string, unknown>).config as string[])
      : []
  );

  const eventsOptions = $derived(
    ((configState.data?.relaymon?.seed?.options as Record<string, unknown>)?.events as Record<string, unknown>) ?? {}
  );

  const eventsPubkeys = $derived(
    Array.isArray(eventsOptions.pubkeys) ? (eventsOptions.pubkeys as string[]) : []
  );

  const eventsRelays = $derived(
    Array.isArray(eventsOptions.relays) ? (eventsOptions.relays as string[]) : []
  );

  const dbSeedRelays = $derived(
    Array.isArray((configState.data?.relaymon?.seed?.options as Record<string, unknown>)?.db)
      ? ((configState.data?.relaymon?.seed?.options as Record<string, unknown>).db as string[])
      : []
  );

  // ---- Step 1 validation: at least one source selected ----
  const step1Valid = $derived(sources.length > 0);

  // ---- Step 2 validation ----
  const step2Valid = $derived(() => {
    if (hasDb) {
      // Network Scale: always valid (trawler handles discovery)
      return true;
    }
    if (hasConfig && configRelays.length === 0) return false;
    if (hasEvents && eventsPubkeys.length === 0) return false;
    if (!hasConfig && !hasEvents && !hasDb) return false;
    return true;
  });

  // ---- Step 3 validation ----
  const step3Valid = $derived(
    nsecInput.trim() !== '' &&
    validateNsec(nsecInput.trim()) === null &&
    monitorName.trim() !== ''
  );

  // ---- Navigation ----
  function goNext() {
    if (step === 3) {
      // Validate step 3 before advancing
      const nsecErr = validateNsec(nsecInput.trim());
      if (nsecErr) { nsecError = nsecErr; return; }
      if (!monitorName.trim()) { monitorNameError = 'Monitor name is required'; return; }
      // Commit nsec and name to configState
      configState.nsec = nsecInput;
      if (configState.data) {
        configState.data.monitor.info.name = monitorName;
        if (monitorDescription.trim()) {
          configState.data.monitor.info.about = monitorDescription;
        }
      }
    }
    step = step + 1;
  }

  function goBack() {
    if (step > 0) step = step - 1;
  }

  // ---- Step 3 input handlers ----
  function onNsecInput() {
    nsecError = null;
  }

  function onMonitorNameInput() {
    monitorNameError = null;
  }

  // ---- Npub input for Relay Lists step ----
  let npubInput = $state('');
  let npubError = $state<string | null>(null);

  import { validateNpub } from '../lib/validate.ts';

  function addNpub() {
    const trimmed = npubInput.trim();
    if (!trimmed) return;
    const err = validateNpub(trimmed);
    if (err) { npubError = err; return; }
    if (!configState.data) return;
    const opts = configState.data.relaymon.seed.options as Record<string, unknown>;
    if (!opts.events || typeof opts.events !== 'object') {
      (opts as Record<string, unknown>).events = { pubkeys: [], relays: [] };
    }
    const ev = opts.events as Record<string, unknown>;
    if (!Array.isArray(ev.pubkeys)) ev.pubkeys = [];
    if (!(ev.pubkeys as string[]).includes(trimmed)) {
      (ev.pubkeys as string[]).push(trimmed);
    }
    npubInput = '';
    npubError = null;
  }

  function removeNpub(idx: number) {
    if (!configState.data) return;
    const opts = configState.data.relaymon.seed.options as Record<string, unknown>;
    const ev = opts.events as Record<string, unknown>;
    if (Array.isArray(ev?.pubkeys)) {
      (ev.pubkeys as string[]).splice(idx, 1);
    }
  }

  function onNpubKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addNpub(); }
  }

  // ---- Relay Lists: relay input ----
  function updateEventsRelays(newRelays: string[]) {
    if (!configState.data) return;
    const opts = configState.data.relaymon.seed.options as Record<string, unknown>;
    if (!opts.events || typeof opts.events !== 'object') {
      (opts as Record<string, unknown>).events = { pubkeys: [], relays: newRelays };
    } else {
      (opts.events as Record<string, unknown>).relays = newRelays;
    }
  }

  // ---- My Relays: relay input ----
  function updateConfigRelays(newRelays: string[]) {
    if (!configState.data) return;
    const opts = configState.data.relaymon.seed.options as Record<string, unknown>;
    opts.config = newRelays;
  }

  // ---- Save ----
  let saveError = $state<string | null>(null);

  async function handleSave() {
    saving = true;
    saveError = null;
    try {
      await saveCurrentConfig();
      if (configState.saveError) {
        saveError = configState.saveError;
      }
      // configState.isFirstRun becomes false on success — App.svelte will unmount Wizard
    } finally {
      saving = false;
    }
  }

  // ---- Summary helpers ----
  const seedingModeSummary = $derived(() => {
    const labels: string[] = [];
    if (hasConfig) labels.push('My Relays');
    if (hasEvents) labels.push('Relay Lists');
    if (hasDb) labels.push('Network Scale');
    return labels.join(', ') || 'None';
  });

  const sourceCountSummary = $derived(() => {
    const parts: string[] = [];
    if (hasConfig) parts.push(`${configRelays.length} relay${configRelays.length !== 1 ? 's' : ''}`);
    if (hasEvents) parts.push(`${eventsPubkeys.length} npub${eventsPubkeys.length !== 1 ? 's' : ''}`);
    if (hasDb) parts.push('Network crawler (auto-discovery)');
    return parts.join(', ') || 'None';
  });

  const TOTAL_STEPS = 4; // steps 1-4 (step 0 = welcome, not counted)
  const displayStep = $derived(step === 0 ? 0 : step);
</script>

<!-- Wizard overlay: centered card on full-screen bg -->
<div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 transition-colors duration-200">
  <div class="w-full max-w-[600px]">

    <!-- Step indicator (shown on steps 1-4) -->
    {#if step > 0}
      <div class="mb-6">
        <!-- Step labels -->
        <div class="flex items-center justify-between mb-2">
          {#each ['Seeding', 'Sources', 'Key', 'Review'] as label, i}
            <div class="flex-1 text-center">
              <span class="text-xs font-medium
                {step === i + 1 ? 'text-primary-600 dark:text-primary-400' : step > i + 1 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}">
                {label}
              </span>
            </div>
          {/each}
        </div>
        <!-- Dot indicators -->
        <div class="flex items-center gap-2 justify-center mb-3">
          {#each [1, 2, 3, 4] as s}
            <div class="w-2.5 h-2.5 rounded-full transition-colors duration-200
              {step === s ? 'bg-primary-600 dark:bg-primary-400 scale-125' : step > s ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}">
            </div>
          {/each}
        </div>
        <!-- Progress bar -->
        <div class="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
          <div
            class="bg-gradient-to-r from-primary-500 to-accent-500 h-1.5 rounded-full transition-all duration-300"
            style="width: {(step / TOTAL_STEPS) * 100}%"
          ></div>
        </div>
        <p class="text-xs text-right text-gray-400 dark:text-slate-500 mt-1">Step {step} of {TOTAL_STEPS}</p>
      </div>
    {/if}

    <!-- Card -->
    <div class="rounded-2xl bg-white dark:bg-slate-800 shadow-xl ring-1 ring-gray-200 dark:ring-slate-700 overflow-hidden">

      <!-- ===== STEP 0: WELCOME ===== -->
      {#if step === 0}
        <div class="p-8 text-center">
          <!-- Branding -->
          <div class="mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-md">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
              Welcome to Relay Monitor
            </h1>
          </div>
          <p class="text-gray-600 dark:text-dark-muted text-base leading-relaxed mb-2">
            Let's set up your relay monitor in a few steps.
          </p>
          <p class="text-gray-500 dark:text-slate-500 text-sm mb-8">
            This will only take a minute. You can always change these settings later.
          </p>

          <!-- Feature highlights -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
            {#each [
              { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Track relay health', desc: 'Monitor uptime and performance' },
              { icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', label: 'Get alerts', desc: 'Know when relays go down' },
              { icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', label: 'Publish to Nostr', desc: 'Share data on the network' },
            ] as feat}
              <div class="flex flex-col items-center text-center p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50">
                <svg class="w-6 h-6 text-primary-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={feat.icon} />
                </svg>
                <span class="text-xs font-semibold text-gray-700 dark:text-dark-text">{feat.label}</span>
                <span class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{feat.desc}</span>
              </div>
            {/each}
          </div>

          <button
            type="button"
            onclick={() => { step = 1; }}
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-8 py-3 text-base font-semibold text-white shadow-md hover:shadow-lg hover:from-primary-700 hover:to-accent-600 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          >
            Get Started
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

      <!-- ===== STEP 1: SEEDING MODE ===== -->
      {:else if step === 1}
        <div class="p-8">
          <div class="mb-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">How do you want to find relays?</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">
              Choose how your monitor discovers which relays to check. You can combine My Relays and Relay Lists.
            </p>
          </div>

          <SeedingSelector />

          <!-- Mode descriptions for new users -->
          <div class="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <p class="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Not sure which to pick?</p>
            <ul class="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li><strong>My Relays</strong> — Best if you have a specific list of relays to monitor.</li>
              <li><strong>Relay Lists</strong> — Great if you want to monitor the relays someone uses on Nostr.</li>
              <li><strong>Network Scale</strong> — For advanced users who want to crawl the entire network.</li>
            </ul>
          </div>

          <div class="mt-6 flex justify-between">
            <button
              type="button"
              onclick={goBack}
              class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              onclick={goNext}
              disabled={!step1Valid}
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              Next
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

      <!-- ===== STEP 2: SOURCES ===== -->
      {:else if step === 2}
        <div class="p-8">
          <div class="mb-6">
            {#if hasDb}
              <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Network crawler will discover relays automatically</h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">
                The trawler crawler will crawl the Nostr network and build a relay database. No manual input needed.
              </p>
            {:else if hasConfig && hasEvents}
              <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Add your relay sources</h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">Enter relay URLs and npubs to monitor.</p>
            {:else if hasConfig}
              <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Add relays to monitor</h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">Enter the relay URLs you want your monitor to check.</p>
            {:else if hasEvents}
              <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Enter npub(s) to follow</h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">Your monitor will watch the relay lists published by these Nostr identities.</p>
            {/if}
          </div>

          <div class="space-y-6">

            <!-- Network Scale info -->
            {#if hasDb}
              <div class="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-primary-700 dark:text-primary-300">Trawler will automatically crawl the Nostr network</p>
                    <p class="mt-1 text-xs text-primary-600 dark:text-primary-400">
                      It starts from well-known relays and discovers all connected relays recursively.
                      This can find thousands of relays over time. The database is stored at <code class="font-mono bg-primary-100 dark:bg-primary-800/30 px-1 rounded">/opt/data/trawler.db</code>.
                    </p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- My Relays input -->
            {#if hasConfig}
              <RelayUrlList
                urls={configRelays}
                label="Relay URLs to monitor"
                placeholder="wss://relay.example.com"
                onchange={updateConfigRelays}
              />
            {/if}

            <!-- Relay Lists: npub input -->
            {#if hasEvents}
              <div class="space-y-2">
                <label for="wizard-npub-input" class="block text-sm font-medium text-gray-700 dark:text-dark-text">
                  Nostr public keys (npub)
                </label>
                <p class="text-xs text-gray-500 dark:text-dark-muted">
                  Enter an npub to monitor that person's NIP-65 relay list.
                </p>
                <div class="flex gap-2">
                  <input
                    id="wizard-npub-input"
                    type="text"
                    bind:value={npubInput}
                    onkeydown={onNpubKeyDown}
                    oninput={() => { npubError = null; }}
                    placeholder="npub1..."
                    autocomplete="off"
                    spellcheck="false"
                    aria-invalid={!!npubError}
                    class="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors
                      {npubError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500'}
                      bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                      focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-0"
                  />
                  <button
                    type="button"
                    onclick={addNpub}
                    disabled={!npubInput.trim()}
                    class="rounded-lg px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Add
                  </button>
                </div>
                {#if npubError}
                  <p role="alert" class="text-xs text-red-600 dark:text-red-400">{npubError}</p>
                {/if}
                {#if eventsPubkeys.length > 0}
                  <ul class="mt-2 flex flex-wrap gap-2" aria-label="npub list">
                    {#each eventsPubkeys as pk, idx (pk)}
                      <li class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-dark-text max-w-full">
                        <span class="truncate max-w-[200px] font-mono" title={pk}>{pk.slice(0, 12)}…{pk.slice(-6)}</span>
                        <button
                          type="button"
                          onclick={() => removeNpub(idx)}
                          aria-label="Remove {pk}"
                          class="flex-shrink-0 ml-0.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-dark-text transition-colors focus:outline-none"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="text-xs text-gray-400 dark:text-slate-500 italic">No npubs added yet.</p>
                {/if}
              </div>

              <!-- Relay Lists: relays for fetching -->
              <RelayUrlList
                urls={eventsRelays}
                label="Relays to fetch lists from"
                placeholder="wss://relay.nostr.watch"
                onchange={updateEventsRelays}
              />
            {/if}

          </div>

          <div class="mt-6 flex justify-between">
            <button
              type="button"
              onclick={goBack}
              class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              onclick={goNext}
              disabled={!step2Valid()}
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              Next
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

      <!-- ===== STEP 3: SIGNING KEY ===== -->
      {:else if step === 3}
        <div class="p-8">
          <div class="mb-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Enter your signing key</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">
              Your nsec is used to sign relay check events published to the Nostr network. It stays on your server and is never shared.
            </p>
          </div>

          <div class="space-y-5">

            <!-- nsec input -->
            <div class="space-y-1.5">
              <label for="wizard-nsec" class="block text-sm font-medium text-gray-700 dark:text-dark-text">
                Signing key (nsec) <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <div class="relative">
                <input
                  id="wizard-nsec"
                  type={nsecVisible ? 'text' : 'password'}
                  bind:value={nsecInput}
                  oninput={onNsecInput}
                  placeholder="nsec1..."
                  autocomplete="off"
                  spellcheck="false"
                  aria-required="true"
                  aria-invalid={!!nsecError}
                  class="w-full rounded-lg border px-3 py-2 pr-10 text-sm font-mono transition-colors
                    {nsecError ? 'border-red-400 dark:border-red-500 focus:ring-red-400' : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
                    bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-offset-0"
                />
                <button
                  type="button"
                  onclick={() => { nsecVisible = !nsecVisible; }}
                  aria-label={nsecVisible ? 'Hide key' : 'Show key'}
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors focus:outline-none"
                >
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
              {:else if nsecInput.trim() && validateNsec(nsecInput.trim()) === null}
                <p class="text-xs text-green-600 dark:text-green-400">Valid nsec</p>
              {/if}
              <p class="text-xs text-gray-400 dark:text-slate-500">
                Don't have a Nostr key? Generate one with any Nostr client (e.g. Damus, Snort, Primal).
              </p>
            </div>

            <!-- Monitor name -->
            <div class="space-y-1.5">
              <label for="wizard-monitor-name" class="block text-sm font-medium text-gray-700 dark:text-dark-text">
                Monitor name <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="wizard-monitor-name"
                type="text"
                bind:value={monitorName}
                oninput={onMonitorNameInput}
                placeholder="My Relay Monitor"
                autocomplete="off"
                aria-required="true"
                aria-invalid={!!monitorNameError}
                class="w-full rounded-lg border px-3 py-2 text-sm transition-colors
                  {monitorNameError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-dark-border focus:border-primary-500'}
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-0"
              />
              {#if monitorNameError}
                <p role="alert" class="text-xs text-red-600 dark:text-red-400">{monitorNameError}</p>
              {/if}
              <p class="text-xs text-gray-400 dark:text-slate-500">A short name for this monitor instance.</p>
            </div>

            <!-- Monitor description -->
            <div class="space-y-1.5">
              <label for="wizard-monitor-desc" class="block text-sm font-medium text-gray-700 dark:text-dark-text">
                Description <span class="text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="wizard-monitor-desc"
                bind:value={monitorDescription}
                placeholder="A short description of what this monitor watches..."
                rows="2"
                class="w-full rounded-lg border border-gray-300 dark:border-dark-border px-3 py-2 text-sm
                  bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-slate-600
                  focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 focus:ring-offset-0 resize-none"
              ></textarea>
            </div>

          </div>

          <div class="mt-6 flex justify-between">
            <button
              type="button"
              onclick={goBack}
              class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              onclick={goNext}
              disabled={!step3Valid}
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              Next
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

      <!-- ===== STEP 4: REVIEW & SAVE ===== -->
      {:else if step === 4}
        <div class="p-8">
          <div class="mb-6 text-center">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-dark-text">Ready to go!</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">Review your configuration before saving.</p>
          </div>

          <!-- Summary list -->
          <dl class="space-y-3 mb-6">
            <div class="flex justify-between rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-muted">Seeding mode</dt>
              <dd class="text-sm font-semibold text-gray-900 dark:text-dark-text text-right">{seedingModeSummary()}</dd>
            </div>
            <div class="flex justify-between rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-muted">Sources</dt>
              <dd class="text-sm text-gray-900 dark:text-dark-text text-right">{sourceCountSummary()}</dd>
            </div>
            <div class="flex justify-between rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-muted">Monitor name</dt>
              <dd class="text-sm font-semibold text-gray-900 dark:text-dark-text">{monitorName}</dd>
            </div>
            <div class="flex justify-between rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-muted">Signing key</dt>
              <dd class="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Provided
              </dd>
            </div>
          </dl>

          {#if saveError}
            <div class="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p class="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {saveError}
              </p>
            </div>
          {/if}

          <div class="flex justify-between items-center">
            <button
              type="button"
              onclick={goBack}
              disabled={saving}
              class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              onclick={handleSave}
              disabled={saving}
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-8 py-3 text-base font-semibold text-white shadow-md hover:shadow-lg hover:from-primary-700 hover:to-accent-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              {#if saving}
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              {:else}
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Save & Start Monitoring
              {/if}
            </button>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>
