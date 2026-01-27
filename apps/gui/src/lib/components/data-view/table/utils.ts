import type { DataTableConfig } from "../DataTableTypes";

export type SharableConfigKeys = 'filters' | 'columnsShow' | 'filtersShow' | 'filtersActive' | 'sortState' | 'sidebarCollapsed';

export const sharableConfig = (
    config: DataTableConfig, 
    keys: SharableConfigKeys[] = ['filters', 'columnsShow', 'filtersShow', 'filtersActive', 'sortState', 'sidebarCollapsed']
): Partial<DataTableConfig> => {
        const shared: Record<string, any> = {};
        keys.forEach((key: SharableConfigKeys) => {
            shared[key] = config?.[key as keyof DataTableConfig];
        });
        return shared as Partial<DataTableConfig>;
}

export const cachableConfig = (config: DataTableConfig) => {
    const cachable: Partial<DataTableConfig> = {...config};
    //remove functions 
    delete cachable.tableFormatters;
    delete cachable.filterFormatters;
    delete cachable.tableRowStyler;
    
    // //remove built-in config that isn't technically user config... :D 
    delete cachable.prettyNames
    delete cachable.columnsDisable
    delete cachable.filtersDisable;
    delete cachable.availableColumnKeys;
    delete cachable.availableFilterKeys;

    //TODO: separate built-in config from user config
    return cachable;
}
