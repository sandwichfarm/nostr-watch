<script lang="ts">
  import { onMount } from 'svelte';
  
  export let relays: any[] = [];
  export let loading = false;
  export let selectedCountry: string | null = null;
  export let hoveredCountry: string | null = null;
  
  let MapHeatComponent: any;
  let componentLoading = true;
  let componentError: Error | null = null;
  
  onMount(async () => {
    try {
      const module = await import('./MapHeat.svelte');
      MapHeatComponent = module.default;
      componentLoading = false;
    } catch (error) {
      componentError = error as Error;
      componentLoading = false;
      console.error('Failed to load heatmap component:', error);
    }
  });
</script>

{#if componentLoading}
  <div class="flex items-center justify-center h-[400px] bg-muted/10 rounded-lg">
    <div class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
      <p class="text-sm text-muted-foreground">Loading heatmap...</p>
    </div>
  </div>
{:else if componentError}
  <div class="flex items-center justify-center h-[400px] bg-destructive/10 rounded-lg">
    <div class="text-center">
      <p class="text-sm text-destructive">Failed to load heatmap component</p>
      <p class="text-xs text-muted-foreground mt-1">{componentError.message}</p>
    </div>
  </div>
{:else if MapHeatComponent}
  <svelte:component 
    this={MapHeatComponent} 
    {relays}
    {loading}
    bind:selectedCountry
    bind:hoveredCountry
  />
{/if}