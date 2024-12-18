<script lang="ts">
    import { activity, type ActivityItem } from '$lib/stores/activity.js';
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';
	import Badge from '../ui/badge/badge.svelte';
    
    let activities: ActivityItem[] = [];
    const unsubscribe = activity.subscribe($activity => {
        activities = Array.from($activity.values()).sort((a, b) => a.index - b.index);
    });
    
    onDestroy(() => {
        unsubscribe();
    });

    $: currentIndex = activities.findIndex(item => !item.complete);
    $: if (currentIndex === -1 && activities.length > 0) {
        currentIndex = activities.length - 1;
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

<div class="">
    {#each activities as item, index (item.slug)}
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
