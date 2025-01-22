import type { DataKeys, Formatters, NameFormatter } from '$lib/components/lists/table/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';

export const columnsDisable: DataKeys = []
export const filtersDisable: DataKeys = []

export const columnsShow: DataKeys = ['name', 'versionsNum', 'marketShare', 'totalDeployed']
export const filtersShow: DataKeys = ['version']

export const humanReadableNames: NameFormatter = {};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
}

export const tableFormatters: Formatters = {
    name: (software: string, row: any) => {
        if(typeof software !== 'string') return '-';
        software = `<span class="my-1 text-xl bg-white/10 py-1 px-2 rounded-sm">${truncateWithEllipsis(makeSoftwareReadable(software), 33)}</span>`;
        const icon = row.icon? 
            `<img src="${row.icon}" alt="${software}" class="w-6 h-6 inline-block mr-2">` 
            :'<span class="w-6 h-6 inline-block mr-2"></span>';
        return `${icon}${software}`;
    },
    versionsNum: (versionsNum: number) => {
        return `<span class="inline-block m-auto text-sm py-2 px-3 rounded-full bg-white/10">${versionsNum}</span>`;
    },
    marketShare: (marketShare: number) => {
        return `<span class="text-lg">${marketShare.toFixed(1)}%</span>`;
    }   
}


export const filterFormatters: Formatters = {
    name: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return truncateWithEllipsis(software, 33);
    }
}

export default {
    humanReadableNames,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow,
    initialSort: 'totalDeployed',
    initialSortDirection: 'desc'
}