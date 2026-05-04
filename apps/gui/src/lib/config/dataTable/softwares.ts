import type { DataKeys, Formatters, NameFormatter } from '$lib/components/data-view/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';

import { pastelPairFromString } from '$utils/colors';
import { escapeHtml, safeImageUrl } from '$utils/sanitize';

export const columnsDisable: DataKeys = []
export const filtersDisable: DataKeys = []

export const columnsShow: DataKeys = ['name', 'totalDeployed', 'versionsNum', 'marketShare']
export const filtersShow: DataKeys = ['version']

export const prettyNames: NameFormatter = {
    totalDeployed: {
        long: 'Total Relays',
        short: 'Relays',
    },
    versionsNum: {
        long: 'Versions',
        short: 'Versions',
    },
    marketShare: {
        long: 'Market Share',
        short: 'Share',
    }
};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if(!text || typeof text !== 'string') return '';
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
}

export const tableFormatters: Formatters = {
    name: (software: string, row: any) => {
        if(typeof software !== 'string') return '-';
        const safeIcon = safeImageUrl(row.icon);
        const safeSoftware = escapeHtml(software);
        const htmlName = `<span class="my-1 text-sm font-mono" style="color:${pastelPairFromString(software)?.dark}">${escapeHtml(truncateWithEllipsis(makeSoftwareReadable(software), 33))}</span>`;
        const icon = safeIcon
            ? `<img src="${safeIcon}" alt="${safeSoftware}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-6 h-6 inline-block mr-2">`
            : '<span class="w-6 h-6 inline-block mr-2"></span>';
        return `${icon}<a href="/relays/software/${btoa(software)}">${htmlName}</a>`;
    },
    versionsNum: (versionsNum: number) => {
        return `<span class="inline-block m-auto text-sm py-2 px-3 rounded-full bg-black/10 dark:bg-white/10">${Number(versionsNum)}</span>`;
    },
    marketShare: (marketShare: number) => {
        return `<span class="text-md">${escapeHtml(String(marketShare.toFixed(1)))}%</span>`;
    }
}


export const filterFormatters: Formatters = {
    name: (software: string) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return escapeHtml(truncateWithEllipsis(software, 33));
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
        columnId: 'totalDeployed',
        direction: 'desc'
    }
}
