<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getHealthz } from '../lib/api.ts';
  import type { HealthState, HealthzResponse } from '../lib/types.ts';

  const POLL_INTERVAL_MS = 30_000;

  let health = $state<HealthzResponse | null>(null);
  let unreachable = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function fetchHealth(): Promise<void> {
    try {
      const result = await getHealthz();
      health = result;
      unreachable = false;
    } catch {
      health = null;
      unreachable = true;
    }
  }

  onMount(async () => {
    await fetchHealth();
    intervalId = setInterval(fetchHealth, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (intervalId !== null) clearInterval(intervalId);
  });

  function formatUptime(ms: number): string {
    if (!ms || ms < 0) return '0m';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
  }

  const statusConfig: Record<HealthState, { label: string; dot: string; text: string; bg: string }> = {
    up: {
      label: 'Online',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    degraded: {
      label: 'Degraded',
      dot: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    down: {
      label: 'Down',
      dot: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
  };

  const currentStatus = $derived(health ? statusConfig[health.status] : null);
</script>

<div class="sticky top-0 z-10 w-full shadow-sm border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card transition-colors duration-200">
  <div class="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 sm:gap-6">
    {#if unreachable}
      <div class="flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-gray-400 flex-shrink-0"></span>
        <span class="text-sm font-medium text-gray-500 dark:text-dark-muted">Not configured yet</span>
      </div>
    {:else if health && currentStatus}
      <div class="flex items-center gap-2 {currentStatus.bg} rounded-full px-3 py-0.5">
        <span class="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 {currentStatus.dot}"></span>
        <span class="text-sm font-semibold {currentStatus.text}">{currentStatus.label}</span>
      </div>
      <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-muted">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Up {formatUptime(health.uptime)}</span>
      </div>
      {#if health.reasons && health.reasons.length > 0}
        <div class="text-xs text-gray-400 dark:text-dark-muted truncate max-w-xs">
          {health.reasons[0]}
        </div>
      {/if}
    {:else}
      <!-- Loading skeleton -->
      <div class="flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-dark-border animate-pulse flex-shrink-0"></span>
        <span class="text-sm text-gray-400 dark:text-dark-muted">Connecting...</span>
      </div>
    {/if}

    <div class="ml-auto text-xs text-gray-300 dark:text-dark-border hidden sm:block">
      Relay Monitor
    </div>
  </div>
</div>
