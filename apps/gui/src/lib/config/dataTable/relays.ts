import countryCodeToFlagEmoji from 'country-code-to-flag-emoji'
import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { makeSoftwareReadable } from '$lib/synonyms/software.js';
import { formatRelayUrl } from '$lib/utils/routing.js';
import { formatNip, isPubkey } from '$lib/utils/nostr.js';
import { timeAgo } from '$lib/utils/time.js';
import { IconBadgeCheckGreen, IconCheckGreen, IconCheckRed } from '$lib/utils/icons.js';
import { PFP } from '$lib/utils/pfp';

import { monitorsMap } from '$lib/stores/monitors.js';
import type { Monitor } from '@nostrwatch/route66/models/Monitor';
import type { Nip11Fee } from '@nostrwatch/route66/models/Nip11';
import type { DD } from '@nostrwatch/route66/models/Geocoded';
import { Nip66Event } from '@nostrwatch/route66/models';

let $monitorsMap: Map<string, Monitor>;

monitorsMap.subscribe(value => $monitorsMap = value)

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
    (value: any, value2: any): string;
}

export const normalizeKeys = (keys: DataKeys | string) => {
    if(typeof keys === 'string') 
        return keys.toLowerCase()
    if(typeof keys === 'object') 
        return keys.map(k => k.toLowerCase())
}

export const columnsDisable: DataKeys = ['id', 'created_at', 'fees']
export const filtersDisable: DataKeys = ['relay', 'as', 'asname', 'icon', 'banner', 'created_at', 'subscriptionFee', 'publicationFee', 'admissionFee']
export const columnsShow: DataKeys = ['relay', 'lastSeen', 'geocode', 'paymentRequired', 'authRequired']
export const filtersShow: DataKeys = ['networks', 'hasNip11', 'paymentRequired', 'authRequired', 'isp', 'software', 'supportedNips', 'geocode', 'operatorPubkeyValid']

export const availableColumnKeys: string[] = [
    ...(columnsDisable
        ? Nip66Event.keys.filter(key => !columnsDisable.includes(key))
        : Nip66Event.keys),
    "seenBy",
    "lastSeen",
    "seenTimes"
]

export const availableFilterKeys: string[] = [
    ...(columnsDisable
        ? Nip66Event.keys.filter(key => !filtersDisable.includes(key))
        : Nip66Event.keys),
    "seenBy",
    "lastSeen",
    "seenTimes"
]

export const humanReadableNames: NameFormatter = {
    dd: 'Decimal Degrees',
    geohash: 'Geohash',
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    as: 'AS',
    asname: 'AS Name',
    seenBy: 'Seen By',
    seenTimes: 'Seen',
    networks: 'Network',
    lastSeen: 'Last Seen',
    supportedNips: 'NIPs',
    software: 'Software',
    relay: 'Relay',
    rttNormalized: 'Speed',
    geocode: 'Country',
    paymentRequired: 'Payment',
    authRequired: 'Auth',
    isp: 'ISP',
    hasNip11: 'Has Nip11',
    operatorPubkey: 'Op.',
    operatorPubkeyValid: 'Operator Pubkey is Valid',
    rtt: "Avg. RTT",
    admissionFee: "Adm. Cost",
    subscriptionFee: "Sub. Cost",
    publicationFee: "Pub. Cost"
};

const formatFee = (fees: Nip11Fee[]) => {
    if(!fees) return ''
    let str = '';
    for(const fee of Object.values(fees)) {
        // if(!['msat', 'sat'].some( u => u === fee.unit)) continue;
        const amount = fee.unit === 'msats'?  fee.amount/1000: fee.amount;
        str += `<span>`
        str += `<span class="fee-amount">${amount}</span><span class="fee-unit">sats</span>`
        if(fee?.period) {
            str += `<span class="fee-period">/${fee.period/60/60/24} days</span>`
        }
        str += `</span>`
    }
    return str;
}

export const tableFormatters: Formatters = {
    relay: (relay: string, row: any) => {
        const { icon } = row;
        const formatted = truncateWithEllipsis(relay, 44).replace('wss://', '').replace('ws://', '');
        const iconHtml = icon? `<img src="${icon}" class="mr-2 h-6 w-6 rounded-full overflow-hidden inline-block" />`: ''
        return `<a class="text-lg" href="/relays/${formatRelayUrl(relay)}">${iconHtml}${formatted}</a>`;
    },
    // monitorPubkey: (pubkey) => {
    //     let monitor: Monitor = {};
    //     monitorsMap.subscribe((monitors) => { monitor = monitors.get(pubkey) })
    //     let profile: string = '<div class="flex">';
    //     profile += '<div class="flex-shrink-0 mr-2">'
    //     profile += `
    //         <span class="inline-block rounded-full overflow-hidden w-10 h-10">
    //             <img src=${monitor.photo} alt=${monitor.photo} class="w-full h-auto" />
    //         </span>
    //         `
    //     profile += '</div>'
    //      profile += '<div class="">'
    //     if(monitor?.profile?.name){
    //         profile += `<div class="text-sm">${monitor.profile.name}</div>`
    //     }
    //     profile += `<div class="text-xs text-gray-500 block max-w-44 overflow-hidden overflow-ellipsis">${monitor.pubkey}</div>`
    //     profile += '</div>'
    //     profile += '</div>'
    //     return profile
    // },
    dd: (dd: DD ) => {
        if(!dd?.lat || !dd?.lon) return '';
        return `<span class="text-xs font-bold white/50">${dd.lat.toFixed(3)}, ${dd.lon.toFixed(3)}</span>`
    },
    lastSeen: (lastSeen) => {
        if(lastSeen < 0) {
            return ''
        }
        return `<span class="text-xs">${timeAgo(lastSeen*1000)}</span>`;
    },
    seenTimes: (seenTimes) => {
        return `<span class="rounded-full bg-white/20 py-1 px-2 font-bold">${seenTimes}</span>`
    },
    rtt: (rtt) => {
        const wholeNum = Math.round(rtt)
        const rttColor = wholeNum < 500? 'text-green-400': wholeNum < 1000? 'text-orange-400/80': 'text-red-600';
        return `<span class="text-xs font-mono font-bold ${rttColor}">${wholeNum}ms`;
    }, 
    ipv4: (ipv4) => {
        if(!ipv4) return '';
        return ipv4.map(ip => `<span class="p-1 mr-1 block text-xs clear-right">${ip}</span>`).join('');
    },
    seenBy: (pubkeys: string[], row: any): string => {
        let str = '<div class="flex items-center whitespace-nowrap">';
        let i = 0;
        let z = 500;

        if(!pubkeys || !pubkeys.length) return '';
    
        const displayedPubkeys = pubkeys.slice(0, 5);
        const extra = pubkeys.length > 5 ? pubkeys.slice(5) : [];
    
        displayedPubkeys.forEach((pk: string) => {
            const monitor = $monitorsMap.get(pk);
            if (!monitor) return;
    
            str += `<img src="${monitor.photo}" class="border border-[1px] border-black w-5 h-5 relative rounded-full inline-block opacity-${100-i*20} ${i>0? '-ml-[10px]': ''}" style="z-index: ${z};" />`;
            i++;
            z--;
        });
    
        if (extra.length) {
            str += `<span class="text-xs inline-block relative whitespace-nowrap text-white/50">+${extra.length}</span>`;
        }
    
        str += "</div>";
    
        return str;
    },
    subscriptionFee: formatFee,
    publicationFee: formatFee,
    admissionFee: formatFee,
    geocode: (code) => {
        if(!code) return '🌐';
        return `${countryCodeToFlagEmoji(code)} ${code}`;
    },
    rttNormalized: (value) => {
        const isNumber = !isNaN(Number(value));
        if(!isNumber) return '-'; 
        const group: SpeedGroups = speedGroupResolver.resolve(value);
        return `<span class="text-xs" style="font-family: 'monospace';color:${SpeedGroupColors[group]};">${SpeedGroupBars[group]}</span>`;
    },
    supportedNips: (nips) => {
        let output = '';
        for(const nip of nips) {
            output += `<span class="p-1 mr-1 inline text-xs">${nip}</span>`;
        }
        return output;
    },
    paymentRequired: (r) => {
        const text = r? 'yes': 'no'
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },	
    authRequired: (r) => {
        const text = r? 'yes': 'no'
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },
    powRequired: (r) => {
        if(!r) return ''
        return `<span class="text-xs font-bold">${r}</span>`
    },
    hasNip11: (r) => {
        if(!r) return ''
        return `<img class="text-green" src="${IconBadgeCheckGreen}" />`
    },
    operatorPubkey: (pk: string): string => {
        if(!pk) return '';
        const valid = isPubkey(pk)
        const validationClasses = valid? 'text-green-200/50 font-bold': 'text-red-400/80 italic';
        const notice = !valid? '⚠': ''
        return `<span class="inline-block max-w-20 overflow-hidden overflow-ellipsis ${validationClasses}">${notice}${pk}</span>`
    },
    operatorPubkeyValid: (value?: boolean) => {
        if(!value) return ''
        const icon =  value? IconCheckGreen: IconCheckRed;
        return `<img src="${icon}" />`
    },
    software: (software) => {
        if(typeof software !== 'string') return '-';
        software = makeSoftwareReadable(software);
        return truncateWithEllipsis(software, 33);
    },
}

export const filterFormatters: Formatters = {
    geocode: (code) => {
        if(!code) return '🌐';
        return countryCodeToFlagEmoji(code);
    },
    supportedNips: (nip) => {
        return formatNip(nip)
    },
    software: (software) => {
        if(typeof software !== 'string') return '-';
        return makeSoftwareReadable(software);
    }
}


function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
}

export default {
    humanReadableNames,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow,
    availableColumnKeys,
    availableFilterKeys
}