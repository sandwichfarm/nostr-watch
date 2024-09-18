<script>
	import { onMount, onDestroy } from 'svelte';
	import { writable, derived } from 'svelte/store';
	import { liveQuery } from "dexie";
	import { mount } from 'svelte';
	import { DataTable } from '@careswitch/svelte-data-table';

	import N66 from '@nostrwatch/nip66';
	import DexieAdapter from '@nostrwatch/nip66-cacheadapter-dexieetl';
	import NostrToolsAdapter from '@nostrwatch/nip66-wsadapter-nostrtools';

	// import * as Table from '$lib/components/ui/table/index.js';
	// import * as Menubar from '$lib/components/ui/menubar/index.js';
	// import { Input } from '$lib/components/ui/input/index.js';
	// import { Button } from '$lib/components/ui/button/index.js';
	// import { Badge } from '$lib/components/ui/badge/index.js';

	let n66;

	const events = writable([]);
	const relays = writable([]);
	const monitors = writable([]);
	const checks = writable([]);
	const nip11s = writable([]);
	const geocodes = writable([]);

	const monitorChecksCount = derived(checks, ($checks) => {
		const countMap = {};
		$checks.forEach(check => {
			const pubkey = check.monitorPubkey;
			countMap[pubkey] = (countMap?.[pubkey] || 0) + 1;
		});
		return countMap;
	});

	const relayChecks = derived(checks, ($checks) => {
		const countMap = {};
		$checks.forEach(check => {
			const relay = check.relay;
			if (!countMap[relay]) {
				countMap[relay] = { a: {}, checks: [] };
			}
			countMap[relay].checks.push(check);
		});
		Object.keys(countMap).forEach(relay => {
			countMap[relay].aggregate = countMap[relay].checks.reduceRight((acc, obj) => {
				return { ...acc, ...obj };
			}, {});
		});
		return countMap;
	});

	const relayAggregates = derived(relayChecks, ($relayChecks) => {
		return Object.values($relayChecks).map((item, index) => ({ ...item.aggregate, id: index }));
	});

	const tableData = derived(relayAggregates, ($relayAggregates) => {
		if ($relayAggregates.length === 0) {
			return { data: [], columns: [] };
		}

		const columns = Object.keys($relayAggregates[0]).map((key) => ({
			id: key,
			key: key,
			name: key.charAt(0).toUpperCase() + key.slice(1),
		}));

		return {
			data: $relayAggregates,
			columns: columns,
		};
	});

	let tableInstance = null;
	let subscriptions = [];

	onMount(async () => {
		console.log('Initializing...');
		const adapters = {
			cacheAdapter: new DexieAdapter(),
			websocketAdapter: new NostrToolsAdapter()
		};
		n66 = new N66(adapters);
		await n66.init();
		// subscribe to liveQuery results and update writable stores
		subscriptions = [
			liveQuery(() => n66.cacheAdapter.db.events.toArray()).subscribe((data) => {
				events.set(data);
			}),
			liveQuery(() => n66.cacheAdapter.db.relays.toArray()).subscribe((data) => {
				relays.set(data);
			}),
			liveQuery(() => n66.cacheAdapter.db.monitors.toArray()).subscribe((data) => {
				monitors.set(data);
			}),
			liveQuery(() => n66.cacheAdapter.db.checks.toArray()).subscribe((data) => {
				checks.set(data);
			}),
			liveQuery(() => n66.cacheAdapter.db.nip11s.toArray()).subscribe((data) => {
				nip11s.set(data);
			}),
			liveQuery(() => n66.cacheAdapter.db.geocodes.toArray()).subscribe((data) => {
				geocodes.set(data);
			})
		];

		// n66.monitorService.bootstrap()
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
			tableInstance = new DataTable({
				pageSize: 100,
				columns: $tableData.columns,
				data: $tableData.data,
			})
			
			// tableInstance = new DataTable($tableData)
		}
		console.log('tableInstance', tableInstance);
	});

	$: checkCount = (relay) => relayChecks[relay.relay]?.length;
</script>

<main>
	<h2>Checks</h2>
	<p>{$checks.length}</p>

	<h2>NIP11s</h2>
	<p>{$nip11s.length}</p>

	<h2>Geocodes</h2>
	<p>{$geocodes.length}</p>

	<h2>Events</h2>
	<p>{$events.length}</p>
</main>

<h1>Monitors</h1>
{#if $monitors.length > 0}
	<p>{$monitors.length}</p>
	{#each $monitors as monitor (monitor.id)}
		<p>{monitor.id} [{$monitorChecksCount[monitor.id]}]</p>
	{/each}
{/if}

{#if $tableData.data.length}
<!-- <div class="flex flex-col gap-4 py-4 md:flex-row md:items-center md:gap-0 print:hidden">
	<Menubar.Root>
		<Menubar.Menu>
			<Menubar.Trigger>Filter</Menubar.Trigger>
			<Menubar.Content>
				<Menubar.Sub>
					<Menubar.SubTrigger>Status</Menubar.SubTrigger>
					<Menubar.SubContent class="w-40">
						{#each statuses as status}
							<Menubar.CheckboxItem
								checked={table.isFilterActive('status', status.value)}
								onCheckedChange={() => table.toggleFilter('status', status.value)}
							>
								{status.label}
							</Menubar.CheckboxItem>
						{/each}
						<Menubar.Separator />
						<Menubar.Item inset on:click={() => table.clearFilter('status')}>
							Clear
						</Menubar.Item>
					</Menubar.SubContent>
				</Menubar.Sub>
			</Menubar.Content>
		</Menubar.Menu>
	</Menubar.Root>

	<Input
		type="text"
		placeholder="Search"
		class="md:ml-auto md:max-w-[200px]"
		bind:value={table.globalFilter}
	/>
</div> -->
	<table>
		<thead>
			<tr>
				{#each tableInstance?.columns as column (column.id)}
					<th>{column.name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each tableInstance?.rows as row (row.id)}
				<tr>
					{#each tableInstance?.columns as column (column.id)}
						<td>
							{row[column.key]}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>