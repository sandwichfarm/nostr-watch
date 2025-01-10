export type NameFormatter = Record<string, string>;
export type Formatters = Record<string, Formatter>;
export type DataKeys = string[];

export type Formatter = {
    (value: any, value2?: any): any;
}

export type DataTableConfig = { 
    humanReadableNames: Record<string, string>
    formatters: Formatters
    tableRowStyler: (row: any) => string

    availableColumnKeys: string[]
    tableFormatters: Formatters
    columnsDisable: string[]
    columnsShow: string[]

    availableFilterKeys: string[]
    filtersDisable: string[]
    filtersShow: string[]
    filterFormatters: Formatters
}