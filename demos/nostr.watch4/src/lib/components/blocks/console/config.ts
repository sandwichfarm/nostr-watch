import countryCodeToFlagEmoji from 'country-code-to-flag-emoji'
import { relaySpeedGroupResolver, SpeedGroupBars, SpeedGroupColors, SpeedGroups } from '$lib/stores/checks.js';
import { makeSoftwareReadable } from '$lib/synonyms/software.js';

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

export const columnsShow: DataKeys = ['relay', 'rttNormalized', 'geocode', 'paymentRequired', 'authRequired', 'software', 'version']
export const filtersShow: DataKeys = ['network', 'paymentRequired', 'authRequired', 'isp', 'software', 'version']

export const humanReadableNames: NameFormatter = {
    relay: 'Relay',
    rttNormalized: 'Speed',
    countryCode: 'Country',
    paymentRequired: 'Payment',
    authRequired: 'Auth',
};

export const formatters: Formatters = {}

export const tableFormatters: Formatters = {
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
            output += `<span class="p-1 mr-1 inline">${nip}</span>`;
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
    software: (software) => {
        if(typeof software !== 'string') return '-';
        return makeSoftwareReadable(software);
    },
}

export const filterFormatters: Formatters = {
    geocode: (code) => {
        if(!code) return '🌐';
        return countryCodeToFlagEmoji(code);
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
    software: (software) => {
        if(typeof software !== 'string') return '-';
        return makeSoftwareReadable(software);
    }
}