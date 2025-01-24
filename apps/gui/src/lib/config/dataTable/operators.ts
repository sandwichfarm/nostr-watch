import type { DataKeys, Formatters, NameFormatter } from '$lib/components/lists/table/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';


export const columnsShow: DataKeys = ['name', 'about', 'reference', 'relaysCount', 'softwaresCount', 'ispsCount']
export const filtersShow: DataKeys = ['softwares', 'isps']

export const columnsDisable: DataKeys = []
export const filtersDisable: DataKeys = []

export const humanReadableNames: NameFormatter = {};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';    
    }
    return text;
}

export const tableFormatters: Formatters = {
    name: (name: string, row: any) => {
        if(typeof name !== 'string') return '-';
        const nameHtml = `<span class="my-1 text-xl bg-white/10 dark:bg-black/10 py-1 px-2 rounded-sm">${truncateWithEllipsis(name, 55)}</span>`;
        const photo = row.photo? 
            `<img src="${row.photo}" alt="${name}" class="w-12 h-12 inline-block mr-2 rounded-full">` 
            :'<span class="w-12 h-12 inline-block mr-2"></span>';
        return `<span class="block min-w-[300px]">${photo}${nameHtml}</span>`;
    },
    about: (about: string) => {
        if(typeof about !== 'string') return '-';
        const aboutHtml = `<span class="text-sm max-w-[400px] block">${truncateWithEllipsis(about, 100)}</span>`;
        return aboutHtml;
    },
    reference: (reference: string) => {
        if(typeof reference !== 'string') return '-';
        const referenceHtml = `<a href="https://njump.me/${reference}" target="_blank" class="text-sm underline">jump</a>`;
        return referenceHtml;
    },
    relaysCount: (relaysCount: number) => {
        if(typeof relaysCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-white/10 dark:bg-black/10">${relaysCount}</span>`;
    },
    ispsCount: (ispsCount: number) => {
        if(typeof ispsCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-white/10 dark:bg-black/10">${ispsCount}</span>`;
    },
    softwaresCount: (softwaresCount: number) => {
        if(typeof softwaresCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-white/10 dark:bg-black/10">${softwaresCount}</span>`;
    }

}


export const filterFormatters: Formatters = {
    name: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return truncateWithEllipsis(software, 33);
    },
    softwares: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return truncateWithEllipsis(software, 33);
    },
}

export const tableRowStyler = (row: Record<string, any>) => {
    //console.log(`tableRowStyler:`, 'active', row.active, row)
    return {
        'h-[100px]': true
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
    sortState: {
        columnId: 'relaysCount',
        direction: 'desc'
    },
    tableRowStyler
}