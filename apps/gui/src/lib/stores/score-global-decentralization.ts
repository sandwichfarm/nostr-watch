// decentralizationScore.ts

import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { softwareCounts } from './softwares.js'; // Adjust the path as needed
import { geocodeCounts } from './geocodes.js';   // Adjust the path as needed
import { ispCounts } from './isps.js';           // Adjust the path as needed

/**
 * Weights for each dimension affecting the decentralization score.
 */
interface Weights {
    software: number;
    country: number;
    isp: number;
}

/**
 * Define weights for each dimension.
 * Adjust these values to change the influence of each factor.
 * Default weights are set to 1 (neutral).
 */
const weights: Weights = {
    software: 1, // Weight for software distribution
    country: 1,  // Weight for country distribution
    isp: 1       // Weight for ISP distribution
};

/**
 * Compute normalized entropy for a given count map.
 *
 * @param countMap - A map where keys are entities and values are their counts.
 * @returns Normalized entropy value between 0 and 100.
 */
function computeNormalizedEntropy(countMap: Map<string, number>): number {
    const counts: number[] = Array.from(countMap.values());
    const total: number = counts.reduce((sum, count) => sum + count, 0);

    if (total === 0) return 0; // No data implies no decentralization

    // Calculate entropy using base 2 logarithm
    const entropy: number = counts.reduce((sum, count) => {
        const p: number = count / total;
        return sum - p * Math.log2(p);
    }, 0);

    const numEntities: number = counts.length;

    if (numEntities <= 1) return 0; // Single entity implies no decentralization

    const maxEntropy: number = Math.log2(numEntities);
    const normalizedEntropy: number = entropy / maxEntropy;

    // Scale entropy to a percentage
    return normalizedEntropy * 100;
}

/**
 * Decentralization Score Store
 *
 * Calculates a decentralization score between 0 (fully centralized)
 * and 100 (fully decentralized) based on softwareCounts, geocodeCounts, and ispCounts.
 *
 * The score is computed using normalized entropy for each dimension, combined with weights.
 * Higher entropy indicates greater decentralization in that dimension.
 */
export const decentralizationScore: Readable<number> = derived(
    [softwareCounts, geocodeCounts, ispCounts],
    ([$softwareCounts, $geocodeCounts, $ispCounts]): number => {
        
        // Compute normalized entropy for each dimension
        const softwareEntropy: number = computeNormalizedEntropy($softwareCounts);
        const countryEntropy: number = computeNormalizedEntropy($geocodeCounts);
        const ispEntropy: number = computeNormalizedEntropy($ispCounts);

        // Apply weights to each entropy
        const weightedSum: number =
            (softwareEntropy * weights.software) +
            (countryEntropy * weights.country) +
            (ispEntropy * weights.isp);

        const totalWeights: number = weights.software + weights.country + weights.isp;

        if (totalWeights === 0) return 0; // Avoid division by zero

        // Calculate the weighted average
        let score: number = parseFloat((weightedSum / totalWeights).toFixed(1));

        // Ensure the score is within the 0-100 range
        score = Math.max(0, Math.min(score, 100));

        return score;
    }
);
