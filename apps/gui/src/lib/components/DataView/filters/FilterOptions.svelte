<script lang="ts">
    import Checkbox from "../../ui/checkbox/checkbox.svelte";
    import { StateManager } from "@nostrwatch/route66";
    import type { Writable } from "svelte/store";
    import { capitalize, delay } from "@nostrwatch/utils";
	import type { DataTableConfig, Formatters } from "./DataTableTypes";

    export let dataKey: string;
    export let config: Writable<DataTableConfig | null>;
    export let onChange: (config: DataTableConfig) => void;

    const toggleFilterShow = (key: string) => {
        config.update((currentConfig: DataTableConfig) => {
            if (!currentConfig || !Array.isArray(currentConfig.filtersShow)) {
                console.error("filtersShow is not an array");
                return currentConfig;
            }
            let newFiltersShow: string[];
            if (currentConfig.filtersShow.includes(key)) {
                newFiltersShow = currentConfig.filtersShow.filter(k => k !== key);
            } else {
                newFiltersShow = [...currentConfig.filtersShow, key];
            }
            const sortedFiltersShow = $config?.availableFilterKeys.filter(k => newFiltersShow.includes(k)) || [];
            const newConfig = { ...currentConfig, filtersShow: sortedFiltersShow };
            const tableConfigCache = StateManager.get(`preferences:${dataKey}:filtersConfig`);
            StateManager.set(`preferences:${dataKey}:filtersConfig`, {
                ...tableConfigCache,
                filtersShow: sortedFiltersShow || []
            });
            return newConfig;                                       
        });
        delay(100).then(() => onChange($config as DataTableConfig));
    };
</script>

<ul class="columns">
    {#each ($config?.availableFilterKeys || []) as key}
        <li>
            <Checkbox
                checked={$config?.filtersShow.includes(key)}
                onCheckedChange={() => toggleFilterShow(key)}
                value={key}
                class="mr-2"
            />
            {$config?.prettyNames?.[key]?.long || capitalize(key)}
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
