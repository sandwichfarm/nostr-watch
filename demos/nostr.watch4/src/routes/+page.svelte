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

	import { transform30166 } from '@nostrwatch/nip66/transform';
	import type { ICheck, IRelay, INip11, IGeocode } from '@nostrwatch/nip66/models';

	import { DataTable } from '@careswitch/svelte-data-table';

	import Surreal from 'surrealdb';

	import { 
		nip11s, 
		geocodes, 
		events, 
		relays, 
		checks, pastChecks, relayChecks, relayAggregates,
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

			// Construct columns
			const columns: TableColumn[] = Object.keys($relayAggregates[0]).map((key) => ({
				id: key,
				key: key,
				name: key.charAt(0).toUpperCase() + key.slice(1),
			}));

			// Format data using provided formatters
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

	onMount(async () => {
		if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

		// const Dexie = await import('dexie');
		// liveQuery = Dexie.liveQuery;
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

		await n66.monitorService.bootstrapMonitorRegistrations();
		await n66.monitorService.bootstrapMonitorData();
    	await n66.monitorService.ensureMonitorsActive();
    	await n66.monitorService.prioritizeMonitors();
		const _events = await n66.cacheAdapter.REQ([{ kinds: [30166] }])
		console.log(_events.length)
		events.set(_events);

		n66.monitorService.addHook('onMonitorCheckEvent', (event: any) => {

			// transform30166(event).then((transformed: any) => {
			// 	const { check, relay, nip11, event, geocodes } = transformed

			// 	checks.update( (checks: ICheck[]) => { 
			// 		checks.push(check) 
			// 		return checks
			// 	});

			// 	relays.update( (relays: Map<string, IRelay>) => { 
			// 		relays.set(relay.relay, relay) 
			// 		return relays
			// 	});

				// nip11s.update( (nip11s: Map<string, INip11>) => { 
				// 	nip11s.set(nip11.relay, nip11) 
				// 	return nip11s
				// });

				// geocodes.update( (geocodes: IGeocode[]) => { 
				// 	geocodes.push(geocodes) 
				// 	return geocodes
				// });	
			// });
			
			events.update((events) => {
				events.push(event);
				return events;
			});
		});


		// monitors.set((await n66.cacheAdapter.db.store.query(`SELECT * FROM type::table($tb);`, { tb: 'monitor' }))[0].map(m => {
		// 	delete m.id;
		// 	return m
		// }));

		// checks.set((await n66.cacheAdapter.db.store.query(`SELECT * FROM type::table($tb);`, { tb: 'check' }))[0].map(m => {
		// 	delete m.id;
		// 	return m
		// }));

		// relays.set((await n66.cacheAdapter.db.store.query(`SELECT * FROM type::table($tb);`, { tb: 'relay' }))[0].map(m => {
		// 	delete m.id;
		// 	return m
		// }));


		// nip11s.set((await n66.cacheAdapter.db.store.query(`SELECT * FROM type::table($tb);`, { tb: 'nip11' }))[0].map(m => {
		// 	delete m.id;
		// 	return m
		// }));


		// events.set((await n66.cacheAdapter.db.store.query(`SELECT * FROM type::table($tb);`, { tb: 'event' }))[0].map(m => {
		// 	m.id = m.id.id;
		// 	return m
		// }));

		// geocodes.set((await n66.cacheAdapter.db.store.query(`SELECT * 	FROM type::table($tb);`, { tb: 'geocode' }))[0].map(m => {
		// 	delete m.id;
		// 	console.log(geocode)
		// 	return m
		// }));
		
		n66.monitorService.bootstrap()	

		// const queryUuid = await n66.cacheAdapter.db.store.live(
		// 	"monitor",
		// 	( action, result ) => {
		// 		if (action === 'CLOSE') return;
		// 		monitors.update((monitors) => {
		// 			delete result.id;
		// 			const monitor = result;
		// 			if (action === 'CREATE') {
		// 				monitors.push(monitor);
		// 			} else if (action === 'DELETE') {
		// 				const index = monitors.findIndex((m) => m.pubkey === monitor.pubkey);
		// 				monitors.splice(index, 1);
		// 			}
		// 			return monitors;
		// 		});
		// 	}
		// )


		// n66.cacheAdapter.db.store.live(
		// 	"check",
		// 	( action, result ) => {
		// 		if (action == 'CLOSE') return;
		// 		checks.update((checks) => {
		// 			delete result.id;
		// 			const check = result;
		// 			if (action == 'CREATE') {
		// 				checks.push(check);
		// 			} else if (action == 'DELETE') {
		// 				const index = checks.findIndex((c) => c.nid === check.nid);
		// 				checks.splice(index, 1);
		// 			}
		// 			return checks;
		// 		});
		// 	}
		// )

		// n66.cacheAdapter.db.store.live(
		// 	"relay",
		// 	( action, result ) => {
		// 		if (action === 'CLOSE') return;
		// 		relays.update((relays) => {
		// 			delete result.id;
		// 			const relay = result;
		// 			if (action === 'CREATE') {
		// 				relays.push(relay);
		// 			} else if (action === 'UPDATE') {
		// 				const index = relays.findIndex((r) => r.relay === relay.relay );
		// 				relays[index] = relay;
		// 			} else if (action === 'DELETE') {
		// 				const index = relays.findIndex((r) => r.relay === relay.relay );
		// 				relays.splice(index, 1);
		// 			}
		// 			return relays;
		// 		});
		// 	}
		// )

		// n66.cacheAdapter.db.store.live(
		// 	"nip11",
		// 	( action, result ) => {
		// 		if (action === 'CLOSE') return;
		// 		nip11s.update((nip11s) => {
		// 			delete result.id;
		// 			const nip11 = result;
		// 			if (action === 'CREATE') {
		// 				nip11s.set(nip11.relay, nip11);
		// 			} else if (action === 'UPDATE') {
		// 				nip11s.set(nip11.relay, nip11);
		// 			} else if (action === 'DELETE') {
		// 				nip11s.delete(nip11.relay);
		// 			}
		// 			return nip11s;
		// 		});
		// 	}
		// )

		// n66.cacheAdapter.db.store.live(
		// 	"geocode",
		// 	( action, result ) => {
		// 		if (action === 'CLOSE') return;
		// 		geocodes.update((geocodes) => {
		// 			delete result.id;
		// 			const geocode = result;
		// 			if (acti	on === 'CREATE') {
		// 				geocodes.push(geocode);
		// 			} else if (action === 'DELETE') {
		// 				const index = geocodes.findIndex((g) => g.code === geocode.code);
		// 				geocodes.splice(index, 1);
		// 			}
		// 			return geocodes;
		// 		});
		// 	}
		// )

		// n66.cacheAdapter.db.store.live(
		// 	"event",
		// 	( action, result ) => {
		// 		if (action === 'CLOSE') return;
		// 		events.update((events) => {
		// 			result.id = result.id.id
		// 			const event = result;
		// 			if (action === 'CREATE') {
		// 				events.push(event);
		// 			} else if (action === 'UPDATE') {
		// 				const index = events.findIndex((e) => e.id === event.id);
		// 				events[index] = event;
		// 			} else if (action === 'DELETE') {
		// 				const index = events.findIndex((e) => e.id === event.id);
		// 				events.splice(index, 1);
		// 			}
		// 			return events;
		// 		});
		// 	}
		// )

		// subscribe to liveQuery results and update writable stores
		// subscriptions = [
		// 	liveQuery(() => n66.cacheAdapter.db.events.toArray()).subscribe((data) => {
		// 		events.set(data);
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.relays.where('lastSeen').above((Date.now() / 1000) - 60 * 60 * 1).toArray()).subscribe((data) => {
		// 		relays.set(data);
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.monitors.toArray()).subscribe((data) => {
		// 		monitors.set(data);	
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.checks.toArray()).subscribe((data) => {
		// 		checks.set(data);
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.pastChecks.toArray()).subscribe((data) => {
		// 		pastChecks.set(data);
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.nip11s.toArray()).subscribe((data) => {
		// 		for(const nip11 of data) {
		// 			nip11s.update((map: Map<string, INip11>) => {
		// 				map.set(nip11.relay, nip11 as INip11);
		// 				return map;
		// 			});
		// 		}
		// 	}),
		// 	liveQuery(() => n66.cacheAdapter.db.geocodes.toArray()).subscribe((data) => {
		// 		geocodes.set(data);
		// 	})
		// ];

		
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
	<p>{$events.length}</p>
</main>

<h1>Monitors</h1>
{#if $monitors.length > 0}
	<p>{$monitors.length}</p>
	{#each $monitors as monitor (monitor.pubkey)}
		<p>{monitor.pubkey} [{$monitorChecksCount[monitor.pubkey]}]</p>
	{/each}
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