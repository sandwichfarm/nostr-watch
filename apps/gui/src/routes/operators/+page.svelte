<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache } from '$lib/stores/app';
    import { get, writable, type Writable } from 'svelte/store';
	import { type DataTableConfig, defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
    import builtInTableConfig from '$lib/config/dataTable/operators.js'
	import { operatorsRows as data } from '$lib/stores/operators';
    import { type default as DataTableType } from '$lib/components/lists/table/DataTable.svelte';
	import { events, route66 } from '$lib/stores';
	import { operatorsPubkeys } from '$lib/stores/operators';
	import { operatorsUserInstances } from '$lib/stores/operators';
	import { bootstrapOperatorsMeta, canSeedFromCache, instance } from '$lib/utils/lifecycle';
	import { seedMetaFromCache } from '$lib/utils/lifecycle';
	import { dataRegister } from '$stores/data-register';
	import DataViewRoot from '$lib/components/data-view/DataViewRoot.svelte';
	import { tabState } from '$lib/stores/app';

    let DataTable: DataTableType;
    const componentsLoaded: Writable<boolean> = writable(false);

    const loadComponents = async () => {
		const imports = [
			import('$lib/components/lists/table/DataTable.svelte'),
		];

		const results = await Promise.allSettled(imports);
		[ DataTable ] = results.map(result => (result.status === 'fulfilled' ? result.value.default || result.value : null));
		componentsLoaded.set(true);
	}

    const dataKey: string = 'operators'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);

	const setConfig = () => {
		let conf = {...defaultDataTableConfig, ...builtInTableConfig}
		const userTableConfig = StateManager.get(`preferences:${dataKey}:tableConfig`);
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			config.set(conf)
		}
		else {
			config.set(conf)
		}

		ready.set(true)
	}

    onMount(() => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doAggregateCache.set(true)
        // console.log('OPERATORS: LOADING COMPONENTS')
        loadComponents().then( () => {
            setConfig()
            const keys = ['sync:cache'];
            if (get(tabState) === 'leader') keys.push('sync:all');
            void $dataRegister
                .require(keys)
                .catch((err) => console.error('[DataRegister] require failed', err));
        });
    });

    onDestroy(() => {
        ready.set(false)
    });

    $: eventsArray = Array.from( $events.entries() ) 

</script>
<main class="mt-8">
{#if $ready}
    <DataViewRoot {data} {config} key={dataKey} />
{/if}
</main>
