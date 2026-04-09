<script lang="ts">
  import CodeMirror from 'svelte-codemirror-editor';
  import { yaml } from '@codemirror/lang-yaml';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { configState, setConfigFromYaml, saveCurrentConfig } from '../lib/configState.svelte.ts';
  import { theme } from '../lib/theme.svelte.ts';

  // Debounced YAML sync: update configState.data as the user types
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function onEditorChange(value: string): void {
    // Always update rawYaml immediately so the displayed text stays in sync
    configState.rawYaml = value;
    configState.dirty = true;

    // Debounce the parse+validate step (300ms)
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      setConfigFromYaml(value);
    }, 300);
  }

  // YAML language support
  const yamlLang = yaml();

  // Computed theme: use oneDark when dark mode is active, undefined for light
  const editorTheme = $derived(theme.dark ? oneDark : undefined);

  // Validation state
  const isValid = $derived(configState.validationErrors.length === 0);

  // Save handler
  let saving = $state(false);

  async function handleSave(): Promise<void> {
    if (!isValid) return;
    saving = true;
    try {
      await saveCurrentConfig();
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-4">

  <!-- Editor container -->
  <div class="rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
      <span class="text-xs font-medium text-gray-500 dark:text-dark-muted">config.yaml</span>
      <span class="text-xs text-gray-400 dark:text-slate-500">YAML</span>
    </div>

    <div class="min-h-[400px]">
      <CodeMirror
        value={configState.rawYaml}
        lang={yamlLang}
        theme={editorTheme}
        lineNumbers={true}
        lineWrapping={false}
        onchange={onEditorChange}
        styles={{
          '&': { minHeight: '400px' },
          '.cm-scroller': { overflow: 'auto', minHeight: '400px' },
        }}
      />
    </div>
  </div>

  <!-- Validation status bar -->
  <div
    class="flex items-start gap-2 rounded-lg px-3 py-2 text-sm border
      {isValid
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}"
    role="status"
    aria-live="polite"
  >
    {#if isValid}
      <svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="text-emerald-700 dark:text-emerald-400 font-medium">Valid YAML</span>
    {:else}
      <svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        {#each configState.validationErrors as err}
          <p class="text-red-700 dark:text-red-400">{err}</p>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Comment preservation note -->
  <p class="text-xs text-gray-400 dark:text-slate-500">
    Comments in the YAML are preserved — the raw text is saved directly without round-tripping through a parser.
  </p>

  <!-- Save error -->
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
      {#if !isValid}
        <span class="text-xs text-red-600 dark:text-red-400">Fix YAML errors before saving</span>
      {/if}
    </div>

    <button
      type="button"
      onclick={handleSave}
      disabled={saving || configState.loading || !configState.dirty || !isValid}
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
