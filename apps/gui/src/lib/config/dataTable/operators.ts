import type { DataKeys, Formatters, NameFormatter } from '$lib/components/data-view/DataTableTypes';
import { makeSoftwareReadable } from '$lib/synonyms/software';
import { truncatePubkey, colorFromPubkey } from '$lib/utils/pubkey-color';
import { PFP } from '$lib/utils/pfp';

import { pastelPairFromString } from '$utils/colors'; 


export const columnsShow: DataKeys = ['name', 'about', 'reference', 'relaysCount', 'softwaresCount', 'ispsCount']
export const filtersShow: DataKeys = ['softwares', 'isps']

export const columnsDisable: DataKeys = []
export const filtersDisable: DataKeys = []

// All available column keys for the operators table
export const availableColumnKeys: string[] = [
    'name',
    'about',
    'reference',
    'relaysCount',
    'softwaresCount',
    'ispsCount',
    'nip05',
    'pubkey'
]

// All available filter keys for the operators table
export const availableFilterKeys: string[] = [
    'softwares',
    'isps'
]

export const prettyNames: NameFormatter = {};

function truncateWithEllipsis(text: string, maxLength: number): string {
    if(!text || typeof text !== 'string') return '';
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';    
    }
    return text;
}

export const tableFormatters: Formatters = {
    name: (name: string, row: any) => {
        const pubkey = row?.pubkey;
        const hasProfile = typeof name === 'string' && name.length > 0;

        let displayName: string;
        let photo: string;

        if (hasProfile) {
            // Has kind 0 profile - use name and photo
            displayName = truncateWithEllipsis(name, 55);
            photo = row.photo
                ? `<img src="${row.photo}" alt="${name}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-8 h-8 inline-block mr-2 rounded-full object-cover">`
                : '<span class="w-8 h-8 inline-block mr-2"></span>';
        } else {
            // No kind 0 profile - generate PFP and use truncated pubkey with color
            const truncated = truncatePubkey(pubkey);
            const darkColor = colorFromPubkey(pubkey, { mode: 'dark' });
            const lightColor = colorFromPubkey(pubkey, { mode: 'light' });

            // Generate deterministic PFP from pubkey
            let pfpSrc = '';
            if (typeof window !== 'undefined') {
                try {
                    pfpSrc = PFP.generate(pubkey);
                } catch {}
            }

            photo = pfpSrc
                ? `<img src="${pfpSrc}" alt="${truncated}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-8 h-8 inline-block mr-2 rounded-full object-cover">`
                : '<span class="w-8 h-8 inline-block mr-2"></span>';

            // Use two spans for dark/light mode color switching
            displayName = `<span class="font-mono text-sm"><span class="dark:hidden" style="color: ${lightColor}">${truncated}</span><span class="hidden dark:inline" style="color: ${darkColor}">${truncated}</span></span>`;
        }

        const nameHtml = hasProfile
            ? `<a class="my-1 text-sm font-mono" href="/operators/${pubkey}" style="color:${pastelPairFromString(displayName)?.dark};">${displayName}</a>`
            : `<a class="text-sm font-mono" href="/operators/${pubkey}" style="color:${pastelPairFromString(displayName)?.dark};">${displayName}</a>`;

        return `<span class="block min-w-[300px] flex items-center">${photo}${nameHtml}</span>`;
    },
    about: (about: string, state: any) => {
        if(typeof about !== 'string') return '-';
        const aboutHtml = `<span class="text-sm max-w-[400px] block opacity-80" style="color:${state?.pubkey? pastelPairFromString(state?.pubkey)?.dark: "#444"};">${truncateWithEllipsis(about, 100)}</span>`;
        return aboutHtml;
    },
    reference: (reference: string) => {
        if(typeof reference !== 'string') return '-';
        const referenceHtml = `<a href="https://njump.me/${reference}" target="_blank" class="text-sm underline">jump</a>`;
        return referenceHtml;
    },
    relaysCount: (relaysCount: number) => {
        if(typeof relaysCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-black/10 dark:bg-white/10">${relaysCount}</span>`;
    },
    ispsCount: (ispsCount: number) => {
        if(typeof ispsCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-black/10 dark:bg-white/10">${ispsCount}</span>`;
    },
    softwaresCount: (softwaresCount: number) => {
        if(typeof softwaresCount !== 'number') return '-';
        return `<span class="text-sm rounded-full full py-2 px-3 bg-black/10 dark:bg-white/10">${softwaresCount}</span>`;
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
    // return 'h-[100px]'
    // return {
    //     'h-[100px]': true
    // }
}

export default {
    prettyNames,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow,
    availableColumnKeys,
    availableFilterKeys,
    sortState: {
        columnId: 'relaysCount',
        direction: 'desc'
    },
    tableRowStyler
}
