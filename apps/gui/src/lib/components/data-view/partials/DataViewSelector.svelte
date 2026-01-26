<script lang="ts">
	import { page } from "$app/stores";
	import Button from "$ui/button/button.svelte";
	import { writable, type Writable } from "svelte/store";
	import type { DataViewViews } from "../DataTableTypes";

    export let enabledViews: DataViewViews[] | undefined = ['table'];
    export const activeView: Writable<DataViewViews> = writable(enabledViews.length===1? enabledViews[0]: 'table');
</script>

{#if enabledViews && enabledViews.length > 1}
<div class="flex flex-row ml-3 opacity-70">
    <span class="py-1 pr-1 text-sm italic">View</span>
    {#if enabledViews.includes('table')}
        <button 
            on:click={() => activeView.set('table')}
            class="dimension-link {$activeView === 'table'? 'dimension-link-active': ''}">
                Table
        </button>
    {/if}

    {#if enabledViews.includes('grid')}
        <button 
            on:click={() => activeView.set('grid')}
            class="dimension-link {$activeView === 'grid'? 'dimension-link-active': ''}">
            Grid
        </button>
    {/if}

    {#if enabledViews.includes('map')}
        <button 
            on:click={() => activeView.set('map')}
            class="dimension-link {$activeView === 'map'? 'dimension-link-active': ''}">
            Map
        </button>
    {/if}

</div>
{/if}

<style lang="postcss">

	.dimension-link {
		@apply pr-1 px-2 ml-3 text-sm rounded-sm bg-black/5 dark:bg-white/5 hover:bg-white/20;
	}

    .dimension-link-active {
        @apply py-1 px-2 ml-3 rounded-sm bg-white/20 dark:bg-black/20;
    }
</style>