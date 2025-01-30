import type { Nip05 } from "nostr-tools/nip05"
import Bolt11 from 'light-bolt11-decoder';

import type { Nip05Service } from "../services/Nip05Service"

import { nip05Service } from "$lib/stores/nip05s.js"
import { get } from "svelte/store"
import { monitorNip05s } from "$lib/stores/monitors.js"
import type { IEvent, NostrEvent } from "@nostrwatch/route66/models"


export const checkManyNip05s = async () => {
    for(const { pubkey, nip05 } of get(monitorNip05s)){
        checkNip05(pubkey, nip05)
    }
}

export const checkNip05 = async ( pubkey: string, nip05: Nip05 ) => {
    const service: Nip05Service = get(nip05Service);
    service.check(pubkey, nip05)
}

export const isPubkey = (value: string): boolean => {
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    return hexRegex.test(value);
}

export const isHex = (value: string): boolean => {
    const hexRegex = /^(0x)?[0-9a-fA-F]+$/;
    return hexRegex.test(value);
}

export const formatNip =( number: number | string): string  => {
    return `NIP-${nipLeadingZero(number)}`;
}

export const nipLeadingZero =( number: number | string): string  => {
    if (typeof number === 'string') {
        number = parseInt(number);
    }
    if (number > 0 || number <= 9) {
        number = number.toString().padStart(2, '0')
    }
    return typeof number === 'string'? number: number.toString()
}

/**
 * Takes a URL string and returns a tuple of two strings:
 * [urlWithoutTrailingSlash, urlWithTrailingSlash].
 */
export const getNormalizedUrlVariants = (url: string): [string, string] => {
    const withoutSlash = url.replace(/\/+$/, '');
    const withSlash = withoutSlash + '/';
    return [withoutSlash, withSlash];
}

export const zapSum = (zaps: IEvent[] | NostrEvent[]): string => {
    return zapSumString(zapSumNum(zaps));
}

export const zapSumNum = (zaps: IEvent[] | NostrEvent[]): number => {
    const bolt11s = zaps.map(zap => {
            const b11 = zap.tags.find(tag => tag[0] === 'bolt11')?.[1]
            if(!b11) return null
            return Bolt11.decode(b11)
        }).filter( b11 => b11 !== null )

    return Math.round(
        bolt11s.reduce((acc, b11) => acc += parseInt(
            b11.sections.find( 
                section => section?.name === 'amount')?.value || "0"
            ),
        0)/1000
    )
}

export const zapSumString = (sum: number): string => {
    if(sum === 0) return '';
    if (sum < 1000) return sum.toString();
    const units = ["", "K", "M", "B", "T", "P", "E"];
    const magnitude = Math.floor(Math.log10(sum) / 3);
    const precision = magnitude - 1; 
    const scaled = sum / Math.pow(1000, magnitude); 
    return `${scaled.toFixed(precision + 1)}${units[magnitude]}`;
}    