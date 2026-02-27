<script lang="ts">
  import { allEnabledMonitorsOffline, monitorsChecked, monitorsMap, monitorsMapFromCache } from '$lib/stores/monitors';
  import { Button } from '$lib/components/ui/button';
  import { goto } from '$app/navigation';
  import { instance } from '$lib/utils/lifecycle';
  import { fade } from 'svelte/transition';

  let dismissed = false;
  let fixing = false;

  $: visible = !dismissed && $monitorsChecked && $allEnabledMonitorsOffline;

  async function autoFix() {
    fixing = true;
    try {
      const $route66 = await instance();
      await $route66.ready();
      const monitorService = $route66.services?.monitors;
      if (!monitorService) return;
      for (const monitor of monitorService.enabledMonitors) {
        try { monitor.disable(); } catch { monitor.enabled = false; }
      }
      monitorService.maybeEnableMonitors();
      monitorsMap.set(monitorsMapFromCache());
    } catch (e) {
      console.error('[MonitorsBanner] auto-fix failed:', e);
    } finally {
      fixing = false;
      dismissed = true;
    }
  }

  function goToMonitors() {
    dismissed = true;
    goto('/monitors');
  }
</script>

{#if visible}
<div transition:fade={{ duration: 150 }}
     class="sticky top-10 z-[9500] bg-destructive/90 text-destructive-foreground px-4 py-3 flex items-center justify-between gap-4">
  <span class="text-sm font-medium">
    All of your enabled monitors are offline. Relay data may be stale or unavailable.
  </span>
  <div class="flex gap-2 shrink-0">
    <Button variant="secondary" size="sm" on:click={autoFix} disabled={fixing}>
      {fixing ? 'Fixing...' : 'Fix it for me'}
    </Button>
    <Button variant="outline" size="sm" on:click={goToMonitors}>
      Select new monitors
    </Button>
    <button class="ml-1 opacity-60 hover:opacity-100" on:click={() => dismissed = true} aria-label="Dismiss">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</div>
{/if}
