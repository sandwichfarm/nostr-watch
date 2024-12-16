<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get, writable, derived, type Writable } from 'svelte/store';
    import { DataTable } from '@careswitch/svelte-data-table';
    import * as Resizable from '$lib/components/ui/resizable';
    import Filters from './Filters.svelte'; 
    import DataTableShowResults from '$lib/components/partials/DataTableShowResults.svelte';
    import DataTablePaginator from '$lib/components/partials/DataTablePaginator.svelte';
    import { resultsPerPage } from '$lib/stores/datatable-settings';
    import { applyFilters, createRelayFilters, type ConsoleFilter } from '$lib/utils/filter-dom.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Table from '$lib/components/ui/table/index.js';
	import { StateManager } from '@nostrwatch/nip66';
	import type { Formatters } from 'src/lib/config/dataTable/monitors';
    import TableOptions from './TableOptions.svelte';

    import * as Tabs from '$lib/components/ui/tabs/index.js';

    export let tableKey: string;
    export let data: any;
    export let config: Writable<any>;
    export let enableFilters: boolean = true;
    export let actionsComponent;

    let sidebarPaneApi: Resizable.PaneApi | null = null;

    type DataTableConfig = { 
		columnsDisable: string[]
        columnsShow: string[]
        filtersDisable: string[]
        filtersShow: string[]
        humanReadableNames: Record<string, string>
        formatters: Formatters
        tableFormatters: Formatters 
        filterFormatters: Formatters
        tableRowStyler: (row: any) => string
        reformatters?: { key: string, interval: number }
	}

    let columnsDisable: string[], 
        columnsShow: string[], 
        filtersDisable: string[], 
        filtersShow: string[], 
        humanReadableNames: Record<string, string>, 
        formatters: Formatters, 
        tableFormatters: Formatters, 
        filterFormatters: Formatters, 
        tableRowStyler: (row: any) => string,
        reformatters: { key: string, interval: number }[];


    $: {
        ({ 
            columnsDisable, 
            columnsShow, 
            filtersDisable, 
            filtersShow, 
            humanReadableNames, 
            formatters, 
            tableFormatters, 
            filterFormatters, 
            tableRowStyler,
            reformatters
        } = $config);
    }

    let keysEnable: string[];

    $: keysEnable = (columnsShow && filtersShow )? Array.from(new Set([...columnsShow, ...filtersShow])) : [];

	const maxBadgeLength: number = 20;
    
    const sortState = StateManager.get('sortState:relays') ?? undefined

    // **Stores and Reactive Variables**
    const filters = writable({});

    $: filtersInclude = [ ...$config.filtersShow.filter(f => !filtersDisable.includes(f))  ];
    $: columnsInclude = [ ...$config.columnsShow.filter(f => !columnsDisable.includes(f)) ];

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
                name: humanReadableNames[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
            }));

            const data = $data.map((item: any) => {
                const formattedItem = { ...item };
                for (const key in formatters) {
                    if (Object.prototype.hasOwnProperty.call(formattedItem, key)) {
                        formattedItem[key] = formatters[key](formattedItem[key]);
                    }
                }
                return formattedItem;
            });

            return { data, columns };
        }
    );
    

    const filteredTableData = derived(
        [tableData, filters],
        ([$tableData, $filters]) => {
            if (!$tableData.data || !$tableData.columns || $tableData.columns.length === 0) {
                return { data: [], columns: [] };
            }
            const currentRelayFilters: ConsoleFilter[] = createRelayFilters($tableData.data, filtersInclude, humanReadableNames);
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
            if (!$tableData.data || !$tableData.columns || $tableData.columns.length === 0 || !tableRowStyler) {
                return new Map();   
            }
            const map: Map<string, string> = new Map();
            $tableData.data.forEach((row: any) => {
                map.set(row.id, tableRowStyler(row));
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
        if ($filteredTableData && $filteredTableData.columns && $filteredTableData.columns.length) {
            if(tableInstance === null || force){
                tableInstance = new DataTable<any>({
                    pageSize: $resultsPerPage,
                    columns: $filteredTableData.columns,
                    data: $filteredTableData.data,
                });
            }
        } else {
            if (tableInstance) {
                console.log('Destroying DataTable instance due to no data.');
                tableInstance = null;
            }
        }
    }

    // **DataTable Subscription**
    onMount(async () => {
        // let unsubTable: () => void;
        // unsubTable = filteredTableData.subscribe($filteredTableData => {
        //     createTable()
        // });
        const unsubRPP = resultsPerPage.subscribe(($resultsPerPage: number) => createTable(true));
        const unsubTableConfig = config.subscribe( () =>  setTimeout( () => createTable(true), 10 ) );
        while($filteredTableData.data.length === 0) {
            await new Promise(r => setTimeout(r, 50));
        }
        createTable();
        return () => {
            // unsubTable();
            unsubRPP();
            unsubTableConfig();
            if (tableInstance) {
                tableInstance = null;
            }
        };
    });

    function clearAllFilters() {
        filters.set({});
    }

    
</script>

<!-- **UI Layout with Resizable Panes** -->
<Resizable.PaneGroup direction="horizontal" class="min-h-[100%]">
    <!-- **Main Table Pane** -->
    <Resizable.Pane defaultSize={75}>
        {#if tableInstance !== null}
            <div class="px-4 shadow-md my-4">
                <!-- **Search Input for Global Filtering** -->
                <Input
                    type="text"
                    placeholder="Search"
                    class="md:ml-auto md:max-w-[300px] inline-block float-right"
                    bind:value={globalFilter}
                    on:input={handleGlobalFilterChange}
                />
                <DataTableShowResults />
                <DataTablePaginator {tableInstance} />

                <!-- **Data Table Structure** -->
                <Table.Root>
                    <Table.Header>
                        <Table.Row class="sticky top-0 z-10 bg-background">
                            {#if actionsComponent}
                            <svelte:component this={actionsComponent} view='head' />
                            {/if}
                            {#each tableInstance?.columns as column (column.id)}
                                <Table.Head>
                                    <button
                                        class="flex items-center"
                                        on:click={() => { 
                                            if(tableInstance) {
                                                const sortState = tableInstance.toggleSort(column.id) 
                                                StateManager.set('sortState:relays', sortState)
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
                        {#each tableInstance?.rows as row (row.id)}
                            <Table.Row class="{$rowStyles.get(row.pubkey)}" style="{row.banner? `background-image: ${row.banner}; background-repeat: no-repeat; background-size: cover; background-blend-mode: lighten;`: ''}">
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
                                        <Table.Cell>
                                            {#if tableFormatters?.[column.key]}
                                                {@html tableFormatters[column.key](row[column.key], row)}
                                            {:else}
                                                {@html row[column.key]}
                                            {/if}    
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
            <!-- **Loading or Empty State** -->
            <div class="flex h-full items-center justify-center align-middle">
                <p>[ loading image here ]</p>
            </div>
        {/if}
    </Resizable.Pane>
    <Resizable.Handle withHandle />
    <!-- **Filters Pane** -->
    <Resizable.Pane 
        class="min-h-[100%]"
        defaultSize={25} 
        collapsedSize={10} 
        collapsible={true}  
        onExpand={()=>{}} 
        onCollapse={()=>{}} 
        onResize={()=>{}} 
        bind:api={sidebarPaneApi}
        > <!----->
        <Tabs.Root value="filters" class="w-full my-4">
            <Tabs.List class="px-4 rounded-none w-full bg-transparent">
                <Tabs.Trigger value="filters" class="bg-white/5">Filters</Tabs.Trigger>
                <Tabs.Trigger value="options" class="bg-white/5">Options</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="filters">
                {#if tableInstance !== null && enableFilters}
                    <Filters 
                        {tableData} 
                        {keysEnable}
                        {filters} 
                        {filtersInclude} 
                        {humanReadableNames} 
                        {filterFormatters} 
                        {maxBadgeLength}
                        {config}
                    />
                {/if}
            </Tabs.Content>
            <Tabs.Content value="options">
                <Tabs.Root value="filters" class="w-full">
                    <Tabs.List>
                        <Tabs.Trigger value="table-options">Table</Tabs.Trigger>
                        <Tabs.Trigger value="filter-options">Filter</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="table-options">
                        <TableOptions {config} {tableKey} />
                    </Tabs.Content>
                    <Tabs.Content value="filter-options">
                        filter options here.
                    </Tabs.Content>
                </Tabs.Root>
            </Tabs.Content>
        </Tabs.Root>
    </Resizable.Pane>
</Resizable.PaneGroup>

<style lang="postcss" global>
    .active-filters {
        margin-bottom: 1rem;
    }
    .active-filters-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
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
        @apply !bg-white/10;
    }
</style>
