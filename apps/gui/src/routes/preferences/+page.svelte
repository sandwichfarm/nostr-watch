<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { nip66 } from '$lib/stores/nip66.js';
    import { instance, destroy } from '$lib/utils/lifecycle.js';
    import { wipeCache } from '$lib/utils/cache.js';
	import type Nip66 from '@nostrwatch/nip66'

    let Nip66Instance: Nip66 | null;

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        Nip66Instance = instance($nip66);
    });
</script>


<br /><br /><br /><br /><br /><br />
{#if Nip66Instance !== null}
<button on:click={wipeCache}>
Wipe
</button>
{/if}