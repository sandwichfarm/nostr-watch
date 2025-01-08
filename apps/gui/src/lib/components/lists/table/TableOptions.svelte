<script lang="ts">
    import { Nip66Event } from "@nostrwatch/nip66/models";
    import Checkbox from "../../ui/checkbox/checkbox.svelte";
    import { StateManager } from "@nostrwatch/nip66";
    import type { Writable } from "svelte/store";
    import { capitalize } from "@nostrwatch/utils";
    import type { Formatters } from "src/lib/config/dataTable/monitors";

    export let tableKey: string;
    export let config: Writable<DataTableConfig | null>;

    type DataTableConfig = { 
        columnsDisable: string[]
        columnsShow: string[]
        filtersDisable: string[]
        filtersShow: string[]
        humanReadableNames: Record<string, string>
        formatters: Formatters
        tableFormatters: Formatters 
        filterFormatters: Formatters
        tableRowStyler: (row: any) => string
    }

    $: availableKeys = [
        ...($config?.columnsDisable
            ? Nip66Event.keys.filter(key => !$config.columnsDisable.includes(key))
            : Nip66Event.keys),
        "seenBy",
        "lastSeen",
        "seenTimes"
    ];

    const toggleColumnShow = (key: string) => {
        config.update((currentConfig: DataTableConfig) => {
            if (!currentConfig || !Array.isArray(currentConfig.columnsShow)) {
                console.error("columnsShow is not an array");
                return currentConfig;
            }
            let newColumnsShow: string[];
            if (currentConfig.columnsShow.includes(key)) {
                newColumnsShow = currentConfig.columnsShow.filter(k => k !== key);
            } else {
                newColumnsShow = [...currentConfig.columnsShow, key];
            }
            const sortedColumnsShow = availableKeys.filter(k => newColumnsShow.includes(k));
            const newConfig = { ...currentConfig, columnsShow: sortedColumnsShow };
            const tableConfigCache = StateManager.get(`preferences:${tableKey}:tableConfig`);
            StateManager.set(`preferences:${tableKey}:tableConfig`, {
                ...tableConfigCache,
                columnsShow: sortedColumnsShow
            });
            return newConfig;
        });
    };
</script>

<ul class="columns">
    {#each availableKeys as key}
        <li>
            <Checkbox
                checked={$config?.columnsShow.includes(key)}
                onCheckedChange={() => toggleColumnShow(key)}
                value={key}
                class="mr-2"
            />
            {$config?.humanReadableNames?.[key] || capitalize(key)}
        </li>
    {/each}
</ul>

<style lang="postcss">
.columns {
  column-count: 3;
  column-gap: 1.5rem;
  max-width: 960px;
  margin: 0 auto;
}

.columns li {
  break-inside: avoid;
  display: block;
  margin-bottom: 0.5rem;
}

</style>
