<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache } from '$lib/stores/app';
    import { writable, type Writable } from 'svelte/store';
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

    onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        // console.log('OPERATORS: LOADING COMPONENTS')
        await loadComponents().then(setConfig);
            // setConfig()
            // 
            // await (await instance()).ready()
            // if(canSeedFromCache()){
            //     console.log('OPERATORS: SEEDING')
            //     // seedMetaFromCache()
            // }
            // else {
            //     console.log('OPERATORS: BOOTSTRAPPING')
            //     await bootstrapOperatorsMeta()
            //     doBootstrap.set(true)
            //     doAggregateCache.set(true)
            // }
        // });
        await $dataRegister.require([
            'sync:cache',
            'sync:all',
        ]); 
    });

    onDestroy(() => {
        ready.set(false)
    });

    $: eventsArray = Array.from( $events.entries() ) 

</script>
<main class="mt-16">
{#if $ready}
    <DataTable {data} {config} {dataKey} />
{/if}
</main>