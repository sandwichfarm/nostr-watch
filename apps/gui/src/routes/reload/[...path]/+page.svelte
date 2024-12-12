<script lang="ts">
//unconventional: forces onmount, 10000x simpler. Forcing onmount should be native. 
import { page } from '$app/stores';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
onMount( () => setTimeout( () => goto(`/${$page.params.path}`), 50 ) );
</script>