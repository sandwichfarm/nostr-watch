import countryCodeToFlagEmoji from 'country-code-to-flag-emoji'
import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { makeSoftwareReadable } from '$lib/synonyms/software.js';
import { generateRelayPathFromUrl } from '$lib/utils/routing.js';
import { expandKinds, formatNip, isPubkey } from '$lib/utils/nostr.js';
import { formatSeconds, timeAgo } from '$lib/utils/time.js';
import { IconBadgeCheckGreen, IconCheckGreen, IconCheckRed } from '$lib/utils/icons.js';
import { PFP } from '$lib/utils/pfp';

import { monitorsMap } from '$lib/stores/monitors.js';
import type { Monitor } from '@nostrwatch/route66/models';
import type { Nip11Fee, RetentionDetails } from '@nostrwatch/route66/models/Nip11';
import type { DD } from '@nostrwatch/route66/models/Geocoded';
import { Nip66CheckEvent, PubkeyProfile } from '@nostrwatch/route66/models';
import { pubkeyProfile, pubkeyUserInstance, type StorePubkeyProfile } from '$lib/stores/helpers/helpers-pubkey';
import type { DataFormatters, DataTableConfigDependencies, NameFormatter } from '$lib/components/data-view/DataTableTypes';
import { nip11 } from 'nostr-tools';
import { nip11ValidationErrorCount } from '$stores/nip11-validations';

import { pastelPairFromString } from '$utils/colors'; 

import pickaxe from 'lucide-svelte/icons/pickaxe';



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
export const filtersShow: DataKeys = ['liveness', 'networks', 'hasNip11', 'paymentRequired', 'authRequired', 'isp', 'software', 'supportedNips', 'geocode', 'operatorPubkeyValid']

const availableKeys: string[] = [
    ...(columnsDisable
        ? Nip66CheckEvent.keys.filter(key => !columnsDisable.includes(key))
        : Nip66CheckEvent.keys),
    "seenBy",
    "lastSeen",
    "seenTimes",
    "liveness",
    "nip11IsValid",
    "nip11ValidationErrors"
]

export const availableColumnKeys = [...availableKeys]
export const availableFilterKeys = [...availableKeys]

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
    liveness: {
        short: 'Live',
        long: 'Liveness'
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
        short: 'Restr. Writes',
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
    },
    nip11IsValid: {
        short: 'NIP-11 Valid',
        long: 'NIP-11 is Valid'
    },
    nip11ValidationErrors: {
        short: 'NIP-11 Errors #',
        long: 'NIP-11 Validation Errors Count'
    }
};

function deduplicateArrayOfObjects<T>(array: T[], keys: (keyof T)[]): T[] {
    const seen = new Set<string>();
    return array.filter(item => {
      const compositeKey = keys.map(key => item[key]).join("|");
      if (seen.has(compositeKey)) {
        return false;
      }
      seen.add(compositeKey);
      return true;
    });
  }

const formatFee = (fees: Nip11Fee[]) => {
    if(!fees || !Array.isArray(fees)) return ''
    let str = '';
    fees = deduplicateArrayOfObjects(fees, ['amount', 'period']);
    for(const fee of fees) {
        // if(!['msat', 'sat'].some( u => u === fee.unit)) continue;
        let amount = fee.unit === 'msats'? fee.amount/1000: fee.amount;
        if(amount > 10) {
            amount = Math.round(amount);
        }

        str += `<span class="block">`
        str += `<span class="fee-amount">${amount}</span> <span class="fee-unit text-black/50 dark:text-white/50">sats</span>`
        if(fee?.period) {
            str += `<span class="fee-period"> <span class="text-black/50 dark:text-white/50">every</span> ${fee.period/60/60/24} days</span>`
        }
        str += `</span>`
    }
    return str;
}

export const dataDependencies: DataTableConfigDependencies = {
    'nip11IsValid': ['hasNip11'],
    'nip11ValidationErrors': ['hasNip11'],
    'powRequired': ['minPowDifficulty'],
    'hasBanner': ['banner'],
    'hasIcon': ['icon'],
    'operatorPubkeyValid': ['operatorPubkey'],
    'admissionFee': ['fees'],
    'subscriptionFee': ['fees'],
    'publicationFee': ['fees']
}

const formatFeeData = (fees: Nip11Fee[]) => {
    if(!fees || !fees?.length) return null
    fees.sort((a, b) => a.amount - b.amount);
    const { amount, unit } = fees[0];
    if(unit === 'msats') return amount/1000;
    return fees[0].amount;
}

export const dataFormatters: DataFormatters = {
    admissionFee: formatFeeData,
    subscriptionFee: formatFeeData,
    publicationFee: formatFeeData
}

export const tableFormatters: Formatters = {
    

    relay: (relay: string, row: any) => {
        const { icon } = row;
        const formatted = `<span style="color: ${pastelPairFromString(relay)?.dark};" class="inline-block my-1 text-sm font-mono py-1 px-2 rounded-sm">${truncateWithEllipsis(relay, 44).replace('wss://', '').replace('ws://', '')}</span>`;
        const iconHtml = icon
            ? `<img src="${icon}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="mr-2 h-6 w-6 rounded-full overflow-hidden inline-block" />`
            : '<span class="inline-block mr-2 h-6 w-6"></span>';
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
    networks: (networks: string[]) => {
        if(!networks || !networks.length) return '';
        return networks.map(network => {
            const icon = `${network}.svg`
            const iconDark = `${network}-dark.svg`
            const iconPath = '/icon/network/'
            const iconClass = `background-image: url('${iconPath}${iconDark}'); background-size: contain; background-position: center; background-repeat: no-repeat; width: 24px; height: 24px; display: inline-block;`
            return `<span style="${iconClass}"></span>`
        }).join('');
    },
    dd: (dd: DD ) => {
        if(!dd?.lat || !dd?.lon) return '';
        return `<span class="text-xs font-bold white/50 font-mono">${dd.lat.toFixed(3)}, ${dd.lon.toFixed(3)}</span>`
    },
    lastSeen: (lastSeen) => {
        if(lastSeen < 0) {
            return ''
        }
        return `<span class="text-xs font-mono">${timeAgo(lastSeen*1000)}</span>`;
    },
    seenTimes: (seenTimes) => {
        return `<span class="rounded-full bg-white/20 dark:bg-black/20 py-1 px-2 font-bold font-mono">${seenTimes}</span>`
    },
    rtt: (rtt) => {
        const wholeNum = Math.round(rtt)
        if(wholeNum <= 0) return '';
        const rttColor = wholeNum < 500? 'text-green-400': wholeNum < 1000? 'text-orange-400/80': 'text-red-600';
        return `<span class="font-mono text-xs font-mono font-bold ${rttColor}">${wholeNum}ms`;
    }, 
    ipv4: (ipv4) => {
        if(!ipv4) return '';
        return ipv4.map(ip => `<span class="p-1 mr-1 block text-xs clear-right font-mono">${ip}</span>`).join('');
    },
    nip11ValidationErrors: (errorsCount) => {
        if(errorsCount === 0) 
            return ``; 
        else 
            return `<span class="font-mono text-xs font-bold bg-red-600/50 px-2 py-1 rounded-full inline-block">
                ${errorsCount}
                </span>`;    
    },
    seenBy: (pubkeys: string[]): string => {
        let str = '<div class="flex items-center whitespace-nowrap">';
        let i = 0;
        let z = 500;

        if(!pubkeys || !pubkeys.length || !Array.isArray(pubkeys)) return '';
    
        const displayedPubkeys = pubkeys.slice(0, 5);
        const extra = pubkeys.length > 5 ? pubkeys.slice(5) : [];
    
        displayedPubkeys.forEach((pk: string) => {
            const monitor = $monitorsMap.get(pk);
            if (!monitor) return;
    
            str += `<img src="${monitor.photo}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="border border-[1px] border-black w-5 h-5 relative rounded-full inline-block opacity-${100-i*20} ${i>0? '-ml-[10px]': ''}" style="z-index: ${z};" />`;
            i++;
            z--;
        });
    
        if (extra.length) {
            str += `<span class="text-xs inline-block relative whitespace-nowrap text-black/70 dark:text-white/70">+${extra.length}</span>`;
        }
    
        str += "</div>";
    
        return str;
    },
    retentionPolicy: (retentionPolicy) => {
        if (!Array.isArray(retentionPolicy) || retentionPolicy.length === 0) return "";

        retentionPolicy = deduplicateArrayOfObjects(retentionPolicy, ["kinds", "time", "count"]);
    
        let str = '<div class="flex flex-wrap items-center gap-2 text-sm">';
    
        retentionPolicy.forEach((rule) => {
          if (typeof rule !== "object" || rule === null) return;
    
          const kinds = rule.kinds ? expandKinds(rule.kinds).join(", ") : "All";
          const time = rule.time === null ? "∞" : rule.time ? formatSeconds(rule.time) : "";
          const count = rule.count ? rule.count.toLocaleString() : "";
    
          // Special case: If it's "All" kinds & time is "∞", return only the infinity symbol
          if (kinds === "All" && time === "∞") {
            str += `<span class="text-lg font-semibold">∞</span>`;
            return;
          }
    
          str += `
            <div class="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-lg shadow-sm">
              <span class="text-gray-900 dark:text-gray-100">${kinds !== "All" ? `🔹 ${kinds}` : "All"}</span>
              ${time ? `<span class="text-gray-600 dark:text-gray-300">⏳ ${time}</span>` : ""}
              ${count ? `<span class="text-gray-600 dark:text-gray-300">📦 ${count}</span>` : ""}
            </div>
          `;
        });
    
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
        const text = r? 'yes': ''
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },	
    authRequired: (r) => {
        const text = r? 'yes': ''
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },
    powRequired: (r) => {
        const text = r? 'yes': ''
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },
    restrictedWrites: (r) => {
        const text = r? 'yes': ''
        const style = r? '': 'text-opacity-50'
        return `<span class="p-1 inline-block mr-1 uppercase text-xs bold text-${style}">${text}</span>`
    },
    minPowDifficulty: (r) => {
        if(!r) return ''
        return `<span class="text-xs font-bold">⛏ ${r}</span>`
    },
    hasNip11: (r) => {
        if(!r) return ''
        return `<img class="text-green" src="${IconBadgeCheckGreen}" />`
    },
    nip11IsValid: (valid: boolean, row: any) => {
        if(row.hasNip11 === undefined) return '<span class="opacity-20">n/a</span>';
        return valid
                    ? `<span class="text-green-600">✓</span>`
                    : `<span class="text-red-500">✗</span>`;
    },
    operatorPubkey: (pk: string): string => {
        if(!pk || typeof pk !== 'string') return '';
        const profile: StorePubkeyProfile = pubkeyProfile(pk);
        if(!profile) return '';
        let image = ''
        let name = ''
        if(profile?.photo) {
            image = `<a href="/operators/${profile.pubkey}" class="inline-block rounded-full overflow-hidden w-8 h-8 mr-2">
                <img src="${profile.photo}" alt="${profile.photo}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-auto" />
            </a>`
        }
        return `<div class="flex">${image}</div>`
    },
    operatorPubkeyValid: (value?: boolean) => {
        if(!value) return ''
        const icon =  value? IconCheckGreen: IconCheckRed;
        return `<img src="${icon}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
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
             <img src="${profile.photo}" alt="${profile.photo}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-auto" />
            </span>`
        return `<div class="flex">
            <div>${image}</div>
            <div>${name}</div>
            </div>`
    }
}


function truncateWithEllipsis(text: string, maxLength: number): string {
    if(!text || typeof text !== 'string') return '';
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + '...';
    }
    return text;
}

export const tableRowStyler = (row: Record<string, any>) => {
    if(!row) return ''
    const liveness = row?.liveness;
    if(liveness === 'offline') return 'opacity-60';
    if(liveness === 'dead') return 'opacity-50 line-through';
    return '';
}

export default {
    prettyNames,
    dataFormatters,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow,
    availableColumnKeys,
    availableFilterKeys,
    tableRowStyler,
    rowBannerEnabled: false,
    sortState: {
        columnId: 'lastSeen',
        direction: 'desc'
    }
} 
