<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { ArrowLeft, ArrowRight } from 'svelte-radix';
    export let tableInstance;
    export let totalCount: number | undefined = undefined;
</script>

<div class="inline-block font-mono">
        
    <div class="flex items-center gap-2">
        <div class="flex items-center gap-0">
            <Button
                size="icon"
                variant="ghost"
                disabled={!tableInstance?.canGoBack}
                on:click={() => { if(tableInstance) return tableInstance.currentPage-- } }
            >
                <ArrowLeft class="h-5 w-5" />
            </Button>
            <Button
                size="icon"
                variant="ghost"
                disabled={!tableInstance?.canGoForward}
                on:click={() => { if(tableInstance) return tableInstance.currentPage++ } }
            >
                <ArrowRight class="h-5 w-5" />
            </Button>
        </div>
        <p class="text-sm">
            page <span class="font-semibold">{tableInstance?.currentPage}</span> of
            <span class="font-semibold">{tableInstance?.totalPages}</span>
        </p>
        {#if typeof totalCount === 'number' && tableInstance?.allRows?.length !== totalCount}
            <span class="text-xs opacity-60">
                (showing {tableInstance?.allRows.length} / {totalCount})
            </span>
        {/if}
    </div>

    
</div>
