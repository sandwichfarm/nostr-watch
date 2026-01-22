<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { expoOut } from 'svelte/easing';
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import { bootActivities, bootProgress } from "$stores/boot-activity";

  export let isReady: boolean;

  const progress = tweened(0, { duration: 500, easing: expoOut });

  $: {
    progress.set($bootProgress);
  }

  // Get the current activity index for visual effects
  $: currentIndex = $bootActivities.findIndex(item => !item.complete);
  $: if (currentIndex === -1 && $bootActivities.length > 0) {
    currentIndex = $bootActivities.length - 1;
  }

  const getOpacity = (index: number) => {
    const distance = Math.abs(index - currentIndex);
    const maxDistance = 5;
    if (distance > maxDistance) return 0;
    return 1 - distance / maxDistance;
  };
</script>

<style>
  .activity-item {
    transition: opacity 0.5s, transform 0.5s;
  }
</style>

<div class="flex flex-col items-center justify-center h-screen px-4">
  <div class="text-7xl mb-3">booting.</div>
  <div>
    <h4 class="sr-only">Status</h4>
    <div class="mt-6" aria-hidden="true">
      <div class="overflow-hidden rounded-full bg-black/10 dark:bg-white/20">
        <div class="h-2 rounded-full bg-purple-700" style="width: {$progress}%"></div>
      </div>
      {Math.round($progress)}%
      <div class="mt-6 hidden grid-cols-4 text-sm font-medium text-gray-600 sm:grid">
        <div class="{isReady ? 'text-purple-700' : ''}">Loading Assets</div>
        <div class="{$bootActivities.find(a => a.slug === 'seed:monitors')?.complete ? 'text-purple-700' : ''}">Loading Monitors</div>
        <div class="{$bootActivities.find(a => a.slug === 'seed:checks')?.complete ? 'text-purple-700' : ''}">Loading Checks</div>
        <div class="{$bootActivities.find(a => a.slug === 'seed:nip11s')?.complete ? 'text-purple-700' : ''}">Loading NIP-11s</div>
      </div>
    </div>
  </div>
  <div class="h-[400px] pt-36">
    {#if $bootActivities.length > 0}
      <div class="">
        {#each $bootActivities as item, index (item.slug)}
          <div
            class="flex items-center space-x-4 activity-item"
            style="
              opacity: {getOpacity(index)};
              transform: translateY({(index - currentIndex) * 20}px);
            "
          >
            {#if !item.complete}
              <!-- Loading Indicator -->
              <svg class="w-6 h-6 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            {:else}
              <!-- Checkmark Icon -->
              <svg class="w-6 h-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            {/if}
            <span class="text-white text-lg">{item.text}</span>
            {#if item.value}
              <Badge variant="outline">{item.value}</Badge>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
