import countryCodeToFlagEmoji from 'country-code-to-flag-emoji'
import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { makeSoftwareReadable } from '$lib/synonyms/software.js';
import { formatRelayUrl } from '$lib/utils/routing.js';
import { formatNip, isPubkey } from '$lib/utils/nostr.js';
import { timeAgo } from '$lib/utils/time.js';
import { IconBadgeCheckGreen, IconCheckGreen, IconCheckRed } from '$lib/utils/icons.js';


// const IconBadgeCheckGreen = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2ZDc1MDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1iYWRnZS1jaGVjayI+PHBhdGggZD0iTTMuODUgOC42MmE0IDQgMCAwIDEgNC43OC00Ljc3IDQgNCAwIDAgMSA2Ljc0IDAgNCA0IDAgMCAxIDQuNzggNC43OCA0IDQgMCAwIDEgMCA2Ljc0IDQgNCAwIDAgMS00Ljc3IDQuNzggNCA0IDAgMCAxLTYuNzUgMCA0IDQgMCAwIDEtNC43OC00Ljc3IDQgNCAwIDAgMSAwLTYuNzZaIi8+PHBhdGggZD0ibTkgMTIgMiAyIDQtNCIvPjwvc3ZnPg==`;

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
    (value: any): string;
}

export const normalizeKeys = (keys: DataKeys | string) => {
    if(typeof keys === 'string') 
        return keys.toLowerCase()
    if(typeof keys === 'object') 
        return keys.map(k => k.toLowerCase())
}

export const columnsDisable: DataKeys = ['as', 'asname']
export const filtersDisable: DataKeys = ['as', 'asname']

export const columnsShow: DataKeys = ['relay', 'lastSeen', 'hasNip11', 'operatorPubkey', 'rttNormalized', 'geocode', 'paymentRequired', 'authRequired', 'software', 'supportedNips']
export const filtersShow: DataKeys = ['networks', 'hasNip11', 'paymentRequired', 'authRequired', 'isp', 'software', 'supportedNips', 'geocode', 'operatorPubkeyValid']

export const humanReadableNames: NameFormatter = {
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
    operatorPubkeyValid: 'Operator Pubkey is Valid'
};

export const formatters: Formatters = {}

export const tableFormatters: Formatters = {
    relay: (relay: string, row: any) => {
        const { icon } = row;
        const truncated = truncateWithEllipsis(relay, 44);
        const iconHtml = icon? `<img src="${icon}" class="mr-2 h-6 w-6 rounded-full overflow-hidden inline-block" />`: ''
        return `<a href="/relays/${formatRelayUrl(relay)}">${iconHtml}${truncated}</a>`;
    },
    lastSeen: (lastSeen) => {
        if(lastSeen < 0) {
            return ''
        }
        return `<span class="text-xs">${timeAgo(lastSeen*1000)}</span>`;
    },
    geocode: (code) => {
        if(!code) return '🌐';
        return countryCodeToFlagEmoji(code);
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
        // if(!valid) return `<span class="text-red-500 italic text-xs uppercase">invalid</span>`
        // const icon =  valid? IconCheckGreen: IconCheckRed;
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
    formatters,
    tableFormatters,
    filterFormatters,
    columnsDisable,
    filtersDisable,
    columnsShow,
    filtersShow
}