<script lang="ts">
  import { onMount } from 'svelte';
  import { initTheme } from './lib/theme.svelte.ts';
  import { configState, loadConfig } from './lib/configState.svelte.ts';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import StatsBar from './components/StatsBar.svelte';
  import StatsCards from './components/StatsCards.svelte';
  import ConfigForm from './components/ConfigForm.svelte';
  import Wizard from './components/Wizard.svelte';

  let loaded = $state(false);

  onMount(async () => {
    initTheme();
    await loadConfig();
    loaded = true;
  });

  // Show wizard when: config is first run AND localStorage flag is not set
  const showWizard = $derived(
    loaded &&
    configState.isFirstRun &&
    !localStorage.getItem('wizard_complete')
  );
</script>

<div class="relative min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">

  <!-- Theme toggle: fixed top-right -->
  <div class="absolute top-4 right-4 z-20">
    <ThemeToggle />
  </div>

  {#if showWizard}
    <!-- First-run wizard: guides user through initial setup -->
    <Wizard />
  {:else if loaded}
    <!-- Normal dashboard: stats + config form -->

    <!-- Status bar: sticky at top -->
    <StatsBar />

    <!-- Main content container -->
    <main class="max-w-5xl mx-auto px-4 py-8">

      <!-- Branding heading -->
      <div class="mb-8 text-center sm:text-left">
        <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
          Relay Monitor
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-dark-muted">
          Self-hosted Nostr relay monitoring dashboard
        </p>
      </div>

      <!-- Stats cards -->
      <div class="mb-8">
        <StatsCards />
      </div>

      <!-- Config form (Plans 16-04+) -->
      <ConfigForm />

    </main>
  {/if}
</div>
