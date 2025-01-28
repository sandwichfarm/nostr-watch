<script lang="ts">
    import { page } from "$app/stores";
    import Button from "$ui/button/button.svelte";
    import { writable, type Writable } from "svelte/store";
    import type { DataViewMapViews, DataViewViews } from "../DataTableTypes";
    
    export let enabledViews: DataViewMapViews[] | undefined = ['bubble'];
    export const activeView: Writable<DataViewMapViews> = writable(enabledViews.length===0? 'bubble': enabledViews[0]);
</script>


{#if enabledViews && enabledViews.length > 1}
<div class="flex flex-row ml-3 opacity-70 my-5">
    <span class="py-1 px-2 text-sm italic">Map Type</span>
    
    {#if enabledViews.includes('bubble')}
        <button 
            on:click={() => activeView.set('bubble')}
            class="dimension-link {$activeView === 'bubble'? 'dimension-link-active': ''}">
            Bubble
        </button>
    {/if}

    {#if enabledViews.includes('markers')}
        <button 
            on:click={() => activeView.set('markers')}
            class="dimension-link {$activeView === 'markers'? 'dimension-link-active': ''}">
            Markers
        </button>
    {/if}

    {#if enabledViews.includes('heatmap')}
        <button 
            on:click={() => activeView.set('heatmap')}
            class="dimension-link {$activeView === 'heatmap'? 'dimension-link-active': ''}">
            Heatmap
        </button>
    {/if}

    {#if enabledViews.includes('choropleth')}
        <button 
            on:click={() => activeView.set('choropleth')}
            class="dimension-link {$activeView === 'choropleth'? 'dimension-link-active': ''}">
            Choropleth
        </button>
    {/if}

</div>
{/if}

<style lang="postcss">

	.dimension-link {
		@apply py-1 px-2 ml-3 text-sm rounded-sm bg-black/5 dark:bg-white/5 hover:bg-white/20;
	}

    .dimension-link-active {
        @apply py-1 px-2 ml-3 rounded-sm bg-white/20 dark:bg-black/20;
    }
</style>