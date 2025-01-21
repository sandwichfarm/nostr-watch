/**
 * Represents the weights for each dimension affecting the decentralization score.
 */
export interface Weights {
    software: number;
    country: number;
    isp: number;
}

/**
 * Represents a combination of ISP, Software, and Country.
 */
export interface Combination {
    isp: string;
    software: string;
    country: string;
}

export type RelayScores = Map<string, number>;

/**
 * Computes the normalized entropy for a given count map.
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
 * Calculates the decentralization score for a specific combination of ISP, Software, and Country.
 *
 * @param combination - The combination of ISP, Software, and Country.
 * @param relayCheckAggregates - An array of relay aggregates.
 * @param weights - The weights assigned to each dimension.
 * @returns The decentralization score between 0 (fully centralized) and 100 (fully decentralized).
 */
export function calculateDecentralizationScore(
    combination: Combination,
    relayCheckAggregates: any[],
    weights: Weights = { software: 1, country: 1, isp: 1 } // Default weights
): number {
    if(!combination.isp || !combination.country || !combination.software) return -1;
    // Filter relay aggregates based on the combination
    const filteredRelays = relayCheckAggregates.filter(relay => 
        relay.isp?.toLowerCase() === combination.isp.toLowerCase() &&
        relay.software?.toLowerCase() === combination.software.toLowerCase() &&
        relay.geocode?.toLowerCase() === combination.country.toLowerCase()
    );

    // If no relays match the combination, return 0 (fully centralized)
    if (filteredRelays.length === 0) return 0;

    // Create count maps for each dimension within the filtered relays
    const softwareCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const ispCounts = new Map<string, number>();

    filteredRelays.forEach(relay => {
        // Software Counts
        const software = relay.software.toLowerCase();
        softwareCounts.set(software, (softwareCounts.get(software) || 0) + 1);

        // Country Counts
        const country = relay.geocode.toLowerCase();
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1);

        // ISP Counts
        const isp = relay.isp.toLowerCase();
        ispCounts.set(isp, (ispCounts.get(isp) || 0) + 1);
    });

    /**
     * Computes normalized entropy for a dimension.
     *
     * @param countMap - Map of counts for the dimension.
     * @returns Normalized entropy between 0 and 100.
     */
    const softwareEntropy = computeNormalizedEntropy(softwareCounts);
    const countryEntropy = computeNormalizedEntropy(countryCounts);
    const ispEntropy = computeNormalizedEntropy(ispCounts);

    // Apply weights to each entropy
    const weightedSum =
        (softwareEntropy * weights.software) +
        (countryEntropy * weights.country) +
        (ispEntropy * weights.isp);

    const totalWeights = weights.software + weights.country + weights.isp;

    if (totalWeights === 0) return 0; // Avoid division by zero

    // Calculate the weighted average
    let score: number = parseFloat((weightedSum / totalWeights).toFixed(1));

    // Ensure the score is within the 0-100 range
    score = Math.max(0, Math.min(score, 100));

    return score;
}

/**
 * Computes the decentralization score for a single relay.
 *
 * @param relay - The relay aggregate.
 * @param softwareCounts - Map of software to their respective counts.
 * @param ispCounts - Map of ISP to their respective counts.
 * @param geocodeCounts - Map of geocode to their respective counts.
 * @param totalSoftwares - Total number of unique softwares.
 * @param totalIsps - Total number of unique ISPs.
 * @param totalGeocodes - Total number of unique geocodes.
 * @param weights - Weights for each dimension.
 * @returns Decentralization score between 0 and 100.
 */
export function computeRelayDecentralizationScore(
    relay: any,
    softwareCounts: Map<string, number>,
    ispCounts: Map<string, number>,
    geocodeCounts: Map<string, number>,
    totalSoftwares: number,
    totalIsps: number,
    totalGeocodes: number,
    weights: Weights
): number {
    // Extract and normalize relay attributes
    const software = relay.software.toLowerCase();
    const isp = relay.isp.toLowerCase();
    const geocode = relay.geocode.toLowerCase();

    // Retrieve frequencies; if not found, consider as unknown with frequency 1
    const softwareFrequency = softwareCounts.get(software) || 1;
    const ispFrequency = ispCounts.get(isp) || 1;
    const geocodeFrequency = geocodeCounts.get(geocode) || 1;

    // Compute inverse frequencies as a measure of uniqueness
    // Using logarithmic scaling to prevent dominance of highly unique attributes
    const softwareScore = Math.log(totalSoftwares / softwareFrequency);
    const ispScore = Math.log(totalIsps / ispFrequency);
    const geocodeScore = Math.log(totalGeocodes / geocodeFrequency);

    // Normalize scores to a 0-100 scale
    // Assuming maximum possible score per dimension is log(total / 1) = log(total)
    const maxSoftwareScore = Math.log(totalSoftwares);
    const maxIspScore = Math.log(totalIsps);
    const maxGeocodeScore = Math.log(totalGeocodes);

    const normalizedSoftwareScore = (softwareScore / maxSoftwareScore) * 100;
    const normalizedIspScore = (ispScore / maxIspScore) * 100;
    const normalizedGeocodeScore = (geocodeScore / maxGeocodeScore) * 100;

    // Apply weights to each dimension
    const weightedSum =
        (normalizedSoftwareScore * weights.software) +
        (normalizedIspScore * weights.isp) +
        (normalizedGeocodeScore * weights.country);

    const totalWeights = weights.software + weights.isp + weights.country;

    if (totalWeights === 0) return 0; // Avoid division by zero

    // Calculate the weighted average
    let score = weightedSum / totalWeights;

    // Clamp the score to ensure it stays within 0-100
    score = Math.max(0, Math.min(score, 100));

    // Round to one decimal place
    return parseFloat(score.toFixed(1));
}
