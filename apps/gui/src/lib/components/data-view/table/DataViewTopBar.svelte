<script lang="ts">
	import Badge from "$ui/badge/badge.svelte";
	import { Popover, Tabs } from "bits-ui";
	import DataTableShowResults from "./DataTableShowResults.svelte";
	import DataTablePaginator from "./DataTablePaginator.svelte";
	import RelayLivenessCounts from "$lib/components/partials/RelayLivenessCounts.svelte";
	import TableOptions from "./TableOptions.svelte";

    export let config 
    export let dataKey
    export let tableInstance
    export let dataUnfilteredLength

</script>

<div id="dataViewTopBar" class="bg-purple-300/5 border-b-[1px] p-0">
        <div class="flex items-center gap-2">

            <Popover.Root>
                <Popover.Trigger class="inline-block relative -top-1.5 ml-2">
                    <Badge variant="secondary" class="mt-3.5 cursor-pointer text-xs text-purple-300/50">columns</Badge>
                </Popover.Trigger>
                <Popover.Content class="font-mono text-xs z-[5999] mt-3 min-w-[600px] backdrop-blur-md bg-black/50">
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

            <DataTableShowResults {config}  />

            <DataTablePaginator {tableInstance} totalCount={dataUnfilteredLength} />

            <RelayLivenessCounts />
            
        </div>

    </div>