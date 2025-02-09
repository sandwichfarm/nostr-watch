<script lang="ts">
    import { tweened } from 'svelte/motion';
    import { cubicOut, expoOut } from 'svelte/easing';
    import ActivityList from "$lib/components/partials/ActivityList.svelte";
    import type { ActivityItem } from "$stores/activity";
  
    // These are props from your parent.
    export let isReady: boolean;
    export let monitorsSynced: boolean;
    export let relayChecksSynced: boolean;
    // The external target value for the progress (e.g., 0, 50, 80, 100)
    export let percentCompleted: number = 0;
  
    // Create a tweened store starting at 0.
    // Adjust the duration if you want a faster/slower animation.
    const progress = tweened(0, { duration: 2000, easing: expoOut });
  
    // When percentCompleted changes, update the tweened store.
    // The tweened store will animate smoothly from its current value
    // to the new target (percentCompleted) using cubicOut easing.
    $: progress.set(percentCompleted);
  
    let activities: ActivityItem[] = [];
  </script>
  
  <div class="flex flex-col items-center justify-center h-screen px-4">
    <div class="text-7xl mb-3">booting.</div>
    <div>
      <h4 class="sr-only">Status</h4>
      <div class="mt-6" aria-hidden="true">
        <div class="overflow-hidden rounded-full bg-black/10 dark:bg-white/20">
          <!-- Use the tweened value ($progress) for the animated width -->
          <div class="h-2 rounded-full bg-purple-700" style="width: {$progress}%"></div>
        </div>
        {Math.round($progress)}% <!-- Optional: display the tweened number -->
        <div class="mt-6 hidden grid-cols-3 text-sm font-medium text-gray-600 sm:grid">
          <div class="{isReady ? 'text-purple-700' : ''}">Loading Assets</div>
          <div class="{isReady && monitorsSynced ? 'text-purple-700' : ''}">Syncing Monitors</div>
          <div class="{isReady && relayChecksSynced ? 'text-purple-700' : ''}">Syncing Relay checks</div>
        </div>
      </div>
    </div>
    <div class="h-[400px] pt-36">
      {#if isReady}
        <ActivityList bind:activities />
      {/if}
    </div>
  </div>
  