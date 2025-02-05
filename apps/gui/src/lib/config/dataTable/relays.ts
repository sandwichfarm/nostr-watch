import countryCodeToFlagEmoji from 'country-code-to-flag-emoji'
import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { makeSoftwareReadable } from '$lib/synonyms/software.js';
import { generateRelayPathFromUrl } from '$lib/utils/routing.js';
import { formatNip, isPubkey } from '$lib/utils/nostr.js';
import { timeAgo } from '$lib/utils/time.js';
import { IconBadgeCheckGreen, IconCheckGreen, IconCheckRed } from '$lib/utils/icons.js';
import { PFP } from '$lib/utils/pfp';

import { monitorsMap } from '$lib/stores/monitors.js';
import type { Monitor } from '@nostrwatch/route66/models';
import type { Nip11Fee } from '@nostrwatch/route66/models/Nip11';
import type { DD } from '@nostrwatch/route66/models/Geocoded';
import { Nip66CheckEvent, PubkeyProfile } from '@nostrwatch/route66/models';
import { pubkeyProfile, pubkeyUserInstance } from '$lib/stores/helpers/helpers-pubkey';
import type { NameFormatter } from '$lib/components/DataView/DataTableTypes';

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
        ? Nip66CheckEvent.keys.filter(key => !columnsDisable.includes(key))
        : Nip66CheckEvent.keys),
    "seenBy",
    "lastSeen",
    "seenTimes"
]

export const availableFilterKeys: string[] = [
    ...(columnsDisable
        ? Nip66CheckEvent.keys.filter(key => !filtersDisable.includes(key))
        : Nip66CheckEvent.keys),
    "seenBy",
    "lastSeen",
    "seenTimes"
]

export const prettyNames: NameFormatter = {
    dd: {
        short: 'DD',
        long: 'Decimal Degrees'
    },
    geohash: {
        long: 'Geohash'
    },
    ipv4: {
        long: 'IPv4'
    },
    ipv6: {
        long: 'IPv6'
    },
    as: {
        short: 'AS',
        long: 'Autonomous System Number'
    },
    asname: {
        short: 'AS Name',
        long: 'Autonomous System Name'
    },
    seenBy: {
        long: 'Seen By'
    },
    seenTimes: {
        short: 'Seen #',
        long: 'Seen Times'
    },
    networks: {
        long: 'Network'
    },
    lastSeen: {
        long: 'Last Seen'
    },
    supportedNips: {
        short: 'NIPs',
        long: 'Supported NIPs'
    },
    software: {
        short: 'SW',
        long: 'Software'
    },
    relay: {
        long: 'Relay'
    },
    rtt: {
        short: 'Avg. RTT',
        long: 'Average RTT'
    },
    rttNormalized: {
        long: 'Speed'
    },
    geocode: {
        long: 'Country'
    },
    paymentRequired: {
        short: 'Payment Req.',
        long: 'Payment Required'
    },
    authRequired: {
        short: 'Auth Req.',
        long: 'Auth Required'
    },
    isp: {
        short: 'ISP',
        long: 'Internet Service Provider'
    },
    hasNip11: {
        short: 'NIP-11?',
        long: 'Has NIP-11'
    },
    operatorPubkey: {
        short: 'Op. Pk',
        long: 'Operator Pubkey'
    },
    operatorPubkeyValid: {
        short: 'Op. Pk Valid',
        long: 'Operator Pubkey is Valid'
    },
    // software: {
    //     short: 'SW',
    //     long: 'Software'
    // },
    admissionFee: {
        short: 'Adm. Fee',
        long: 'Admission Fee'
    },
    subscriptionFee: {
        short: 'Sub. Fee',
        long: 'Subscription Fee'
    },
    publicationFee: {
        short: 'Pub. Fee',
        long: 'Publication Fee'
    },
    powRequired: {
        short: 'PoW',
        long: 'Proof of Work Required'
    },
    minPowDifficulty: {
        short: 'PoW Diff',
        long: 'Minimum PoW Difficulty'
    },
    restrictedWrites: {
        short: 'RW',
        long: 'Restricted Writes'
    },
    maxFilters: {
        short: 'Max Filters',
        long: 'Maximum Filters'
    },
    maxSubIdLength: {
        short: 'Max Sub ID',
        long: 'Maximum Subscription ID Length'
    },
    maxEventTags: {
        short: 'Max Tags',
        long: 'Maximum Event Tags'
    },
    maxSubscriptions: {
        short: 'Max Subs',
        long: 'Maximum Subscriptions'
    },
    maxContentLength: {
        short: 'Max Content',
        long: 'Maximum Content Length'
    },
    createdAtLowerLimit: {
        short: 'Lower Limit',
        long: 'Created At Lower Limit'
    },
    createdAtUpperLimit: {
        short: 'Upper Limit',
        long: 'Created At Upper Limit'
    }
    // 'Decimal Degrees',
    // geohash: 'Geohash',
    // ipv4: 'IPv4',
    // ipv6: 'IPv6',
    // as: 'AS',
    // asname: 'AS Name',
    // seenBy: 'Seen By',
    // seenTimes: 'Seen',
    // networks: 'Network',
    // lastSeen: 'Last Seen',
    // supportedNips: 'NIPs',
    // software: 'Software',
    // relay: 'Relay',
    // rttNormalized: 'Speed',
    // geocode: 'Country',
    // paymentRequired: 'Payment',
    // authRequired: 'Auth',
    // isp: 'ISP',
    // hasNip11: 'Has Nip11',
    // operatorPubkey: 'Op.',
    // operatorPubkeyValid: 'Operator Pubkey is Valid',
    // rtt: "Avg. RTT",
    // admissionFee: "Adm. Cost",
    // subscriptionFee: "Sub. Cost",
    // publicationFee: "Pub. Cost"
};

const formatFee = (fees: Nip11Fee[]) => {
    if(!fees) return ''
    let str = '';
    for(const fee of Object.values(fees)) {
        // if(!['msat', 'sat'].some( u => u === fee.unit)) continue;
        const amount = fee.unit === 'msats'?  fee.amount/1000: fee.amount;
        str += `<span class="block">`
        str += `<span class="fee-amount">${amount}</span> <span class="fee-unit text-black/50 dark:text-white/50">sats</span>`
        if(fee?.period) {
            str += `<span class="fee-period"> <span class="text-black/50 dark:text-white/50">every</span> ${fee.period/60/60/24} days</span>`
        }
        str += `</span>`
    }
    return str;
}

export const tableFormatters: Formatters = {
    relay: (relay: string, row: any) => {
        const { icon } = row;
        const formatted = `<span class="inline-block my-1 text-xl bg-black/10 dark:bg-white/10 py-1 px-2 rounded-sm">${truncateWithEllipsis(relay, 44).replace('wss://', '').replace('ws://', '')}</span>`;
        const iconHtml = icon? `<img src="${icon}" class="mr-2 h-6 w-6 rounded-full overflow-hidden inline-block" />`: '<span class="inline-block mr-2 h-6 w-6"></span>'
        return `<a class="text-lg" href="/relays/${generateRelayPathFromUrl(relay)}">${iconHtml}${formatted}</a>`;
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
        return `<span class="rounded-full bg-white/20 dark:bg-black/20 py-1 px-2 font-bold">${seenTimes}</span>`
    },
    rtt: (rtt) => {
        const wholeNum = Math.round(rtt)
        if(wholeNum <= 0) return '';
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
            str += `<span class="text-xs inline-block relative whitespace-nowrap text-black/70 dark:text-white/70">+${extra.length}</span>`;
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
        const profile: PubkeyProfile = pubkeyProfile(pk);
        if(!profile) return '';
        let image = ''
        let name = ''
        if(profile?.photo) {
            image = `<span class="inline-block rounded-full overflow-hidden w-8 h-8 mr-2">
                <img src=${profile.photo} alt=${profile.photo} class="w-full h-auto" />
            </span>`
        }
        return `<div class="flex">${image}</div>`
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
    },
    operatorPubkey: (pk: string): string => {
        if(!pk) return ' ';
        if(!isPubkey(pk)) return ' ';
        const profile: PubkeyProfile = pubkeyProfile(pk);
        if(!profile) return ' ';
        if(!profile?.photo) return ' ';
        let name = truncateWithEllipsis(pk, 33);
        if(profile?.name){
            name = truncateWithEllipsis(profile.name, 33);
        }
        let image = `<span class="inline-block rounded-full overflow-hidden w-8 h-8 mr-2">
             <img src="${profile.photo}" alt="${profile.photo}" class="w-full h-auto" />
            </span>`
        return `<div class="flex">
            <div>${image}</div>
            <div>${name}</div>
            </div>`
    }
}


function truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
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
        columnId: 'lastSeen',
        direction: 'desc'
    },
}