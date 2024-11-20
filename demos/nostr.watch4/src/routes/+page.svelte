<script lang="ts">
	import ArrowLeft from 'svelte-radix/ArrowLeft.svelte';
	import ArrowRight from 'svelte-radix/ArrowRight.svelte';

	import * as Table from '$lib/components/ui/table/index.js';
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	import { onMount, onDestroy } from 'svelte';
	import { derived, type Readable } from 'svelte/store';

	import { DataTable } from '@careswitch/svelte-data-table';

	import { 
		nip11s, 
		geocodes, 
		events, eventsArray,
		relays, 
		checks, 
		pastChecks, relayChecks, relayAggregates,
		softwares, versions,
		isps,
		monitors, monitorChecksCount
	} from '$lib/stores/index.js';
	import type Check from 'svelte-radix/Check.svelte';

	let N66: any,
			NostrSqliteAdapter: any,
			NostrToolsAdapter: any,
			liveQuery: any,
			Subscription: any;

	let n66: any;

	interface Formatter {
		[key: string]: (value: any) => any;
	}

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
			if ($relayAggregates.length === 0) {
				return { data: [], columns: [] };
			}

			const columns: TableColumn[] = Object.keys($relayAggregates[0]).map((key) => ({
				id: key,
				key: key,
				name: key.charAt(0).toUpperCase() + key.slice(1),
			}));

			const data = $relayAggregates.map((item) => {
				const formattedItem = { ...item };
				for (const key in formatters) {
					if (formattedItem.hasOwnProperty(key)) {
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

	const tableData = constructTableData(relayAggregates);

	export function createRelayFilters(
		tableData: Readable<{ data: any[] }>,
		keysToIgnore: string[],
		humanReadableNames: Record<string, string>
	): Readable<Filter[]> {
  return derived(tableData, ($tableData) => {
    if ($tableData.data.length === 0) {
      return [];
    }

    const filters: Filter[] = Object.keys($tableData.data[0])
      .filter((key) => !keysToIgnore.includes(key)) // Ignore specified keys
      .map((key) => {
        // Detect the data type based on the first non-null value
        const firstValue = $tableData.data.find((item) => item[key] !== null && item[key] !== undefined)?.[key];

        if (typeof firstValue === 'boolean') {
          return {
            key,
            humanReadableName: humanReadableNames[key] ?? key,
            type: 'boolean',
          };
        } else if (typeof firstValue === 'number') {
          return {
            key,
            humanReadableName: humanReadableNames[key] ?? key,
            type: 'number',
            conditions: ['=', '<', '>'],
          };
        } else if (typeof firstValue === 'string') {
          const distinctValues = Array.from(new Set($tableData.data.map((item) => item[key]).filter((val) => typeof val === 'string')));
          return {
            key,
            humanReadableName: humanReadableNames[key] ?? key,
            type: 'string',
            distinctValues,
          };
        }

        return null;
      });
    return filters.filter((filter) => filter !== null) as Filter[];
  });
}
	const keysToIgnore = ['nid', 'relay', 'id'];
	const humanReadableNames = {
		As: 'Autonomous System',
		anotherKey: 'Another Human Readable Name'
	};
	const relayFilters = createRelayFilters(tableData, keysToIgnore, humanReadableNames);


	let tableInstance: DataTable<any> | null = null;
	let subscriptions: typeof Subscription[] = [];

	let val: string='';
	let timer: ReturnType<typeof setTimeout>;
	const debounce = <T>(value: T, time: number = 750, callback = () => {}) => {
		clearTimeout(timer);
		timer = setTimeout(callback, time);
	}

	onMount(async () => {
		if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
		N66 = (await import('@nostrwatch/nip66')).default;
		console.log(await import('@nostrwatch/nip66-cacheadapter-nostrsqlite'))
		NostrSqliteAdapter = (await import('@nostrwatch/nip66-cacheadapter-nostrsqlite')).default;
		NostrToolsAdapter = (await import('@nostrwatch/nip66-wsadapter-nostrtools')).default;

		console.log('Initializing...');
		const adapters = {
			cacheAdapter: new NostrSqliteAdapter(),
			websocketAdapter: new NostrToolsAdapter()
		};
		n66 = new N66(adapters);
		await n66.init();

		const eventAddr = ( event: any ) => {
			let { pubkey, kind } = event;
			pubkey = pubkey.slice(0,13);
			const relay = event.tags.find(t => t[0] === 'd')?.[1]
			if(pubkey && relay && kind) {
				const key = `${pubkey}:${kind}:${relay}`
				return `${pubkey}:${kind}:${relay}`;
			}
		}

		n66.on('event', (event: any) => {
			console.log('Svelte Received event:', event.id);
			events.update((map) => {
				const addr = eventAddr(event);
				if (!addr) return;
				const existing = map.get(addr);
				if (existing && existing.id === event.id) return;
				if (existing && existing.created_at > event.created_at) return;
				map.set(addr, event);
				return map;
			});
		});

		n66.on('events', (_events: any) => {
			console.log('Svelte Received events:', _events.length);
			let set = 0;

			events.update((map) => {
				_events.forEach((event: any) => {
					const addr = eventAddr(event);
					if (!addr) return;

					const existing = map.get(addr);
					if (existing && existing.id === event.id) return;
					if (existing && existing.created_at > event.created_at) return;

					set++;
					map.set(addr, event);
				});

				return map;
			});

			console.log(`Set ${set}/${_events.length} events`);
		});

		await n66.monitorService.bootstrap();
	});

	onDestroy(() => {
		subscriptions.forEach(sub => sub.unsubscribe());
	});

	tableData.subscribe(($tableData) => {
		if(!$tableData.data.length) {
			return;
		}
		if (tableInstance) {
			tableInstance.baseRows = $tableData.data;
		} else {
			tableInstance = new DataTable<any>({
				pageSize: 100,
				columns: $tableData.columns,
				data: $tableData.data,
			})
		}
	});
</script>

<main>
	<h2>Relays</h2>
	<p>{Array.from($relays.values()).length}</p>


	<h2>Checks</h2>
	<p>{$checks.length}</p>

	<h2>Past Checks</h2>
	<p>{$pastChecks.length}</p>

	<h2>NIP11s</h2>
	<p>{Array.from($nip11s, ([name, value]) => ({ name, value })).length}</p>

	<h2>Geocodes</h2>
	<p>{JSON.stringify($geocodes.filter(gc => gc.format === 'alpha' && gc.length === 2).map(gc => gc.code))}</p>

	<h2>Events</h2>
	<p>{$eventsArray.length}</p>

	<h2>Softwares</h2>
	<p>{$softwares.length}</p>

	<h2>Versions</h2>
	<p>{$versions.length}</p>

	<h2>ISPs</h2>
	<p>{$isps.length}</p>
</main>

<h1>Monitors</h1>
{JSON.stringify($monitors)}
{#if $monitors.length > 0}
  <p>{$monitors.length}</p>
  {#each $monitors as monitor (monitor?.registration?.pubkey)}
    <p>
      {monitor?.registration?.pubkey} [{monitor?.relays?.length || 0}]
    </p>
  {/each}
{:else}
  <p>No monitors found.</p>
{/if}

{#if $tableData.data.length && tableInstance !== null}
<div class="flex flex-col gap-4 py-4 md:flex-row md:items-center md:gap-0 print:hidden">
	<Menubar.Root>
		<Menubar.Menu>
			<Menubar.Trigger>Filter</Menubar.Trigger>
			<Menubar.Content>
				{#each $relayFilters as filter}
					<Menubar.Sub>
						<Menubar.SubTrigger>{filter.humanReadableName}</Menubar.SubTrigger>
						<Menubar.SubContent class="w-40">
							{#if filter.type === 'boolean'}
								<Menubar.CheckboxItem onCheckedChange={() => tableInstance.toggleFilter(filter.key, true)}>
									{filter.key}
								</Menubar.CheckboxItem>
								<Menubar.CheckboxItem onCheckedChange={() => tableInstance.toggleFilter(filter.key, false)}>
									Not {filter.key}
								</Menubar.CheckboxItem>
							{:else if filter.type === 'string'}
								{#each filter.distinctValues as value}
									<Menubar.CheckboxItem onCheckedChange={() => tableInstance.toggleFilter(filter.key, value)}>
										{value}
									</Menubar.CheckboxItem>
								{/each}
							{:else if filter.type === 'number'}
								<div class="number-filter-options">
									{#each filter.conditions as condition}
										<Menubar.Item>
											<Input
												type="number"
												placeholder={condition}
												on:click={(e) => e.stopPropagation()}
												on:change={(e) => tableInstance.setNumberFilter(filter.key, condition, e.target.value)}
											/>
										</Menubar.Item>
									{/each}
								</div>
							{/if}
							<Menubar.Separator />
							<Menubar.Item inset on:click={() => tableInstance.clearFilter(filter.key)}>
								Clear
							</Menubar.Item>
						</Menubar.SubContent>
					</Menubar.Sub>
				{/each}
			</Menubar.Content>
		</Menubar.Menu>
	</Menubar.Root>

	<Input
		type="text"
		placeholder="Search"
		class="md:ml-auto md:max-w-[200px]"
		bind:value={tableInstance.globalFilter}
	/>
</div>
<Table.Root>
	<Table.Header>
		<Table.Row class="sticky top-0 z-10 *:bg-background">
			{#each tableInstance.columns as column (column.id)}
				<Table.Head>
					<button
						class="flex items-center"
						onclick={() => { if(tableInstance) tableInstance.toggleSort(column.id) }}
						disabled={!tableInstance.isSortable(column.id)}
					>
						{column.name}
						{#if tableInstance.isSortable(column.id)}
							<span class="ml-2">
								{#if tableInstance.getSortState(column.id) === 'asc'}
									↑
								{:else if tableInstance.getSortState(column.id) === 'desc'}
									↓
								{:else}
									↕
								{/if}
							</span>
						{/if}
					</button>
				</Table.Head>
			{/each}
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each tableInstance.rows as row (row.id)}
			<Table.Row>
				{#each tableInstance.columns as column (column.id)}
					{#if column.id === 'status'}
						<Table.Cell>
							<Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
								{row.status === 'active' ? 'Active' : 'Inactive'}
							</Badge>
						</Table.Cell>
					{:else}
						<Table.Cell>{row[column.key]}</Table.Cell>
					{/if}
				{/each}
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
<div class="flex items-center gap-2 border-t py-2">
	<div class="flex items-center gap-0">
		<Button
			size="icon"
			variant="ghost"
			disabled={!tableInstance.canGoBack}
			on:click={() => { if(tableInstance) return tableInstance.currentPage-- } }
		>
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<Button
			size="icon"
			variant="ghost"
			disabled={!tableInstance.canGoForward}
			on:click={() => { if(tableInstance) return tableInstance.currentPage++ } }
		>
			<ArrowRight class="h-5 w-5" />
		</Button>
	</div>
	<p class="text-sm">
		Page <span class="font-semibold">{tableInstance.currentPage}</span> of
		<span class="font-semibold">{tableInstance.totalPages}</span>
	</p>
	<span class="text-xs">
		({tableInstance.allRows.length} / {tableInstance.baseRows.length})
	</span>
</div>

{/if}