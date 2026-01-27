export type DataViewColumns = { id: string, key: string, name: string};
export type DataViewData = { data: any[], columns: DataViewColumns[] };

export type DataViewViews = 'table' | 'grid' | 'map';
export type DataViewMapViews = 'bubble' | 'markers' | 'choropleth' | 'heatmap';

export type NameFormatter = Record<string, NameFormats>;
export type NameFormats = {
    long: string
    short?: string,
}

export type DataFormatters = Record<string, DataFormatter>;
export type DataFormatter = {
    (value: any, value2?: any): string | number | boolean | number[] | string[] | null;
}

export type Formatters = Record<string, Formatter>;
export type DataKeys = string[];

export type Formatter = {
    (value: any, value2?: any): any;
}

export type SortState = {
    columnId: string | null
    direction: 'asc' | 'desc' | null
}

export type DataTableConfigDependencies = Record<string, string[]>

export type DataTableConfig = { 
    prettyNames: NameFormatter;
    tableRowStyler: (row: any) => string;
    /** Whether to apply `row.banner` as a table row background image (can be expensive). */
    rowBannerEnabled?: boolean;

    availableColumnKeys: string[];
    columnsDisable: string[];
    columnsShow: string[];

    dataFormatters?: DataFormatters;
    tableFormatters: Formatters;
    filterDataFormatters: Formatters;

    availableFilterKeys: string[];
    filtersDisable: string[];
    filtersShow: string[];
    filterFormatters: Formatters;

    filtersActive: Record<string, any>;

    sidebarCollapsed: boolean;
    sortState: SortState;

    maxBadgeLength: number;
    pageSize: number;

    dataDependencies?: DataTableConfigDependencies;
}

export const defaultDataTableConfig: DataTableConfig = {
    prettyNames: {},
    tableRowStyler: () => '',
    rowBannerEnabled: true,

    availableColumnKeys: [],
    tableFormatters: {},
    columnsDisable: [],
    columnsShow: [],

    availableFilterKeys: [],
    filtersDisable: [],
    filtersShow: [],
    filterFormatters: {},
    filterDataFormatters: {},

    // Filters drawer: collapsed by default (user preference in stored config wins).
    sidebarCollapsed: true,
    sortState: { columnId: '', direction: 'desc' },

    filtersActive: {},

    maxBadgeLength: 0,
    pageSize: 50
}
