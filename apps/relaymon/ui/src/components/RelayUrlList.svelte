<script lang="ts">
  import { validateRelayUrl } from '../lib/validate.ts';

  interface Props {
    urls: string[];
    label: string;
    placeholder?: string;
    minItems?: number;
  }

  let {
    urls = $bindable([]),
    label,
    placeholder = 'wss://relay.example.com',
    minItems = 0,
  }: Props = $props();

  let inputValue = $state('');
  let inputError = $state<string | null>(null);
  let duplicateWarning = $state(false);

  function validateInput(): boolean {
    const err = validateRelayUrl(inputValue.trim());
    if (err) {
      inputError = err;
      duplicateWarning = false;
      return false;
    }
    const trimmed = inputValue.trim();
    if (urls.includes(trimmed)) {
      inputError = null;
      duplicateWarning = true;
      return false;
    }
    inputError = null;
    duplicateWarning = false;
    return true;
  }

  function addUrl(): void {
    if (!validateInput()) return;
    urls = [...urls, inputValue.trim()];
    inputValue = '';
    inputError = null;
    duplicateWarning = false;
  }

  function removeUrl(idx: number): void {
    if (minItems > 0 && urls.length <= minItems) return;
    urls = urls.filter((_, i) => i !== idx);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    }
  }

  function onInput(): void {
    // Clear error as user types
    if (inputError || duplicateWarning) {
      inputError = null;
      duplicateWarning = false;
    }
  }

  const inputId = `relay-url-input-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const errorId = `${inputId}-error`;

  const isAddDisabled = $derived(
    inputValue.trim() === '' || !!validateRelayUrl(inputValue.trim()) || urls.includes(inputValue.trim())
  );
</script>

<div class="space-y-2">
  <label for={inputId} class="block text-sm font-medium text-gray-700 dark:text-dark-text">
    {label}
    {#if minItems > 0}
      <span class="ml-1 text-xs font-normal text-gray-500 dark:text-dark-muted">(min {minItems})</span>
    {/if}
  </label>

  <!-- Input row -->
  <div class="flex gap-2">
    <input
      id={inputId}
      type="url"
      bind:value={inputValue}
      onkeydown={onKeyDown}
      oninput={onInput}
      {placeholder}
      autocomplete="off"
      spellcheck="false"
      aria-describedby={inputError || duplicateWarning ? errorId : undefined}
      aria-invalid={!!inputError}
      class="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors
        {inputError
          ? 'border-red-400 focus:border-red-500 focus:ring-red-400 dark:border-red-500'
          : 'border-gray-300 dark:border-dark-border focus:border-primary-500 focus:ring-primary-400'}
        bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text
        placeholder-gray-400 dark:placeholder-slate-600
        focus:outline-none focus:ring-2 focus:ring-offset-0"
    />
    <button
      type="button"
      onclick={addUrl}
      disabled={isAddDisabled}
      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors
        bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800
        disabled:opacity-40 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    >
      Add
    </button>
  </div>

  <!-- Validation message -->
  {#if inputError}
    <p id={errorId} role="alert" class="text-xs text-red-600 dark:text-red-400">
      {inputError}
    </p>
  {:else if duplicateWarning}
    <p id={errorId} role="alert" class="text-xs text-amber-600 dark:text-amber-400">
      This relay is already in the list.
    </p>
  {/if}

  <!-- URL pills list -->
  {#if urls.length > 0}
    <ul class="mt-2 flex flex-wrap gap-2" aria-label="{label} list">
      {#each urls as url, idx (url)}
        <li class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-700 dark:text-dark-text max-w-full">
          <span class="truncate max-w-[200px]" title={url}>{url}</span>
          <button
            type="button"
            onclick={() => removeUrl(idx)}
            disabled={minItems > 0 && urls.length <= minItems}
            aria-label="Remove {url}"
            class="flex-shrink-0 ml-0.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-dark-text transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
              focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-xs text-gray-400 dark:text-slate-500 italic">No relay URLs added yet.</p>
  {/if}
</div>
