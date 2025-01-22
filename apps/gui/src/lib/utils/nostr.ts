import type { Nip05 } from "nostr-tools/nip05"

import type { Nip05Service } from "../services/Nip05Service"

import { nip05Service } from "$lib/stores/nip05s.js"
import { get } from "svelte/store"
import { monitorNip05s } from "$lib/stores/monitors.js"


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
function getNormalizedUrlVariants(url: string): [string, string] {
    const withoutSlash = url.replace(/\/+$/, '');
    const withSlash = withoutSlash + '/';
    return [withoutSlash, withSlash];
  }