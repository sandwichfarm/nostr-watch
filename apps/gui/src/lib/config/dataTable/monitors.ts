import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { inactiveDisabledMonitorChecksCount, monitors, monitorsMap } from '$lib/stores/monitors.js';
import type { Monitor } from "@nostrwatch/nip66/models"
import { PFP } from '$lib/utils/pfp.js';
import { get } from 'svelte/store';
import { formatSeconds, timeAgo } from '$lib/utils/time.js';
import { validNip05s } from '$lib/stores/nip05s.js';
import { activeMonitorChecksCount } from '$lib/stores';

type Resolver = (input: any) => any

class SpeedGroupResolver {
    private resolver: Resolver = () => SpeedGroups.Mid;
    private unsubscribe: () => void;
  
    constructor() {
      this.unsubscribe = relaySpeedGroupResolver.subscribe((fn: Resolver) => {
        this.resolver = fn;
      });
    }
  
    resolve(input: number): SpeedGroups {
      return this.resolver(input);
    }
  
    dispose() {
      this.unsubscribe();
    }
}

const speedGroupResolver = new SpeedGroupResolver();
  

export type NameFormatter = Record<string, string>;

export type Formatters = Record<string, Formatter>;

export type DataKeys = string[];

export type Formatter = {
    (value: any, value2?: any): any;
}

export const normalizeKeys = (keys: DataKeys | string) => {
    if(typeof keys === 'string') 
        return keys.toLowerCase()
    if(typeof keys === 'object') 
        return keys.map(k => k.toLowerCase())
}

export const columnsDisable: DataKeys = ['asname']
export const filtersDisable: DataKeys = ['as', 'asname']

export const columnsShow: DataKeys = ['pubkey', 'networks', 'frequency', 'reportingOnline', 'lastActive', 'checks']
export const filtersShow: DataKeys = ['pubkey', 'geohash', 'relays', 'checks']

export const humanReadableNames: NameFormatter = {
    'pubkey': 'Monitor'
    // networks: 'Network',
    // supportedNips: 'NIPs',
    // software: 'Software',
    // relay: 'Relay',
    // rttNormalized: 'Speed',
    // geocode: 'Country',
    // paymentRequired: 'Payment',
    // authRequired: 'Auth',
    // isp: 'ISP'
};

export const tableFormatters: Formatters = {
    frequency: (frequency) => {
        return formatSeconds(frequency)
    },
    reportingOnline: (reportingOnline, {pubkey}) => {
        if(reportingOnline > 0) return reportingOnline;
        const count = get(activeMonitorChecksCount)?.[pubkey]
        return count? count: 0;
    },
    lastActive: (lastActive) => {
        if(lastActive < 0) {
            return ''
        }
        return timeAgo(lastActive*1000)
    },
    nip05: (nip05, row) => {
        if(!nip05) return '';
        const $validNip05s = get(validNip05s)
        const entry = $validNip05s.find( e => e.pubkey = row.pubkey && e.nip05 === nip05)
        if(!entry) return `<span class="text-red-500 text-sm'}">${nip05}</span>`
        return `<span class="${entry.valid? 'text-green-500': 'text-red-500'} text-sm">${nip05}</span>`
    },
    pubkey: (pubkey) => {
        let monitor: Monitor = {};
        monitorsMap.subscribe((monitors) => { monitor = monitors.get(pubkey) })
        let profile: string = '<div class="flex">';
        profile += '<div class="flex-shrink-0 mr-2">'
        profile += `
            <span class="inline-block rounded-full overflow-hidden w-10 h-10">
                <img src=${monitor.photo} alt=${monitor.photo} class="w-full h-auto" />
            </span>
            `
        profile += '</div>'
         profile += '<div class="">'
        if(monitor?.profile?.name){
            profile += `<div class="text-sm">${monitor.profile.name}</div>`
        }
        profile += `<div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis">${monitor.pubkey}</div>`
        profile += '</div>'
        profile += '</div>'
        return profile
    },
    checks: (checks) => {
        if(!checks || checks.length === 0) return '';
        let output = '';
        for(const check of checks) {
            output += `<span class="p-1 mr-1 inline text-xs bg-white bg-opacity-5 rounded-sm">${check}</span>`;
        }
        return output;
    },
    relays: (relays) => {
        return JSON.stringify(relays)
    }
}

export const filterFormatters: Formatters = {
    pubkey: (pubkey) => {
        let monitor: Monitor = {};
        monitorsMap.subscribe((monitors) => { monitor = monitors.get(pubkey) })
        let profile: string = '<div class="flex">';
        profile += '<div class="flex-grow-0 mr-2">'
        if(monitor?.profile?.photo){
            profile += `
            <span class="rounded-full overflow-hidden">
                <img src=${monitor?.profile?.photo} alt=${monitor?.profile?.photo} class="w-20 h-24" />
            </span>
            `
        }
        else {
            profile += `
            <span class="rounded-full overflow-hidden inline-block">
                <img src=${PFP.generate(monitor.pubkey)} alt={photo} class="w-8 h-8" />
            </span>
            `
        }
        profile += '</div>'
         profile += '<div class="">'
        if(monitor?.profile?.name){
            profile += `<div class="text-sm">${monitor.profile.name}</div>`
        }
        profile += `<div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis">${monitor.pubkey}</div>`
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
    return {
        'bg-green-400 bg-opacity-5': row.enabled === true && row.active > 0,
        'opacity-20': !row.active
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
    tableRowStyler
}