<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getMetrics } from '../lib/api.ts';
  import type { HealthSnapshot } from '../lib/types.ts';

  const POLL_INTERVAL_MS = 30_000;

  let metrics = $state<HealthSnapshot | null>(null);
  let unreachable = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function fetchMetrics(): Promise<void> {
    try {
      const result = await getMetrics();
      metrics = result;
      unreachable = false;
    } catch {
      metrics = null;
      unreachable = true;
    }
  }

  onMount(async () => {
    await fetchMetrics();
    intervalId = setInterval(fetchMetrics, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (intervalId !== null) clearInterval(intervalId);
  });

  function formatPercent(value: number): string {
    if (!isFinite(value)) return '--';
    return `${Math.round(value * 100) / 100}%`;
  }

  function queueProgress(completed: number, enqueued: number): number {
    if (!enqueued || enqueued <= 0) return 0;
    return Math.min(100, Math.round((completed / enqueued) * 100));
  }

  const relayTotal = $derived(metrics ? metrics.metrics.checkQueue.enqueued : null);
  const relayOnline = $derived(metrics ? metrics.metrics.checkQueue.completed : null);
  const relayOffline = $derived(metrics ? metrics.metrics.checkQueue.failed : null);
  const queuePending = $derived(metrics ? metrics.metrics.checkQueue.pending : null);
  const queueEnqueued = $derived(metrics ? metrics.metrics.checkQueue.enqueued : null);
  const queueCompleted = $derived(metrics ? metrics.metrics.checkQueue.completed : null);
  const publishRate = $derived(metrics ? metrics.metrics.publishQueue.successRate : null);
  const publishPending = $derived(metrics ? metrics.metrics.publishQueue.pending : null);
  const progressPct = $derived(
    metrics ? queueProgress(metrics.metrics.checkQueue.completed, metrics.metrics.checkQueue.enqueued) : 0
  );
</script>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">

  <!-- Relays card -->
  <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-dark-border p-4 transition-colors duration-200">
    <div class="flex items-center gap-2 mb-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">Relays</h3>
    </div>
    {#if unreachable || !metrics}
      <div class="space-y-1">
        <div class="text-2xl font-bold text-gray-300 dark:text-dark-border">--</div>
        <div class="text-xs text-gray-400 dark:text-dark-muted">Not available</div>
      </div>
    {:else}
      <div class="flex items-baseline gap-1 mb-2">
        <span class="text-2xl font-bold text-gray-800 dark:text-dark-text">{relayTotal ?? '--'}</span>
        <span class="text-xs text-gray-400 dark:text-dark-muted">total</span>
      </div>
      <div class="flex gap-3 text-sm">
        <span class="text-emerald-600 dark:text-emerald-400 font-medium">{relayOnline ?? '--'} online</span>
        <span class="text-red-500 dark:text-red-400 font-medium">{relayOffline ?? '--'} offline</span>
      </div>
    {/if}
  </div>

  <!-- Queue card -->
  <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-dark-border p-4 transition-colors duration-200">
    <div class="flex items-center gap-2 mb-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">Check Queue</h3>
    </div>
    {#if unreachable || !metrics}
      <div class="space-y-1">
        <div class="text-2xl font-bold text-gray-300 dark:text-dark-border">--</div>
        <div class="text-xs text-gray-400 dark:text-dark-muted">Not available</div>
      </div>
    {:else}
      <div class="flex items-baseline gap-1 mb-2">
        <span class="text-2xl font-bold text-gray-800 dark:text-dark-text">{queuePending ?? '--'}</span>
        <span class="text-xs text-gray-400 dark:text-dark-muted">pending</span>
      </div>
      <!-- Progress bar -->
      <div class="mb-1">
        <div class="flex justify-between text-xs text-gray-400 dark:text-dark-muted mb-1">
          <span>{queueCompleted ?? 0} done</span>
          <span>{progressPct}%</span>
        </div>
        <div class="w-full bg-gray-100 dark:bg-dark-border rounded-full h-1.5">
          <div
            class="bg-primary-600 h-1.5 rounded-full transition-all duration-500"
            style="width: {progressPct}%"
          ></div>
        </div>
      </div>
      <div class="text-xs text-gray-400 dark:text-dark-muted">{queueEnqueued ?? 0} enqueued total</div>
    {/if}
  </div>

  <!-- Publishing card -->
  <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-dark-border p-4 transition-colors duration-200">
    <div class="flex items-center gap-2 mb-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">Publishing</h3>
    </div>
    {#if unreachable || !metrics}
      <div class="space-y-1">
        <div class="text-2xl font-bold text-gray-300 dark:text-dark-border">--</div>
        <div class="text-xs text-gray-400 dark:text-dark-muted">Not available</div>
      </div>
    {:else}
      <div class="flex items-baseline gap-1 mb-2">
        <span class="text-2xl font-bold text-gray-800 dark:text-dark-text">
          {publishRate !== null ? formatPercent(publishRate) : '--'}
        </span>
        <span class="text-xs text-gray-400 dark:text-dark-muted">success rate</span>
      </div>
      <div class="text-sm text-gray-500 dark:text-dark-muted">
        {publishPending ?? '--'} pending
      </div>
    {/if}
  </div>

</div>
