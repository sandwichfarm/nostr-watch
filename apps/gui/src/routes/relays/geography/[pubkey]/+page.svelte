<script lang="ts">
    export const prerender = false;

    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { derived, writable } from 'svelte/store';
    import { instance } from '$lib/utils/lifecycle';
    import type Route66 from '@nostrwatch/route66';

    let loading = true;
    let error = false;

    // Get pubkey from route params
    $: pubkey = $page.params.pubkey;

    let route66Instance: Route66 | null = null;
    const events = writable<Set<any>>(new Set());

    onMount(async () => {
        try {
            // Use the shared route66 instance instead of creating a new one
            route66Instance = await instance();
            await route66Instance.ready();

            // Fetch monitor data using the shared cache
            const _monitorData = await route66Instance.adapters?.cacheAdapter?.REQ([
                { authors: [pubkey], kinds: [] }
            ]);

            if (_monitorData) {
                events.set(new Set(_monitorData));
            }

            loading = false;
        } catch (err) {
            console.error('Error loading geography data:', err);
            loading = false;
            error = true;
        }
    });

    $: if (error) {
        goto('/404');
    }
</script>

{#if loading}
    <div class="flex items-center justify-center h-64">
        <span class="text-muted-foreground">Loading...</span>
    </div>
{:else if error}
    <div class="flex items-center justify-center h-64">
        <span class="text-destructive">Error loading data</span>
    </div>
{:else}
    <div class="p-4">
        <h1 class="text-2xl font-bold mb-4">Geography: {pubkey}</h1>
        <p class="text-muted-foreground">Events loaded: {$events.size}</p>
    </div>
{/if}
