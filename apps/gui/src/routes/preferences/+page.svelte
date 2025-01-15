<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { route66 } from '$lib/stores/route66.js';
    import { instance, destroy } from '$lib/utils/lifecycle.js';
    import { wipeCache } from '$lib/utils/cache.js';
	import type Route66 from '@nostrwatch/route66'
	import Stats from '$lib/components/layout/Stats.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

    let Nip66Instance: Route66 | null;

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        Nip66Instance = instance($route66);
    });
</script>
<div class="flex py-4 px-8">
    {#if Nip66Instance !== null}
    <Button on:click={wipeCache} variant="destructive">
    Wipe
    </Button>
    {/if}
</div>

<Stats />