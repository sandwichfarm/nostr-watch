<script lang="ts">
    import { onMount } from 'svelte';
    import { get, writable, type Readable, type Writable } from 'svelte/store';

    import Input from '$ui/input/input.svelte';
    import * as Dialog from '$lib/components/ui/dialog';

    import { delay } from '@nostrwatch/utils';
    import { deterministicHash } from '@nostrwatch/route66/utils';
    import { linkableState, type LinkableState } from '$utils/linkable-state';
	import Checkbox from '$ui/checkbox/checkbox.svelte';
	import Label from '$ui/label/label.svelte';
	import { sharableConfig, type SharableConfigKeys } from '../table/utils';
	import type { DataTableConfig, SortState } from '../DataTableTypes';
	import Button from '$ui/button/button.svelte';
  
    export let filters: Writable<Record<string, any>>;
    export let config: Writable<DataTableConfig>;
    export let onFilterChange: (config: DataTableConfig) => void = (config) => {}

    type LinkableDataView = {
        filters: Record<string, any>;
        columnsShow: string[];
        filtersShow: string[];
        filtersActive: string[];
        sortState: SortState;
        sidebarCollapsed: boolean;
    }
  
    const objectEquality = (a: Record<string, any>, b: Record<string, any>) => {
      return deterministicHash(a) === deterministicHash(b);
    }

    const availableLinkableKeys: readonly string[] = Object.freeze(['filtersActive', 'filtersShow', 'columnsShow', 'sortState'])
    const linkableKeys: Writable<SharableConfigKeys[]> = writable([...availableLinkableKeys] as SharableConfigKeys[]);
    const validation: Writable<Record<string, boolean>> = writable({});
    
    const initialState: LinkableDataView = { ...sharableConfig($config) as LinkableDataView || {} };
    let LinkableDataView: LinkableState<LinkableDataView> = linkableState<LinkableDataView>(initialState);
    let updatingFromLinkable = false;
    let updatingFromFilters = false;

    const syncLinkStateWithConfig = (state: LinkableDataView) => {
        config.update( (oldConfig) => {
            console.log('config compare', oldConfig, state)
            return { ...oldConfig, ...state }
        });
    }
    
    onMount(async () => {
        const linkConfig = get(LinkableDataView.store);
        updatingFromLinkable = true;
        await delay(1);
        syncLinkStateWithConfig(linkConfig);
        // await delay(1);
        filters.update( () => linkConfig.filtersActive);
        updatingFromLinkable = false;
        await delay(1);
        onFilterChange({ ...get(config), ...linkConfig })
        // }
  
        // LinkableDataView.subscribe(async (linkState: LinkableDataView) => {
        //     if(!dialogOpen) return;
        //     while(updatingFromFilters) await delay(10);
        //     if (!objectEquality(linkState, sharableConfig($config, $linkableKeys))) {
        //         updatingFromLinkable = true;
        //         console.log('updating from linkable', $config)
        //         // config.update( (oldConfig) => {
        //         //     return { ...oldConfig, ...linkConfig }
        //         // });
        //         // filters.set(linkConfig.filtersActive);
        //         updatingFromLinkable = false;
        //     }
        // });
  
        const unsub = filters.subscribe(async (newFilters: Record<string, any>) => {
            if(dialogOpen) return;
            while(updatingFromLinkable) await delay(10);
            const currentLinkState = get(LinkableDataView.store);
            if (!objectEquality(currentLinkState.filtersActive, newFilters)) {
                updatingFromFilters = true;
                const sharable = sharableConfig($config, $linkableKeys)
                LinkableDataView.set({ ...currentLinkState, ...sharable as LinkableDataView });
                updatingFromFilters = false;
            }
        });

        return () => {
            unsub();
        }
    });

    const hash: Readable<string> = LinkableDataView.hash(linkableKeys)

    $: link = `${document.location + $hash}`

    const toggleLinkableKey = (key: string) => {
        if($linkableKeys.length === 1 && $linkableKeys.includes(key)) {
            validation.update(() => ({ ['mustContainOneValue']: true }));
        }
        else {
            validation.update(() => ({ ['mustContainOneValue']: false }));
        }
        if($linkableKeys.includes(key)) {
            linkableKeys.update(keys => keys.filter(k => k !== key));
        } else {
            linkableKeys.update(keys => [...keys, key]);
            if(key === 'filtersActive') {
                linkableKeys.update(keys => {
                    const newKeys = Array.from(new Set([...keys, 'filtersShow', 'columnsShow']))
                    return newKeys
                });
            }
        }
    }

    linkableKeys.subscribe(keys => {
      keys.forEach(key => {
        const checkbox = document.getElementById(key) as HTMLInputElement
        if(checkbox) {
          checkbox.checked = true;
        }
      });
    });

    let dialogOpen = false;
  </script>

  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Trigger>
        <Button variant="secondary"  size="small"  class="mb-2 text-sm font-bold py-1 px-2 mr-1">
        Share View
        </Button>
    </Dialog.Trigger>
    <Dialog.Content class="p-10 z-[9999]">
        <Dialog.Header>
            <Dialog.Title>Generate a link to this view you can share with others.</Dialog.Title>
            <Dialog.Description>
                </Dialog.Description>
        </Dialog.Header>

        <Input value={link} readonly placeholder="Share" />
    
        <div>
        <Checkbox id="filtersActive" onCheckedChange={() => toggleLinkableKey('filtersActive')} checked={$linkableKeys.includes('filtersActive')}  />   
        <Label
            for="filtersActive"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[disabled=true]:cursor-not-allowed peer-data-[disabled=true]:opacity-70"
        >
            Share Active Filters
        </Label>
        </div>

        <div>
        <Checkbox disabled={$linkableKeys.includes('filtersActive')} id="filtersShow" onCheckedChange={() => toggleLinkableKey('filtersShow')} checked={$linkableKeys.includes('filtersShow')} />   
        <Label
            for="filtersShow"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[disabled=true]:cursor-not-allowed peer-data-[disabled=true]:opacity-70"
        >
            Share Visibile Filters
        </Label>
        </div>

        <div>
        <Checkbox disabled={$linkableKeys.includes('filtersActive')} id="columnsShow" onCheckedChange={() => toggleLinkableKey('columnsShow')} checked={$linkableKeys.includes('columnsShow')} />
        <Label
            for="columnsShow"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[disabled=true]:cursor-not-allowed peer-data-[disabled=true]:opacity-70"
        >
            Share Visible Columns
        </Label>
        </div>

        <div>
        <Checkbox id="sortState" onCheckedChange={() => toggleLinkableKey('sortState')} checked={$linkableKeys.includes('sortState')} />
        <Label
            for="sortState"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[disabled=true]:cursor-not-allowed peer-data-[disabled=true]:opacity-70"
        >
            Share Sort State
        </Label>
        </div>

        <!-- <div>
        <Checkbox id="enabledMonitors" onCheckedChange={() => toggleLinkableKey('enabledMonitors')} checked={$linkableKeys.includes('enabledMonitors')} />
        <Label
            for="enabledMonitors"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-data-[disabled=true]:cursor-not-allowed peer-data-[disabled=true]:opacity-70"
        >
            Share Enabled Monitors
        </Label>
        </div> -->
    <!-- <Checkbox label="Include Current View" on:check={() => toggleLinkableKey('view')} checked={$linkableKeys.includes('view')} /> -->

    </Dialog.Content>
  </Dialog.Root>

 
