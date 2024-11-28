<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import Stats from '$lib/components/blocks/Stats.svelte';
	import Console from '$lib/components/blocks/console/Console.svelte';

	import { bootstrapMonitorData, destroy } from '$lib/utils/lifecycle.js';
	export const prerender = true;

	let val: string='';

	onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        bootstrapMonitorData();
    });
	onDestroy(destroy);
</script>

<main>
	<Stats />
	<Console />
</main>