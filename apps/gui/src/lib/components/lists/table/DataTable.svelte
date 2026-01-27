<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get, writable, derived, type Writable, type Readable } from 'svelte/store';
    import { DataTable } from '$lib/components/@Careswitch/svelte-data-table';
    import * as Resizable from '$lib/components/ui/resizable';
    import Filters from './Filters.svelte'; 
    import DataTableShowResults from './DataTableShowResults.svelte';
    import DataTablePaginator from './DataTablePaginator.svelte';
    import { applyFilters, createRelayFilters, type ConsoleFilter } from './filter-dom.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Table from '$lib/components/ui/table/index.js';
	import { StateManager } from '@nostrwatch/route66';
	import { getLeaderTabRpcClient } from '$lib/runtime/leader-tab-client';
	import { stateManagerSet, stateManagerStorageKey } from '$lib/runtime/state-manager-sync';
    
    import TableOptions from './TableOptions.svelte';
    import * as Popover from "$lib/components/ui/popover";
    import * as Tabs from "$lib/components/ui/tabs";
	import Button from '../../ui/button/button.svelte';
	import type { DataTableConfig } from './DataTableTypes';
	import { darkMode } from '$lib/stores/theme';
	import { randomLoadingMessage } from '$utils/ux';
	import Loading from '$lib/components/partials/Loading.svelte';

    export let dataKey: string;
    export let data: Readable<any[]>;
    export let config: Writable<DataTableConfig>;
    export let enableFilters: boolean = true;
    export let actionsComponent;

    export let sidebarPaneApi: Resizable.PaneApi | null = null;
    
    let resultsPerPage: number = $config?.pageSize || 50; 
    let keysEnable: string[];

    $: keysEnable = ($config.columnsShow?.length && $config.filtersShow?.length )? Array.from(new Set([...$config.columnsShow, ...$config.filtersShow])) : [];
    
    // **Stores and Reactive Variables**
    const filters = writable({});

    const tableData = derived(
        [data, config],
        ([ $data, $config ]) => {

            if (!$data || $data.length === 0) {
                return { data: [], columns: [] };
            }

            if($config.columnsShow.length === 0) {
                return { data: [], columns: [] };
            }

            const columns = $config.columnsShow.map((key: string) => ({
                id: key,
                key: key,
                name: $config.prettyNames?.[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
            }));

            return { data: $data, columns };
        }
    );
    

    const filteredTableData = derived(
        [tableData, filters],
        ([$tableData, $filters]) => {
            if (!$tableData.data || !$tableData.columns || $tableData.columns.length === 0) {
                return { data: [], columns: [] };
            }
            const currentRelayFilters: ConsoleFilter[] = createRelayFilters($tableData.data, $config.filtersShow, $config.prettyNames);
            const filteredData = applyFilters($tableData.data, $filters, currentRelayFilters);
            return { data: filteredData, columns: $tableData.columns };
        }
    );

    let tableInstance: DataTable<any> | null = null;

    // **Global Filter Reactive Variable**
    let globalFilter = '';

    // **Event Handler for Global Filter Input**
    function handleGlobalFilterChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        globalFilter = value;
        if (tableInstance) {
            tableInstance.globalFilter = value;
        }
    }

    const rowStyles = derived(
        tableData,
        ($tableData) => {
            if (!$tableData.data || !$tableData.columns || $tableData.columns.length === 0 || !$config.tableRowStyler) {
                return new Map();   
            }
            const map: Map<string, string> = new Map();
            $tableData.data.forEach((row: any) => {
                map.set(row.id, $config.tableRowStyler(row));
            });
            return map
        }
    );

    $: {
        if (tableInstance) {
            (tableInstance as DataTable<any>).baseRows = $filteredTableData.data;
        }
    }

    const createTable = (force: boolean = false) => {
        const tableInstanceConfig: any = {
            pageSize: $config.pageSize,
            columns: $filteredTableData.columns,
            data: $filteredTableData.data,
            dataFormatters: $config.dataFormatters,
        }

        if($config?.sortState) {
            if($config.sortState?.columnId) {
                tableInstanceConfig.initialSort = $config.sortState.columnId
            }
            if($config.sortState?.direction) {
                tableInstanceConfig.initialSortDirection = $config.sortState.direction
            }
        }

        // //console.log(`Creating DataTable instance with ${$filteredTableData.data.length} rows.`, tableInstanceConfig);
        if ($filteredTableData && $filteredTableData.columns && $filteredTableData.columns.length) {
            if(tableInstance === null || force){
                // //console.log('Creating DataTable instance due to data.');
                tableInstance = new DataTable<any>(tableInstanceConfig);
                // //console.log('tableInstance', tableInstance)
            }
        } else {
            if (tableInstance) {
                // //console.log('Destroying DataTable instance due to no data.');
                tableInstance = null;
            }
        }
    }

    const cachableConfig = (config: DataTableConfig) => {
        const cachable: Partial<DataTableConfig> = { ...config };
        delete cachable.tableFormatters;
        delete cachable.filterFormatters;
        delete cachable.tableRowStyler;
        return cachable;
    }

    // **DataTable Subscription**
    onMount(async (): Promise<any> => {
        let suppressPersist = false;
        const TABLE_CONFIG_KEY = `preferences:${dataKey}:tableConfig`;

        const applyRemoteConfig = (next: any) => {
            if (!next || typeof next !== 'object') return;
            suppressPersist = true;
            config.update((current) => ({ ...current, ...next }));
            queueMicrotask(() => {
                suppressPersist = false;
            });
        };

        const onStorage = (event: StorageEvent) => {
            if (event.key !== stateManagerStorageKey(TABLE_CONFIG_KEY)) return;
            try {
                const next = StateManager.get(TABLE_CONFIG_KEY);
                applyRemoteConfig(next);
            } catch {}
        };

        window.addEventListener('storage', onStorage);

        let stopBroadcast: (() => void) | null = null;
        try {
            stopBroadcast = getLeaderTabRpcClient().onBroadcast((msg) => {
                if (msg.kind !== 'state.stateManager') return;
                const data = msg.data as any;
                if (data?.key !== TABLE_CONFIG_KEY) return;
                applyRemoteConfig(data?.value);
            });
        } catch {}

        const unsubConfig = config.subscribe( (newConfig: DataTableConfig) => {
            if(resultsPerPage !== newConfig.pageSize) {
                resultsPerPage = newConfig.pageSize;
            }
            if (!suppressPersist) {
                void stateManagerSet(TABLE_CONFIG_KEY, cachableConfig(newConfig));
            }
            if(!newConfig?.availableColumnKeys || newConfig.availableColumnKeys?.length === 0) {
                newConfig.availableColumnKeys = [ 
                    ...(newConfig.columnsShow.filter(key => !newConfig.columnsDisable.includes(key))),
                ]
            }
            if(!newConfig?.availableFilterKeys || newConfig.availableFilterKeys?.length === 0) {
                newConfig.availableFilterKeys = [ 
                    ...(newConfig.filtersShow.filter(key => !newConfig.filtersDisable.includes(key))),
                ]
            }
        })
        const unsubTableConfig = config.subscribe( () =>  setTimeout( () => createTable(true), 10 ) );
        while($filteredTableData.data.length === 0) {
            await new Promise(r => setTimeout(r, 100));
        }
        createTable();
        if($config.sidebarCollapsed){
            sidebarPaneApi?.collapse();
        }
        return () => {
            unsubConfig();
            // unsubTableConfig();
            if (tableInstance) {
                tableInstance = null;
            }
            stopBroadcast?.();
            window.removeEventListener('storage', onStorage);
        };
    });

    // filters.subscribe((newFilters: any) => {
    //     ////console.log('Filters updated', newFilters);
    //     config.update( (currentConfig: DataTableConfig) => {
    //         currentConfig.activeFilters = newFilters;
    //         return currentConfig;
    //     });
    // });

    function clearAllFilters() {
        filters.set({});
    }

    $: isCollapsed = $config?.sidebarCollapsed || false;
    $: activeFilters = Object.keys($filters || {}).length

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

</script>
<!-- <pre>{JSON.stringify($config.filtersShow, null, 2)}</pre> -->

<!-- **UI Layout with Resizable Panes** -->
<Resizable.PaneGroup direction="horizontal" class="min-h-[100%] !overflow-visible">
    <!-- **Main Table Pane** -->
    <Resizable.Pane defaultSize={75} class="!overflow-visible">
        {#if tableInstance !== null}
            <div class="px-4 shadow-md my-4">
                <!-- **Search Input for Global Filtering** -->
                <Input
                    type="text"
                    placeholder="search"
                    class="lowercase font-mono md:ml-auto md:max-w-[300px] inline-block float-right"
                    bind:value={globalFilter}
                    on:input={handleGlobalFilterChange}
                />

                <DataTableShowResults {config}  />
                <DataTablePaginator {tableInstance} />
                <Popover.Root>
                    <Popover.Trigger class="text-lg inline-block ml-2 relative -top-1">
                        <Badge variant="secondary" class="cursor-pointer text-sm">Columns</Badge>
                    </Popover.Trigger>
                    <Popover.Content class="z-[5999] mt-3 min-w-[600px] backdrop-blur-md bg-black/50">
                        <Tabs.Root value="visiblity" class="">
                            <Tabs.List>
                                <Tabs.Trigger value="visiblity">Visiblity</Tabs.Trigger>
                                <Tabs.Trigger value="order">Order</Tabs.Trigger>
                            </Tabs.List>
                            <Tabs.Content value="visiblity"  class="py-4 px-8">
                                <TableOptions {config} {dataKey} />
                            </Tabs.Content>
                            <Tabs.Content value="order" class=" bg-white/20 dark:bg-black/20">
                                coming soon...
                            </Tabs.Content>
                        </Tabs.Root>
                    </Popover.Content>
                </Popover.Root>

                <!-- **Data Table Structure** -->
                <Table.Root>
                    <Table.Header>
                        <Table.Row class="bg-background">
                            {#if actionsComponent}
                            <svelte:component this={actionsComponent} view='head' />
                            {/if}
                            {#each tableInstance?.columns as column (column.id)}
                                <Table.Head class="sticky top-[42px] z-10 bg-background">
                                    <button
                                        class="flex items-center"
                                        on:click={() => { 
                                            if(tableInstance) {
                                                tableInstance.toggleSort(column.id) 
                                                config.update( (currentConfig: DataTableConfig) => {
                                                    if(tableInstance?.sortState){
                                                        currentConfig.sortState = tableInstance.sortState
                                                    }
                                                    return currentConfig;
                                                })
                                            }
                                        }}
                                        disabled={!tableInstance?.isSortable(column.id)}
                                    >
                                        {column.name}
                                        {#if tableInstance?.isSortable(column.id)}
                                            <span class="ml-2">
                                                {#if tableInstance.getSortState(column.id) === 'asc'}
                                                    ↑
                                                {:else if tableInstance.getSortState(column.id) === 'desc'}
                                                    ↓
                                                {:else}
                                                    ⇕
                                                {/if}
                                            </span>
                                        {/if}
                                    </button>
                                </Table.Head>
                            {/each}
                           
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each tableInstance?.rows as row, rowIndex (`${row.id ?? ''}:${rowIndex}`)}
                            <Table.Row 
                                class="{$rowStyles.get(row.pubkey)}" 
                                style="{
                                    $config.rowBannerEnabled !== false && row.banner
                                        ? 
                                            $darkMode
                                                ? 
                                                    `background: linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)),  url('${row.banner}'); 
                                                    background-repeat: no-repeat; 
                                                    background-size: cover;`
                                                :
                                                    `background: linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.8)),  url('${row.banner}'); 
                                                    background-repeat: no-repeat; 
                                                    background-size: cover;`
                                            
                                        : ''
                                }"
                                >
                                {#if actionsComponent}
                                    <svelte:component this={actionsComponent} data={row} />
                                {/if}
                                {#each tableInstance?.columns as column (column.id)}
                                    {#if column.id === 'status'}
                                        <Table.Cell>
                                            <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
                                                {row.status === 'active' ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </Table.Cell>
                                    {:else}
                                        <Table.Cell class="font-mono">
                                            <div class="max-w-full truncate">
                                                {#if $config.tableFormatters?.[column.key]}
                                                    {@html $config.tableFormatters[column.key](row[column.key], row)}
                                                {:else}
                                                    {@html row[column.key]}
                                                {/if}
                                            </div>
                                        </Table.Cell>
                                    {/if}
                                {/each}
                                        
                            </Table.Row>
                        {/each}
                    </Table.Body>
                </Table.Root>

                <DataTableShowResults />
                <DataTablePaginator {tableInstance} />
            </div>
        {:else}
            <Loading />
        {/if}
    </Resizable.Pane>
    <Resizable.Handle withHandle />
    <!-- **Filters Pane** -->
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
                <Button class="rounded-l-none display-inline bg-black/5 dark:bg-white/5 text-white/80 hover:bg-white/15 dark:bg-black/15 text-white/90" on:click={toggleSidebarPane()}>
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
                {#if tableInstance !== null && enableFilters}
                    <Filters 
                        {dataKey}
                        {tableData} 
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
