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
	import type { Formatters } from '$lib/config/dataTable/monitors';
    
    import TableOptions from './TableOptions.svelte';
    import * as Popover from "$lib/components/ui/popover";
    import * as Tabs from "$lib/components/ui/tabs";
	import Button from '../../ui/button/button.svelte';

    export let tableKey: string;
    export let data: any;
    export let config: Writable<DataTableConfig>;
    export let enableFilters: boolean = true;
    export let actionsComponent;

    export let sidebarPaneApi: Resizable.PaneApi | null = null;
    const sidebarCollapsed = writable(StateManager.get('sidebarCollapsed') ?? false);   

    type DataTableConfig = { 
		columnsDisable: string[]
        columnsShow: string[]
        filtersDisable: string[]
        filtersShow: string[]
        humanReadableNames: Record<string, string>
        formatters: Formatters
        tableFormatters: Formatters 
        filterFormatters: Formatters
        availableColumnKeys: string[]
        availableFilterKeys: string[]
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
            tableRowStyler
        } = $config);
    }

    let keysEnable: string[];

    $: keysEnable = (columnsShow?.length && filtersShow?.length )? Array.from(new Set([...columnsShow, ...filtersShow])) : [];

	const maxBadgeLength: number = 20;
    
    const sortState = StateManager.get('sortState:relays') ?? undefined

    // **Stores and Reactive Variables**
    const filters = writable({});
    // setInterval( () =>  console.log('filtersShow', $config.filtersShow), 1000)

    $: filtersInclude = filtersShow?.length? [ ...$config.filtersShow.filter(f => !filtersDisable.includes(f)) ]: [];
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
        const config: any = {
            pageSize: $resultsPerPage,
            columns: $filteredTableData.columns,
            data: $filteredTableData.data,
        }

        if(sortState) {
            if(sortState?.columnId) {
                config.initialSort = sortState.columnId
            }
            if(sortState?.direction) {
                config.initialSortDirection = sortState.direction
            }
        }
        console.log(`Creating DataTable instance with ${$filteredTableData.data.length} rows.`, config);
        if ($filteredTableData && $filteredTableData.columns && $filteredTableData.columns.length) {
            if(tableInstance === null || force){
                tableInstance = new DataTable<any>(config);
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

    $: isCollapsed = $sidebarCollapsed;
    $: activeFilters = Object.keys($filters).length;

    const toggleSidebarPane = () => {
        if(isCollapsed) {
            sidebarPaneApi.expand()
        }
        else {
            sidebarPaneApi.collapse()
        }
        sidebarCollapsed.set(!$sidebarCollapsed)
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
                <Popover.Root>
                    <Popover.Trigger class="text-lg inline-block ml-2 relative -top-1">⚙</Popover.Trigger>
                    <Popover.Content class="z-[5999] mt-3 min-w-[600px] backdrop-blur-md bg-black/50">
                        <Tabs.Root value="visiblity" class="">
                            <Tabs.List>
                                <Tabs.Trigger value="visiblity">Visiblity</Tabs.Trigger>
                                <Tabs.Trigger value="order">Order</Tabs.Trigger>
                            </Tabs.List>
                            <Tabs.Content value="visiblity"  class="py-4 px-8">
                                <TableOptions {config} {tableKey} />
                            </Tabs.Content>
                            <Tabs.Content value="order" class=" text-white/20">
                                coming soon...
                            </Tabs.Content>
                        </Tabs.Root>
                    </Popover.Content>
                </Popover.Root>

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
                                                tableInstance.toggleSort(column.id) 
                                                StateManager.set('sortState:relays', tableInstance.sortState)
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
                            <Table.Row 
                                class="{$rowStyles.get(row.pubkey)}" 
                                style="{row.banner? 
                                    `background: linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)),  url('${row.banner}'); 
                                     background-repeat: no-repeat; 
                                     background-size: cover; `
                                     : ''}"
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
        collapsedSize={5} 
        collapsible={true}  
        onExpand={()=>{}} 
        onCollapse={()=>{}} 
        onResize={()=>{}} 
        bind:pane={sidebarPaneApi}
        > <!----->

            {#if sidebarPaneApi}
                <Button class="rounded-l-none display-inline bg-white/5 text-white/80 hover:bg-white/15 text-white/90" on:click={toggleSidebarPane()}>
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
                        {tableKey}
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
        @apply !bg-white/10;
    }
</style>
