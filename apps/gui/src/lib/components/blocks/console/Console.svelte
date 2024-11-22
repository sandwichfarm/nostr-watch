<script lang="ts">
    import ArrowLeft from 'svelte-radix/ArrowLeft.svelte';
    import ArrowRight from 'svelte-radix/ArrowRight.svelte';

    import * as Table from '$lib/components/ui/table/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';

	import * as Resizable from "$lib/components/ui/resizable";

    import { relayAggregates } from '$lib/stores/checks.js';
    import { DataTable } from '@careswitch/svelte-data-table';
    import { writable, derived, get, type Readable } from 'svelte/store';

	import Filters from './Filters.svelte'; 
	import { columnsDisable, columnsShow, filtersDisable, filtersShow, humanReadableNames, formatters, tableFormatters } from './config';
	import DataTableShowResults from '$lib/components/partials/DataTableShowResults.svelte';
	import DataTablePaginator from '$lib/components/partials/DataTablePaginator.svelte';

	import { Debounce } from '$lib/utils/debounce';

	import { resultsPerPage } from '$lib/stores/datatable-settings';
	import { onDestroy, onMount } from 'svelte';

    type Formatter = {
        [key: string]: (value: any) => any;
    };

    interface TableColumn {
        id: string;
        key: string;
        name: string;
    }

    interface TableData {
        data: any[];
        columns: TableColumn[];
    }

    export function constructTableData(
        relayAggregates: Readable<any[]>,
        formatters: Formatter = {}
    ): Readable<TableData> {
        return derived(relayAggregates, ($relayAggregates) => {

            if (!$relayAggregates || $relayAggregates.length === 0) {
                return { data: [], columns: [] };
            }

			//console.log('columns', Object.keys($relayAggregates[0]))

			// const columns: TableColumn[] = Object.keys($relayAggregates[0])

			if(!columnsInclude) return { data: [], columns: [] }; 

            const columns: TableColumn[] = columnsInclude
				.map((key) => {
					return {
						id: key,
						key: key,
						name: key.charAt(0).toUpperCase() + key.slice(1),
					}
				});

            const data = $relayAggregates.map((item) => {
                const formattedItem = { ...item };
                for (const key in formatters) {
                    if (Object.prototype.hasOwnProperty.call(formattedItem, key)) {
                        formattedItem[key] = formatters[key](formattedItem[key]);
                    }
                }
                return formattedItem;
            });

            return {
                data,
                columns,
            };
        });
    }

    const tableData = constructTableData(relayAggregates, formatters);

    const filters = writable({});

    const filteredTableData = derived(
        [tableData, filters],
        ([$tableData, $filters]) => {
            if (!$tableData || !$tableData.data) {
                return { data: [], columns: [] };
            }

            let filteredData = $tableData.data;

            for (const [key, value] of Object.entries($filters)) {
                if (typeof value === 'function') {
                    filteredData = filteredData.filter(item => value(item[key]));
                } else if (Array.isArray(value)) {
                    filteredData = filteredData.filter(item => value.includes(item[key]));
                } else {
                    filteredData = filteredData.filter(item => item[key] === value);
                }
            }

            return { data: filteredData, columns: $tableData.columns };
        }
    );

    let tableInstance: DataTable<any> | null = null;

    filteredTableData.subscribe(($filteredTableData) => {
        if (!$filteredTableData || !$filteredTableData.columns || !$filteredTableData.columns.length) return;

		let lastTableUpdate = 0;
		const tableDebounce = new Debounce();

		resultsPerPage.subscribe((pageSize) => {
			const now = Date.now();
			if (now - lastTableUpdate >= 500) {
				createTable(pageSize);
				lastTableUpdate = now;
			} else {
				tableDebounce.execute(
					pageSize,
					250,
					(pageSize) => {
						createTable(pageSize);
						lastTableUpdate = Date.now();
					}
				);
			}
		});

		function createTable(pageSize?: number) {
			tableInstance = new DataTable<any>({
				pageSize: pageSize || get(resultsPerPage),
				columns: $filteredTableData.columns,
				data: $filteredTableData.data,
			});
		}

		createTable()

    });

    function clearAllFilters() {
        filters.set({});
    }

	onMount( () => {

	})
	onDestroy( () => {
		tableInstance = null;
	})

    $: activeFilters = get(filters);
	$: filtersInclude = [ ...filtersShow.filter(f => !filtersDisable.includes(f))  ]
	$: columnsInclude = [ ...columnsShow.filter(f => !columnsDisable.includes(f)) ]
</script>

<!-- <div class="min-w-max mt-15"> -->
<Resizable.PaneGroup direction="horizontal" class="min-h-[100%]">
	<Resizable.Pane defaultSize={75}>
	{#if tableInstance !== null}
	  <div class="h-11"></div>
      <div class="px-4 shadow-md my-10">
		<Input
			type="text"
			placeholder="Search"
			class="md:ml-auto md:max-w-[300px] inline-block float-right"
			bind:value={tableInstance.globalFilter}
    	/>
		<DataTableShowResults />
		<DataTablePaginator {tableInstance} />
		<Table.Root>
			<Table.Header>
				<Table.Row class="sticky top-0 z-10 *:bg-background">
					{#each tableInstance?.columns as column (column.id)}
						<Table.Head>
							<button
								class="flex items-center"
								onclick={() => { if(tableInstance) tableInstance?.toggleSort(column.id) }}
								disabled={!tableInstance?.isSortable(column.id)}
								>
								{humanReadableNames[column.id] ?? column.name}
								{#if tableInstance?.isSortable(column.id)}
									<span class="ml-2">
										{#if tableInstance?.getSortState(column.id) === 'asc'}
											↑
										{:else if tableInstance?.getSortState(column.id) === 'desc'}
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
					<Table.Row>
						{#each tableInstance?.columns as column (column.id)}
							{#if column.id === 'status'}
								<Table.Cell>
									<Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
										{row.status === 'active' ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
							{:else}
								<Table.Cell>{@html tableFormatters?.[column.key]? tableFormatters[column.key]?.(row[column.key]): row[column.key]}</Table.Cell>
							{/if}
						{/each}
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTableShowResults />
		<DataTablePaginator {tableInstance} />
	</div>
	{/if}
	</Resizable.Pane>
	<Resizable.Handle withHandle />
	<Resizable.Pane defaultSize={25}>
		{#if tableInstance !== null}
			<Filters {tableData} {filters} {filtersInclude} {humanReadableNames} />
		{/if}
	</Resizable.Pane>
	
</Resizable.PaneGroup>
<!-- </div> -->

<style>
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
</style>
