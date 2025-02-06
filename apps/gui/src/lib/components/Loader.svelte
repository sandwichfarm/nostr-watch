<script lang="ts">
    import { onMount } from 'svelte';
    import { writable, type Writable } from 'svelte/store';
  
    // The URL of the module to load. This can be an arbitrary URL.
    export let path: string;
  
    const loading: Writable<boolean> = writable(true);
    const error: Writable<boolean> = writable(false);
    let component: any = null;
  
    async function dynamicImport(moduleUrl: string) {
      const response = await fetch(moduleUrl);
      if (!response.ok) {
        throw new Error(`Failed to load module: ${response.status} ${response.statusText}`);
      }
      const code = await response.text();
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      try {
        return await import(/* @vite-ignore */ blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }
  
    onMount(async () => {
      try {
        const mod = await dynamicImport(path);
        component = mod.default;
      } catch (err) {
        console.error("Error loading module:", err);
        error.set(true);
      } finally {
        loading.set(false);
      }
    });
  </script>
  
  {#if $loading}
    {#if $error}
      Failed to load component.
    {:else}
      Loading...
    {/if}
  {:else}
    <svelte:component this={component} />
  {/if}
  