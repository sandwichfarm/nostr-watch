<script lang="ts">
    import { page } from '$app/stores';
	import { onMount } from 'svelte';
    import { doBootstrap } from '$lib/stores/routines.js';
    export let params: { protocol: string; relay: string };

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(false);
    });
    
</script>
<br /><br /><br /><br /><br /><br /><br />
{params}
{$page.params.protocol}://{$page.params.relay}