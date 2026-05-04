import type { DataKeys, Formatters, NameFormatter } from '$lib/components/data-view/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';
import countryCodeToFlagEmoji from 'country-code-to-flag-emoji';
import { getCountryName } from '$lib/stores/iso3166';

import { pastelPairFromString } from '$utils/colors';
import { escapeHtml } from '$utils/sanitize';

export const columnsDisable: DataKeys = ['id']
export const filtersDisable: DataKeys = []

export const columnsShow: DataKeys = ['geocode', 'count', 'percent', 'softwaresCount']
export const filtersShow: DataKeys = ['count', 'softwaresCount', 'softwares']

export const prettyNames: NameFormatter = {};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if(!text || typeof text !== 'string') return '';
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';    
    }
    return text;
}

export const tableFormatters: Formatters = {
    geocode: (geocode: string, row: any) => {
        let emoji
        let value
        if(geocode === 'unknown'){
            emoji = `<span class="mr-2 text-lg">🌎</span>`
            value = `<span class="my-1 text-sm font-mono" style="color:#533">unknown</span>`;
        }
        else {
            // getCountryName returns a trusted hardcoded ISO entry or undefined.
            // Escape its result defensively. countryCodeToFlagEmoji is benign
            // (returns flag emoji codepoints), but escape its output as well.
            const countryName = getCountryName(geocode) as string | undefined;
            const safeCountryName = escapeHtml(countryName || '');
            emoji = `<span class="mr-2 text-lg">${escapeHtml(countryCodeToFlagEmoji(geocode))}</span>`
            value = `<span class="my-1 text-sm font-mono lowercase" style="color:${pastelPairFromString(countryName as string)?.dark} !important;">${safeCountryName}</span>`;
        }
        return `<span class="block min-w-[300px]">${emoji}${value} [${escapeHtml(geocode)}]</span>`;
    },
    relaysCount: (relaysCount: number) => {
        return `<span class="text-md py-4 px-2 rounded-full inline-block text-center bg-black/10 dark:bg-white/10">${Number(relaysCount)}</span>`
    },
    percent: (percent: number) => {
        return `<span class="text-md py-4 px-2 rounded-full inline-block text-center bg-black/10 dark:bg-white/10">${Number(percent)}%</span>`
    }
}


export const filterFormatters: Formatters = {
    name: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return escapeHtml(truncateWithEllipsis(software, 33));
    },
    softwares: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return escapeHtml(truncateWithEllipsis(software, 33));
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
    sortState: {
        columnId: 'count',
        direction: 'desc'
    },
    tableRowStyler
}