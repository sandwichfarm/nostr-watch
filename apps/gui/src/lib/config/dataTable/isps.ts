import type { DataKeys, Formatters, NameFormatter } from '$lib/components/lists/table/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';
import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
import { getCountryName } from '$lib/stores/iso3166';

export const columnsDisable: DataKeys = ['id']
export const filtersDisable: DataKeys = []

export const columnsShow: DataKeys = ['prettyName', 'count', 'percent', 'softwaresCount']
export const filtersShow: DataKeys = ['softwares']

export const prettyNames: NameFormatter = {
    count: 'Total Relays',
    percent: 'Market Share'
};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';    
    }
    return text;
}

export const tableFormatters: Formatters = {
    prettyName: (prettyName: string, row: any) => {
        if(typeof prettyName !== 'string') return '-';
        prettyName = `<span class="my-1 text-xl bg-black/10 dark:bg-white/10 py-1 px-2 rounded-sm">${prettyName}</span>`;
        const icon = row.icon? 
            `<img src="${row.icon}" alt="${prettyName}" class="w-6 h-6 inline-block mr-2">` 
            :'<span class="w-6 h-6 inline-block mr-2"></span>';
        return `${icon}${prettyName}`;
    },
    percent: (percent: number) => {
        return `<span class="text-md py-4 px-2 rounded-full inline-block text-center bg-black/10 dark:bg-white/10">${percent}%</span>`
    }
    // geocode: (geocode: string, row: any) => {
    //     let emoji
    //     let value
    //     if(geocode === 'unknown'){
    //         emoji = `<span class="mr-2 text-3xl">🌎</span>`
    //         value = `<span class="my-1 text-xl bg-black/10 dark:bg-white/10 py-1 px-2 rounded-sm">unknown</span>`;
    //     }
    //     else {
    //         emoji = `<span class="mr-2 text-3xl">${countryCodeToFlagEmoji(geocode)}</span>`
    //         value = `<span class="my-1 text-xl bg-black/10 dark:bg-white/10 py-1 px-2 rounded-sm">${getCountryName(geocode)}</span>`;
    //     }
    //     return `<span class="block min-w-[300px]">${emoji}${value} [${geocode}]</span>`;
    // },
    // percent: (percent: number) => {
    //     return `<span class="text-md py-4 px-2 rounded-full inline-block text-center bg-black/10 dark:bg-white/10">${percent}%</span>`
    // },
    // relaysCount: (relaysCount: number) => {
    //     return `<span class="text-md py-4 px-2 rounded-full inline-block text-center bg-black/10 dark:bg-white/10">${relaysCount}</span>`
    // }
}

export const availableColumnKeys: string[] = [
    ...(columnsDisable.filter(key => !columnsShow.includes(key))),
]

export const filterFormatters: Formatters = {
    name: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return truncateWithEllipsis(software, 33);
    }
}

export const tableRowStyler = (row: Record<string, any>) => {
    //console.log(`tableRowStyler:`, 'active', row.active, row)
    return {
        'h-[100px]': true
    }
}

export default {
    prettyNames,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow,
    initialSort: 'count',
    initialSortDirection: 'desc',
    tableRowStyler,
    sortState: {
        columnId: 'count',
        direction: 'desc'
    },
}