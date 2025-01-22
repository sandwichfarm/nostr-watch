import { derived, get, readable } from 'svelte/store';
import { relayCheckAggregates } from './checks.js';
import { StateManager } from '@nostrwatch/route66';
import type { Readable } from 'svelte/store';
import { doAggregateCache } from './app.js';

export type Nip = number;
export type NipFormatted = NipFormattedLower | NipFormattedUpper
export type NipFormattedLower = `nip-0${number}` | `nip-${number}`
export type NipFormattedUpper = `NIP-0${number}` | `NIP-${number}`;
export type NipFormattedAlt = NipFormattedNumber | NipFormattedProgrammatic
export type NipFormattedNumber = `0${number}` | `${number}`;
export type NipFormattedProgrammatic = `nip_0${number}` | `nip_${number}`;

export const nips: Readable<number[]> = derived(relayCheckAggregates, ($relayCheckAggregates): Nip[] => {
    return Array.from($relayCheckAggregates.reduce((nips, relayCheck): Set<Nip> => {
        if (relayCheck?.supportedNips?.length > 0) {
            relayCheck.supportedNips.forEach((nip: Nip) => {
                nips.add(nip);
            });
        }
        return nips;
    }, new Set<Nip>()))
})

export const nipCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const counts = new Map();

    $relayCheckAggregates.forEach((relayCheck) => {
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

export const NIP_NAMES: Readable<Record<string, string>> = readable({
    "01": "Basic protocol",
    "02": "Contact List and Petnames",
    "03": "OpenTimestamps Attestations for Events",
    "04": "Encrypted Direct Message",
    "05": "Mapping Nostr keys to DNS-based internet identifiers",
    "06": "Basic key derivation from mnemonic seed phrase",
    "07": "window.nostr capability for web browsers",
    "08": "Handling Mentions",
    "09": "Event Deletion",
    "10": "Conventions for clients' use of e and p tags in text events",
    "11": "Relay Information Document",
    "12": "Generic Tag Queries",
    "13": "Proof of Work",
    "14": "Subject tag in Text events",
    "15": "Nostr Marketplace",
    "16": "Event Treatment",
    "17": "Private Direct Messages",
    "18": "Reposts",
    "19": "bech32-encoded entities",
    "20": "Command Results",
    "21": "nostr: URI scheme",
    "22": "Generic Comments",
    "23": "Long-form Content",
    "24": "Extra metadata fields and tags",
    "25": "Reactions",
    "26": "Delegated Event Signing",
    "27": "Text Note References",
    "28": "Public Chat",
    "29": "Relay-based Groups",
    "30": "Custom Emoji",
    "31": "Dealing with Unknown Events",
    "32": "Labeling",
    "33": "Parameterized Replaceable Events",
    "34": "git stuff",
    "35": "Torrents",
    "36": "Sensitive Content / Content Warning",
    "38": "User Statuses",
    "39": "External Identities in Profiles",
    "40": "Expiration Timestamp",
    "42": "Authentication of clients to relays",
    "44": "Encrypted Payloads (Versioned)",
    "45": "Counting results",
    "46": "Nostr Remote Signing",
    "47": "Nostr Wallet Connect",
    "48": "Proxy Tags",
    "49": "Private Key Encryption",
    "50": "Search Capability",
    "51": "Lists",
    "52": "Calendar Events",
    "53": "Live Activities",
    "54": "Wiki",
    "55": "Android Signer Application",
    "56": "Reporting",
    "57": "Lightning Zaps",
    "58": "Badges",
    "59": "Gift Wrap",
    "64": "Chess",
    "65": "Relay List Metadata",
    "70": "Protected Events",
    "71": "Video Events",
    "72": "Moderated Communities",
    "73": "External Content IDs",
    "75": "Zap Goals",
    "77": "Negentropy",
    "78": "Application-specific data",
    "84": "Highlights",
    "89": "Recommended Application Handlers",
    "90": "Data Vending Machines",
    "92": "Media Attachments",
    "94": "File Metadata",
    "96": "HTTP File Storage Integration",
    "98": "HTTP Auth",
    "99": "Classified Listings",
  });