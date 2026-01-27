<script lang="ts">
    import Checkbox from "../../ui/checkbox/checkbox.svelte";
    import type { Writable } from "svelte/store";
    import { capitalize } from "@nostrwatch/utils";
	import type { DataTableConfig } from "./DataTableTypes";
    import { stateManagerSet } from "$lib/runtime/state-manager-sync";

    export let dataKey: string;
    export let config: Writable<DataTableConfig | null>;

    const toggleColumnShow = (key: string) => {
        config.update((currentConfig: DataTableConfig): DataTableConfig => {
            if (!currentConfig || !Array.isArray(currentConfig.columnsShow)) {
                console.error("columnsShow is not an array");ajvErrors(ajv);
                return currentConfig;
            }
            let newColumnsShow: string[];
            if (currentConfig.columnsShow.includes(key)) {
                newColumnsShow = currentConfig.columnsShow.filter(k => k !== key);
            } else {
                newColumnsShow = [...currentConfig.columnsShow, key];
            }
            const sortedColumnsShow = $config?.availableColumnKeys.filter(k => newColumnsShow.includes(k)) || [];
            const newConfig = { ...currentConfig, columnsShow: sortedColumnsShow };
            void stateManagerSet(`preferences:${dataKey}:tableConfig`, {
                ...$config,
                columnsShow: sortedColumnsShow
            });
            return newConfig;
        });
    };
</script>

<ul class="columns">
    {#each ($config?.availableColumnKeys || []) as key}
        <li>
            <Checkbox
                checked={$config?.columnsShow.includes(key)}
                onCheckedChange={() => toggleColumnShow(key)}
                value={key}
                class="mr-2"
            />
            {$config?.prettyNames?.[key]?.short || capitalize(key)}
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
