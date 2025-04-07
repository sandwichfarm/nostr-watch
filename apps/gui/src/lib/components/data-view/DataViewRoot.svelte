<script lang="ts">
    import { isBootstrapping, isSeeded } from "$stores/app";
    import { onMount } from 'svelte';
    import { get, writable, derived, type Writable, type Readable, readable } from 'svelte/store';
    import * as Resizable from '$lib/components/ui/resizable';
    import Filters from './filters/DataViewFilters.svelte'; 
    import { applyFilters, createRelayFilters, type ConsoleFilter } from './filters/filter-dom.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import DataTable from '$lib/components/data-view/table/DataTable.svelte';

	import Button from '$lib/components/ui/button/button.svelte';
	import type { DataTableConfig } from './DataTableTypes.svelte';
	import type { DataViewColumns, DataViewData, DataViewViews } from './DataTableTypes';
	import DataViewSelector from './partials/DataViewSelector.svelte';
	import MapBasic from './map/MapBasic.svelte';
	import MapRoot from './map/MapRoot.svelte';

    export let data: Readable<any[]>;
    export let config: Writable<DataTableConfig>;
    export let enableFilters: boolean = true;
    export let key: string;
    export let enabledViews: DataViewViews[] = ['table'];
    export let onFilterChange: (config: DataTableConfig) => void = (config) => {};
    export let actionsComponent: any | undefined = undefined;

    export let sidebarPaneApi: Resizable.PaneApi | null = null;
    
    let keysEnable: string[];

    $: keysEnable = ($config.columnsShow?.length && $config.filtersShow?.length )? Array.from(new Set([...$config.columnsShow, ...$config.filtersShow])) : [];
    
    // **Stores and Reactive Variables**
    const filters = writable({});

    let dataExtended: Readable<DataViewData> = readable({ data: [], columns: [] });
    let filteredData: Readable<{data: any[]; columns: any[] }> = readable({ data: [], columns: [] });
    let justData: Readable<any[]> = readable([]);
    let justColumns: Readable<any[]>  = readable([]);

    onMount(async (): Promise<any> => {
        dataExtended = derived(
            [data, config],
            ([ $data, $config ]) => {

                if (!$data || $data.length === 0) {
                    return { data: [], columns: [] };
                }

                if($config.columnsShow.length === 0) {
                    return { data: [], columns: [] };
                }

                const columns: DataViewColumns[] = $config.columnsShow.map((key: string) => ({
                    id: key,
                    key: key,
                    name: $config.prettyNames?.[key]?.short ?? key.charAt(0).toUpperCase() + key.slice(1),
                }));

                return { data: $data, columns };
            }
        );

        filters.subscribe((newFilters: any) => {
            config.update( (currentConfig: DataTableConfig) => {
                if(currentConfig.filtersActive === newFilters) return currentConfig;
                const newConfig = { ...currentConfig };
                newConfig.filtersActive = newFilters;
                return newConfig;
            });
        });
        
        filteredData = derived(
            [dataExtended, filters],
            ([$dataExtended, $filters]) => {
                if (!$dataExtended.data || !$dataExtended.columns || $dataExtended.columns.length === 0) {
                    return { data: [], columns: [] };
                }
                const currentRelayFilters: ConsoleFilter[] = createRelayFilters($dataExtended.data, $config.filtersShow, $config.prettyNames);
                const filteredData = applyFilters($dataExtended.data, $filters, currentRelayFilters);
                return { data: filteredData, columns: $dataExtended.columns };
            }
        );

        justData = derived(filteredData, $filteredData => $filteredData.data);
        justColumns = derived(filteredData, $filteredData => $filteredData.columns);

        if($config.sidebarCollapsed){
            setTimeout(() => sidebarPaneApi.collapse(), 1);
        }
        
    });

    function clearAllFilters() {
        filters.set({});
    }

    const toggleSidebarPane = () => {
        if(isCollapsed) {
            sidebarPaneApi.expand()
        }
        else {
            sidebarPaneApi.collapse()
        }
        config.update( (currentConfig: DataTableConfig) => {
            currentConfig.sidebarCollapsed = !isCollapsed;
            return currentConfig;
        })
    }

    $: isCollapsed = $config?.sidebarCollapsed || false;
    $: activeFilters = Object.keys($filters || {}).length

    export let activeView: Writable<'table' | 'grid' | 'map'>;

    let loading = false 
</script>

<DataViewSelector {enabledViews} bind:activeView />

<Resizable.PaneGroup direction="horizontal" class="min-h-[100%]">

    <Resizable.Pane defaultSize={75}>
        {#if $filteredData && $justData?.length && $justColumns?.length}
            {#if $activeView === 'table'}
                <DataTable dataKey={key} {config} data={justData} columns={justColumns} {sidebarPaneApi} dataUnfilteredLength={$justData?.length} {actionsComponent} />
            {/if}

            {#if $activeView === 'grid'}
                <div>Grid</div>
            {/if}

            {#if $activeView === 'map'} 
                <MapRoot data={justData} {filters} />
            {/if}
        {:else if $isBootstrapping && !$isSeeded}
            <div class="flex flex-col items-center justify-center h-screen px-4">
                <span class="text-5xl">bootstrapping</span>
                <span class="text-xl">the application is still bootstrapping, please wait while seed data is populated.</span>
            </div>
        {/if}
    
    </Resizable.Pane>
    <Resizable.Handle withHandle />

    <Resizable.Pane 
        class="min-h-[100%]"
        defaultSize={25} 
        collapsedSize={5} 
        collapsible={true}  
        onExpand={()=>{}} 
        onCollapse={()=>{}} 
        onResize={()=>{}} 
        bind:pane={sidebarPaneApi}
        > <!----->

            {#if sidebarPaneApi}
                <Button 
                    class="rounded-l-none display-inline bg-black/5 dark:bg-white/5 text-white/80 hover:bg-white/15 dark:bg-black/15 text-white/90" 
                    on:click={() => toggleSidebarPane()}>
                    {#if isCollapsed}
                    ⭅
                    {:else}
                    ⭆
                    {/if}
                </Button>    

            {/if}

            {#if isCollapsed}
                {#if activeFilters > 0}
                <Badge class="clear-left py-2 inline-block text-white/80 rounded-full" variant="destructive">
                    {activeFilters}
                </Badge>
                {/if}
            {:else}
                {#if $data?.length && enableFilters}
                    <Filters 
                        bind:onFilterChange
                        dataKey={key}
                        {dataExtended} 
                        {filters} 
                        {config}
                    />
                {/if}
            {/if}
          
    </Resizable.Pane>
</Resizable.PaneGroup>

<style lang="postcss" global>
    .active-filter {
        background-color: #e0e0e0;
        padding: 0.5rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    /* Optional: Add styles for filter buttons */
    .filter-mode-toggle button.active {
        /* Example active state styles */
        background-color: #3182ce;
        color: white;
    }
    /* Optional: Style the more-link */
    .more-link {
        color: #3182ce;
        cursor: pointer;
        text-decoration: underline;
    }

    body .data-[state=active]:bg-background[data-state="active"] {
        @apply !bg-black/10 dark:bg-white/10;
    }
</style>
