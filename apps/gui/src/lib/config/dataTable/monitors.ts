import { monitorsMap } from '$lib/stores/monitors.js';
import type { Monitor } from "@nostrwatch/route66/models"
import { PFP } from '$lib/utils/pfp.js';
import { get } from 'svelte/store';
import { formatSeconds, timeAgo } from '$lib/utils/time.js';
import { validNip05s } from '$lib/stores/nip05s.js';
import type { DataKeys, Formatters, NameFormatter } from '$lib/components/data-view/DataTableTypes';

import { pastelPairFromString } from '$utils/colors';
import { escapeHtml, safeImageUrl } from '$utils/sanitize';

export const normalizeKeys = (keys: DataKeys | string) => {
    if(typeof keys === 'string') 
        return keys.toLowerCase()
    if(typeof keys === 'object') 
        return keys.map(k => k.toLowerCase())
}

export const columnsDisable: DataKeys = ['asname']
export const filtersDisable: DataKeys = ['pubkey', 'as', 'asname']

// All available column keys for the monitors table
export const availableColumnKeys: string[] = [
    'pubkey',
    'name',
    'networks',
    'frequency',
    'reportingOnline',
    'reportingOffline',
    'likelyDead',
    'lastActive',
    'checks',
    'nip05',
    'about',
    'geohash',
    'relays',
    'enabled',
    'active',
    'priority'
]

// All available filter keys for the monitors table
export const availableFilterKeys: string[] = [
    'networks',
    'checks',
    'relays',
    'enabled',
    'active'
]

export const columnsShow: DataKeys = ['pubkey', 'networks', 'frequency', 'reportingOnline', 'reportingOffline', 'likelyDead', 'lastActive', 'checks']
export const filtersShow: DataKeys = ['relays', 'checks', 'networks']

export const prettyNames: NameFormatter = {
    pubkey: {
        long: 'Monitor',
    },
    reportingOnline: {
        long: 'Reporting Online',
        short: 'Reporting Online',
    },
    reportingOffline: {
        long: 'Reporting Offline',
        short: 'Reporting Offline',
    },
    likelyDead: {
        long: 'Likely Dead',
        short: 'Likely Dead',
    },
    lastActive: {
        long: 'Last Active',
        short: 'Last Active',
    }
};

export const tableFormatters: Formatters = {
    frequency: (frequency) => {
        return `<span class="block text-center">${formatSeconds(frequency)}</span>`
    },
    reportingOnline: (reportingOnline, row) => {
        if (reportingOnline === null) return '<span class="block text-center text-gray-500">-</span>';
        const value = reportingOnline ?? 0;
        if (!row?.livenessFresh) {
            return `<span class="block text-center font-medium text-gray-400 animate-liveness-pulse liveness-pending">${value}</span>`;
        }
        const colorClass = value > 0 ? 'text-green-400' : 'text-gray-500';
        return `<span class="block text-center font-medium ${colorClass} liveness-fresh">${value}</span>`;
    },
    reportingOffline: (reportingOffline, row) => {
        if (reportingOffline === null) return '<span class="block text-center text-gray-500">-</span>';
        const value = reportingOffline ?? 0;
        if (!row?.livenessFresh) {
            return `<span class="block text-center font-medium text-gray-400 animate-liveness-pulse liveness-pending">${value}</span>`;
        }
        const colorClass = value > 0 ? 'text-orange-400' : 'text-gray-500';
        return `<span class="block text-center font-medium ${colorClass} liveness-fresh">${value}</span>`;
    },
    likelyDead: (likelyDead, row) => {
        if (likelyDead === null) return '<span class="block text-center text-gray-500">-</span>';
        const value = likelyDead ?? 0;
        if (!row?.livenessFresh) {
            return `<span class="block text-center font-medium text-gray-400 animate-liveness-pulse liveness-pending">${value}</span>`;
        }
        const colorClass = value > 0 ? 'text-red-400' : 'text-gray-500';
        return `<span class="block text-center font-medium ${colorClass} liveness-fresh">${value}</span>`;
    },
    lastActive: (lastActive) => {
        if(lastActive < 0) {
            return '<span class="block text-center">-</span>'
        }
        return `<span class="block text-center">${timeAgo(lastActive*1000)}</span>`
    },
    nip05: (nip05, row) => {
        if(!nip05) return '';
        const $validNip05s = get(validNip05s)
        const entry = $validNip05s.find( e => e.pubkey = row.pubkey && e.nip05 === nip05)
        const safe = escapeHtml(nip05);
        if(!entry) return `<span class="text-red-500 text-sm">${safe}</span>`
        return `<span class="${entry.valid? 'text-green-500': 'text-red-500'} text-sm">${safe}</span>`
    },
    pubkey: (pubkey) => {
        // Hex pubkey guard at function entry — pubkey flows into href and CSS style.
        if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return '';
        let monitor: Monitor | undefined;
        monitorsMap.subscribe((monitors) => { monitor = monitors.get(pubkey) })
        if(!monitor) return pubkey;
        let profile: string = `<a href="/monitors/${escapeHtml(String(pubkey))}" class="flex hover:opacity-80 transition-opacity">`;
	        profile += '<div class="flex-shrink-0 mr-2">'
	        const safePhoto = safeImageUrl(monitor?.photo);
	        if(safePhoto){
	            profile += `
	                <span class="inline-block rounded-full overflow-hidden w-10 h-10">
	                    <img src="${safePhoto}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-auto" />
	                </span>
	                `
	        }
        profile += '</div>'
         profile += '<div class="">'
        if(monitor?.profile?.name){
            profile += `<span class="inline-block my-1 text-sm font-mono lowercase" style="color:${pastelPairFromString(monitor.pubkey)?.dark};">${escapeHtml(monitor.profile.name)}</span>`
        }
        profile += `<div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis" style="color:${pastelPairFromString(monitor.pubkey)?.dark};">${escapeHtml(monitor.pubkey)}</div>`
        profile += '</div>'
        profile += '</a>'
        return profile
    },
    checks: (checks) => {
        if(!checks || checks.length === 0) return '';
        let output = '';
        for(const check of checks) {
            output += `<span class="p-1 mr-1.5 inline text-xs bg-white bg-opacity-5 font-mono">${escapeHtml(check)}</span>`;
        }
        return output;
    },
    relays: (relays) => {
        return JSON.stringify(relays)
    }
}

export const filterFormatters: Formatters = {
    pubkey: (pubkey) => {
        // Hex pubkey guard at function entry.
        if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return '';
        let monitor: Monitor = {} as Monitor;
        monitorsMap.subscribe((monitors) => { monitor = monitors.get(pubkey) })
        if(!monitor) return '';
        let profile: string = '<div class="flex">';
        profile += '<div class="flex-grow-0 mr-2">'
	        const safeMonitorPhoto = safeImageUrl(monitor?.profile?.photo);
	        if(safeMonitorPhoto){
	            profile += `
	            <span class="overflow-hidden">
	                <img src="${safeMonitorPhoto}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-16 h-16" />
	            </span>
	            `
	        }
	        else {
	            const safePfp = safeImageUrl(PFP.generate(monitor.pubkey));
	            if(safePfp){
	                profile += `
	                <span class="overflow-hidden inline-block">
	                    <img src="${safePfp}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-8 h-8" />
	                </span>
	                `
	            }
	        }
        profile += '</div>'
         profile += '<div class="">'
        if(monitor?.profile?.name){
            profile += `<div class="text-sm font-mono" style="color:${pastelPairFromString(pubkey)?.dark};">${escapeHtml(monitor.profile.name)}</div>`
        }
        profile += `<div class="text-xs block max-w-44 overflow-hidden overflow-ellipsis opacity-50"  style="color:${pastelPairFromString(pubkey)?.dark};">${escapeHtml(monitor.pubkey)}</div>`
        profile += '</div>'
        profile += '</div>'
        return profile
    }
    // geocode: (code) => {
    //     if(!code) return '🌐';
    //     return countryCodeToFlagEmoji(code);
    // },
    // supportedNips: (nip) => {
    //     return formatNip(nip)
    // },
    // paymentRequired: (r) => {
    //     const text = r? 'yes': 'no'
    //     const style = r? '': 'text-opacity-50'
    //     return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    // },	
    // authRequired: (r) => {
    //     const text = r? 'yes': 'no'
    //     const style = r? '': 'text-opacity-50'
    //     return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    // },
    // software: (software) => {
    //     if(typeof software !== 'string') return '-';
    //     return makeSoftwareReadable(software);
    // }
}


function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
}

export const tableRowStyler = (row: Record<string, any>) => {
    // console.log(`tableRowStyler:`, 'active', row.active, row)
    let classes = [];
    if(row.active === false) classes.push('opacity-20');
    if(row.enabled === true && row.active === true) classes.push('bg-green-400 bg-opacity-5');
    return classes.join(' ');
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
    tableRowStyler
}
