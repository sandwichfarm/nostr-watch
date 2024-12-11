import { derived, get } from 'svelte/store';
import { relayAggregates } from './checks.js';
import { StateManager } from '@nostrwatch/nip66';
import type { Readable } from 'svelte/store';
import { doAggregateCache } from './app.js';

export type Nip = number;
export type NipFormatted = NipFormattedLower | NipFormattedUpper
export type NipFormattedLower = `nip-0${number}` | `nip-${number}`
export type NipFormattedUpper = `NIP-0${number}` | `NIP-${number}`;
export type NipFormattedAlt = NipFormattedNumber | NipFormattedProgrammatic
export type NipFormattedNumber = `0${number}` | `${number}`;
export type NipFormattedProgrammatic = `nip_0${number}` | `nip_${number}`;

export const nips: Readable<number[]> = derived(relayAggregates, ($relayAggregates): Nip[] => {
    return Array.from($relayAggregates.reduce((nips, relayCheck): Set<Nip> => {
        if (relayCheck?.supportedNips?.length > 0) {
            relayCheck.supportedNips.forEach((nip: Nip) => {
                nips.add(nip);
            });
        }
        return nips;
    }, new Set<Nip>()))
})

export const nipCounts = derived(relayAggregates, ($relayAggregates) => {
    const counts = new Map();

    $relayAggregates.forEach((relayCheck) => {
        if (relayCheck?.supportedNips?.length > 0) {
            relayCheck.supportedNips.forEach((nip: Nip) => {
                counts.set(nip, (counts.get(nip) || 0) + 1);
            });
        }
    });

    if (!counts.size) {
        const cachedCounts = StateManager.get('aggregate:nipCounts');
        if (cachedCounts) {
            for (const [nip, count] of cachedCounts) {
                counts.set(nip, count);
            }
        }
    } else {
        if(get(doAggregateCache)) StateManager.set('aggregate:nipCounts', Object.fromEntries(counts));
    }

    return counts;
});

export const nipPercentages = derived(nipCounts, ($nipCounts) => {
    const total = Array.from($nipCounts.values()).reduce((sum, count) => sum + count, 0);
    const percentages = new Map();

    $nipCounts.forEach((count, nip) => {
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        percentages.set(nip, parseFloat(percent));
    });

    return percentages;
});
