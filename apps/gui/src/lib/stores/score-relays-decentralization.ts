import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { relayCheckAggregates } from './checks.js'; 
import { softwareCounts } from './softwares.js'; 
import { ispCounts } from './isps.js'; 
import { geocodeCounts } from './geocodes.js'; 
import  { type Weights, type RelayScores, computeRelayDecentralizationScore } from '$lib/utils/scores.js';

/**
 * relayScores:
 * A derived store that maps each relay's ID to its decentralization score.
 * Only relays with ISP, Software, and Country are scored.
 * The score ranges from 0 (fully centralized) to 100 (fully decentralized).
 */
export const relayScores: Readable<RelayScores> = derived(
    [relayCheckAggregates, softwareCounts, ispCounts, geocodeCounts],
    ([$relayCheckAggregates, $softwareCounts, $ispCounts, $geocodeCounts]) => {
        const scores: RelayScores = new Map();

        // Precompute totals for normalization
        const totalSoftwares = $softwareCounts.size;
        const totalIsps = $ispCounts.size;
        const totalGeocodes = $geocodeCounts.size;

        // Define weights for each dimension
        const weights: Weights = {
            software: 2,
            country: 1,
            isp: 4
        };
        for (const relay of $relayCheckAggregates) {
            if (relay.isp && relay.software && relay.geocode) {
                const score = computeRelayDecentralizationScore(
                    relay,
                    $softwareCounts,
                    $ispCounts,
                    $geocodeCounts,
                    totalSoftwares,
                    totalIsps,
                    totalGeocodes,
                    weights
                );

                scores.set(relay.relay, score);
            }
        }
        return scores;
    }
);
