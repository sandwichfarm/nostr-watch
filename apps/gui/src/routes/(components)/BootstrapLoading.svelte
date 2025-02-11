<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { expoOut } from 'svelte/easing';
  import ActivityList from "$lib/components/partials/ActivityList.svelte";
  import type { ActivityItem } from "$stores/activity";
  import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

  export let isReady: boolean;
  export let monitorsSynced: boolean;
  export let relayChecksSynced: boolean;
  export let percentCompleted: number = 0;
  export let activities: ActivityItem[] = [];

  const progress = tweened(0, { duration: 500, easing: expoOut });

  $: {
    progress.set(percentCompleted);
  }

  // percentCompleted.subscribe(value => {
  //   console.log("percentCompleted updated:", value);
  //   progress.set(value);
  // });

  // onMount(() => {
  //   setTimeout(() => { percentCompleted = 25; }, 1000);
  //   setTimeout(() => { percentCompleted = 50; }, 2000);
  //   setTimeout(() => { percentCompleted = 75; }, 3000);
  //   setTimeout(() => { percentCompleted = 100; }, 4000);
  // });
</script>

<div class="flex flex-col items-center justify-center h-screen px-4">
  <div class="text-7xl mb-3">booting.</div>
  <div>
    <h4 class="sr-only">Status</h4>
    <div class="mt-6" aria-hidden="true">
      <div class="overflow-hidden rounded-full bg-black/10 dark:bg-white/20">
        <!-- Animated width using the tweened store -->
        <div class="h-2 rounded-full bg-purple-700" style="width: {$progress}%"></div>
      </div>
      {Math.round($progress)}%
      <div class="mt-6 hidden grid-cols-3 text-sm font-medium text-gray-600 sm:grid">
        <div class="{isReady ? 'text-purple-700' : ''}">Loading Assets</div>
        <div class="{isReady && monitorsSynced ? 'text-purple-700' : ''}">Syncing Monitors</div>
        <div class="{isReady && percentCompleted === 100 ? 'text-purple-700' : ''}">Syncing Relay checks</div>
      </div>
    </div>
  </div>
  <div class="h-[400px] pt-36">
    {#if isReady}
      <ActivityList bind:activities />
    {/if}
  </div>
</div>
