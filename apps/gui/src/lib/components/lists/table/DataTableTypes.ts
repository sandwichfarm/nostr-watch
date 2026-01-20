export type NameFormatter = Record<string, string>;
export type Formatters = Record<string, Formatter>;
export type DataKeys = string[];

export type Formatter = {
    (value: any, value2?: any): any;
}

export type SortState = {
    columnId: string | null
    direction: 'asc' | 'desc' | null
}

export type DataTableConfig = { 
    prettyNames: Record<string, string>;
    tableRowStyler: (row: any) => string;

    availableColumnKeys: string[];
    dataFormatters?: Formatters;
    tableFormatters: Formatters;
    columnsDisable: string[];
    columnsShow: string[];

    availableFilterKeys: string[];
    filtersDisable: string[];
    filtersShow: string[];
    filterFormatters: Formatters;

    activeFilters: Record<string, any>;

    sidebarCollapsed: boolean;
    sortState: SortState;

    maxBadgeLength: number;
    pageSize: number;
}

export const defaultDataTableConfig: DataTableConfig = {
    prettyNames: {},
    tableRowStyler: () => '',

    availableColumnKeys: [],
    tableFormatters: {},
    columnsDisable: [],
    columnsShow: [],

    availableFilterKeys: [],
    filtersDisable: [],
    filtersShow: [],
    filterFormatters: {},

    sidebarCollapsed: false,
    sortState: { columnId: '', direction: 'desc' },

    activeFilters: {},

    maxBadgeLength: 0,
    pageSize: 50
}
