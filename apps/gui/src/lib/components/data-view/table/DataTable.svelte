<script lang="ts">
    import { onMount } from 'svelte';
    import { writable, derived, type Writable, type Readable, type Unsubscriber } from 'svelte/store';
    import { DataTable } from '$lib/components/@Careswitch/svelte-data-table';
    import * as Resizable from '$lib/components/ui/resizable'; 
    import DataTableShowResults from './DataTableShowResults.svelte';
    import DataTablePaginator from './DataTablePaginator.svelte';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Table from '$lib/components/ui/table/index.js';
	import { StateManager } from '@nostrwatch/route66';
    import { getLeaderTabRpcClient } from '$lib/runtime/leader-tab-client';
    import { stateManagerSet, stateManagerStorageKey } from '$lib/runtime/state-manager-sync';

    import { cachableConfig } from './utils.js'
    
    import TableOptions from './TableOptions.svelte';
    import * as Popover from "$lib/components/ui/popover";
    import * as Tabs from "$lib/components/ui/tabs";
	import type { DataTableConfig } from './DataTableTypes';
	import { darkMode, isBootstrapped } from '$lib/stores/app';
	import type { DataViewColumns } from '../DataTableTypes';
	import Loading from '$lib/components/partials/Loading.svelte';

    export let dataKey: string;
    export let data: Readable<any[]>;
    export let dataUnfilteredLength: number | undefined = undefined;
    export let livenessCounts: { online: number; offline: number; dead: number } | null = null;
    export let columns: Readable<DataViewColumns[]>;
    export let config: Writable<DataTableConfig>;
    export let enableFilters: boolean | undefined = true;
    export let sidebarPaneApi: Resizable.PaneApi | null = null;
    export let actionsComponent: any | undefined = undefined;
    
    let resultsPerPage: number = $config?.pageSize || 50; 
    let keysEnable: string[];
    let tableInstance: DataTable<any> | null = null;
    let globalFilter = '';

    $: keysEnable = ($config.columnsShow?.length && $config.filtersShow?.length )? Array.from(new Set([...$config.columnsShow, ...$config.filtersShow])) : [];
    
    const filters = writable({});
    export let watchValue: string | undefined = 'lastSeen';
    export const recordChanged = writable(new Map<string, boolean>())
    export const recordWatchValue = writable(new Map<string, any>())

    let dataSubscription: Unsubscriber;

    if(watchValue && $isBootstrapped) {
        const triggerFlash = (id: string) => {
            recordChanged.update( (currentMap: Map<string, boolean>) => currentMap.set(id, true))
            setTimeout(() => {
                recordChanged.update( (currentMap: Map<string, boolean>) => currentMap.set(id, false))
            }, 1000);
        }
        dataSubscription = data.subscribe( (newData: any) => {
            newData.forEach( (row: any) => {
                const oldValue = $recordWatchValue.get(row.id) 
                const newValue = row?.[watchValue]
                recordWatchValue.update( (currentMap: Map<string, any>) => currentMap.set(row.id, newValue))
                if(!oldValue || !newValue) return;
                if(oldValue === newValue) return;
                triggerFlash(row.id)
            });
        });
    }

    function handleGlobalFilterChange(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        globalFilter = value;
        if (tableInstance) {
            tableInstance.globalFilter = value;
        }
    }

    // const rowStyles = derived(
    //     data,
    //     ($data) => {
    //         if (!$data || !$columns || $columns.length === 0 || !$config.tableRowStyler) {
    //             return new Map();   
    //         }
    //         const map: Map<string, string> = new Map();
    //         $data.forEach((row: any) => {
    //             map.set(row.id, $config.tableRowStyler(row));
    //         });
    //         return map
    //     }
    // );

    $: {
        if (tableInstance) {
            (tableInstance as DataTable<any>).baseRows = $data;
        } else if ($data?.length && $columns?.length) {
            // Create table reactively when data becomes available after mount
            createTable();
        }
    }

    const createTable = (force: boolean = false) => {
        const tableInstanceConfig: any = {
            pageSize: $config.pageSize,
            columns: $columns,
            data: $data,
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
        if ($data && $columns && $columns.length) {
            if(tableInstance === null || force){
                tableInstance = new DataTable<any>(tableInstanceConfig);
            }
        } else {
            if (tableInstance) {
                tableInstance = null;
            }
        }
    }

    onMount(async (): Promise<any> => {
        let isInitialMount = true;
        let suppressPersist = false;
        let saveTimeout: ReturnType<typeof setTimeout> | null = null;
        let tableTimeout: ReturnType<typeof setTimeout> | null = null;
        const TABLE_CONFIG_KEY = `preferences:${dataKey}:tableConfig`;

        const applyRemoteConfig = (next: any) => {
            if (!next || typeof next !== 'object') return;
            suppressPersist = true;
            config.update((current) => {
                if (!current) return current;
                return { ...current, ...next };
            });
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

        // Debounced config save - skip initial, debounce 300ms
        const unsubConfig = config.subscribe( (newConfig: DataTableConfig) => {
            if (isInitialMount) return;
            if(resultsPerPage !== newConfig.pageSize) {
                resultsPerPage = newConfig.pageSize;
            }
            if (suppressPersist) return;
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                void stateManagerSet(TABLE_CONFIG_KEY, cachableConfig(newConfig));
            }, 300);
        })

        // Debounced table recreation - skip initial, debounce 100ms
        const unsubTableConfig = config.subscribe( () => {
            if (isInitialMount) return;
            if (tableTimeout) clearTimeout(tableTimeout);
            tableTimeout = setTimeout(() => createTable(true), 100);
        });

        // Create table once on mount
        createTable();

        // Mark initial mount complete after a tick
        setTimeout(() => { isInitialMount = false; }, 0);
        return () => {
            unsubConfig();
            unsubTableConfig();
            dataSubscription?.();
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

{#if tableInstance !== null}
    <div class="relative z-0 shadow-md mb-4">

        <div id="dataViewTopBar" class="border-b-[1px] mb-2">
        <!-- **Search Input for Global Filtering** -->
        <Input
            type="text"
            placeholder="Search"
            class="md:ml-auto md:max-w-[300px] inline-block float-right mt-2 mr-2"
            bind:value={globalFilter}
            on:input={handleGlobalFilterChange}
        />

        <DataTableShowResults {config}  />
        <DataTablePaginator {tableInstance} totalCount={dataUnfilteredLength} {livenessCounts} />

        </div>

        <Popover.Root>
            <Popover.Trigger class="text-lg inline-block ml-2 relative -top-1">
                <Badge variant="secondary" class="cursor-pointer text-sm">Column Visiblity</Badge>
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
                {#each tableInstance?.rows as row (row.id)}
                <!-- {(console.log('row data', row?.active, row?.enabled, $config.tableRowStyler(row)))} -->
                    <Table.Row 
                        class="{$config.tableRowStyler(row)} flash-record {$recordChanged.get(row.id) ? 'animate-flash' : ''}" 
                        style="{
                            row.banner && row.banner !== ''
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
                                <Table.Cell>
                                    {#if $config.tableFormatters?.[column.key]}
                                        {@html $config.tableFormatters[column.key](row[column.key], row)}
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
        <DataTablePaginator {tableInstance} totalCount={dataUnfilteredLength} {livenessCounts} />
    </div>
{:else}
    <Loading />
{/if}

<style lang="postcss" global>

    .flash-record {
        @apply bg-white/0;
    }

    .active-filter {
        background-color: #e0e0e0;
        padding: 0.5rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .filter-mode-toggle button.active {
        /* Example active state styles */
        background-color: #3182ce;
        color: white;
    }
    
    .more-link {
        color: #3182ce;
        cursor: pointer;
        text-decoration: underline;
    }

    body .data-[state=active]:bg-background[data-state="active"] {
        @apply !bg-black/10 dark:bg-white/10;
    }
</style>
