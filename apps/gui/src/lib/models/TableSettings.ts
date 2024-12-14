import { Preferences } from './Preferences.js';

interface ITableSettings {
    //table config
    columnsSortable: string[];
    columnsFilterable: string[];
    //current sort
    sortColumnKey: string;
    sortDirection: 'ASC' | 'DESC';
    //visibility
    columnsShow: string[];
    filtersShow: string[];
    //filtering
    filtersApplied: Record<string, any>;
    //pane width
    paneWidthPercentage: number;
}

export class TableSettings extends Preferences<ITableSettings> {
    constructor(initialData?: Partial<ITableSettings>) {
        super(initialData);
    }
}