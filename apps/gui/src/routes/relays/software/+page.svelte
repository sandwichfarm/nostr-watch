<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { StateManager } from '@nostrwatch/route66';
    import { doBootstrap } from '$lib/stores/routines';
    import { doAggregateCache } from '$lib/stores/app';
    import { writable, type Writable } from 'svelte/store';
	import { type DataTableConfig, defaultDataTableConfig } from '$lib/components/lists/table/DataTableTypes';
    import builtInTableConfig from '$lib/config/dataTable/softwares.js'
	import { softwareRows as data } from '$lib/stores';
    import { type default as DataTableType } from '$lib/components/lists/table/DataTable.svelte';
	import RelayDimensions from '../relay-dimensions.svelte';

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

    const dataKey: string = 'softwares'
    const config: Writable<DataTableConfig | null> = writable(null);
    const ready: Writable<boolean> = writable(false);

	const setConfig = () => {
		
		let conf = {...defaultDataTableConfig, ...builtInTableConfig}

        //console.log('conf', conf)

		const userTableConfig = StateManager.get(`preferences:${dataKey}:tableConfig`);
		
		if(userTableConfig) {
			conf = {...conf, ...userTableConfig}
			config.set(conf)
		}
		else {
			config.set(conf)
		}

        //console.log('config', $config)

		ready.set(true)
	}

    onMount(async () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        doBootstrap.set(true)
        doAggregateCache.set(true)
        loadComponents().then(setConfig);
    });

    onDestroy(() => {
        ready.set(false)
    });

</script>
<!-- <pre>{JSON.stringify($data, null, 4)}</pre> -->
{#if $ready}
    <RelayDimensions />
    <DataTable {data} {config} {dataKey} />
{/if}