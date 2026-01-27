<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { ArrowLeft, ArrowRight } from 'svelte-radix';
    export let tableInstance;
    export let totalCount: number | undefined = undefined;
    export let livenessCounts: { online: number; offline: number; dead: number } | null = null;
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
        <div class="flex float-right">
        {#if livenessCounts}
            <span class="text-xs flex items-center gap-1">
                <span class="text-green-500" title="online">{livenessCounts.online}</span>
                <span class="opacity-50">/</span>
                <span class="text-yellow-500" title="offline">{livenessCounts.offline}</span>
                <span class="opacity-50">/</span>
                <span class="text-red-500" title="dead">{livenessCounts.dead}</span>
            </span>
        {:else}
            <span class="text-xs">
                ({tableInstance?.allRows.length} / {totalCount || tableInstance?.baseRows.length})
            </span>
        {/if}
    </div>
    </div>

    
</div>
