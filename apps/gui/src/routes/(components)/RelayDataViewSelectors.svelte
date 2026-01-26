<script lang="ts">
    import { writable, type Writable } from 'svelte/store';
    import { page } from '$app/stores';
    import { replaceState } from '$app/navigation';

	import DataViewSelector from "$lib/components/data-view/partials/DataViewSelector.svelte";
	import RelayDataViewShortcut from "$lib/components/shortcuts/RelayDataViewShortcut.svelte";
	import RelayDimensions from "$routes/relays/relay-dimensions.svelte";

	import type { DataTableConfig, DataViewViews } from '$lib/components/data-view/DataTableTypes';

    import { delay } from '@nostrwatch/utils';
    import { decompress } from 'compress-json';
	

    const TRANSITION_DURATION = 100;
    let shortcutComponent: any;
    let showDataView = true;

    const dataKey: string = "relays";
	const enabledViews: DataViewViews[] = ['table','map']
    
    let onFilterChange: (config: DataTableConfig) => void = (_config) => {}

    const config: Writable<DataTableConfig | null> = writable(null);
    const activeView: Writable<DataViewViews> = writable(enabledViews.length === 1 ? enabledViews[0] : 'table');
    
    const loadPreset = (path: string) => { 
        const hash = path.split('#')?.[1]
        if(!hash) return;
        replaceState(`#${hash}`, $page.state)
        const linkableData = decompress(JSON.parse(atob(hash))) as Partial<DataTableConfig>
        replaceState(``, $page.state)

        showDataView = false;
        delay(TRANSITION_DURATION).then(() => {
            config.update( (currentConfig: DataTableConfig) => {
                return { ...currentConfig, ...linkableData }
            }) 
            delay(1).then(() => {
                if(!$config) return;
                onFilterChange($config)
            })
            delay(TRANSITION_DURATION).then(() => {
                showDataView = true;
                delay(1).then(() => {
                    if(!$config) return;
                    onFilterChange($config)
                })
            })
        })
        //trigger a pseudo transition 
    }

</script>
<div class="flex flex-wrap items-center gap-3 px-3">
    <RelayDimensions />
    <RelayDataViewShortcut
        bind:this={shortcutComponent}
        onClick={loadPreset}
        label="presets"
    />
    <DataViewSelector {enabledViews} {activeView} />
</div>