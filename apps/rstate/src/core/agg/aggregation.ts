/**
 * Aggregation Service
 *
 * Implements conflict resolution policies for aggregating relay observations
 */

import type {
  RelayObservation,
} from '../types/events.js'
import type {
  AggregationPolicy,
  RelayState,
  NumericAggregation,
  BooleanAggregation,
  SetAggregation,
  EnumAggregation,
} from '../types/aggregation.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'aggregation' })

/**
 * Aggregate numeric values using median and MAD outlier rejection
 * Supports optional weighted median for monitor quality
 */
export function aggregateNumeric(
  values: Array<{ value: number; author: string }>,
  policy: AggregationPolicy,
  weights?: Map<string, number>
): NumericAggregation {
  if (values.length === 0) {
    throw new Error('Cannot aggregate empty numeric values')
  }

  // Compute median (weighted if weights provided)
  let median: number
  if (weights && weights.size > 0) {
    median = computeWeightedMedian(values, weights)
  } else {
    const sorted = values.map((v) => v.value).sort((a, b) => a - b)
    median = sorted[Math.floor(sorted.length / 2)]
  }

  // Calculate MAD (Median Absolute Deviation)
  const sortedValues = values.map((v) => v.value).sort((a, b) => a - b)
  const deviations = sortedValues.map((v) => Math.abs(v - median))
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)]

  // Reject outliers (values > median ± madScale * MAD)
  const threshold = policy.madScale * mad
  const inliers: number[] = []
  const outliers: number[] = []
  const inlierAuthors: Set<string> = new Set()

  for (const { value, author } of values) {
    if (Math.abs(value - median) <= threshold) {
      inliers.push(value)
      inlierAuthors.add(author)
    } else {
      outliers.push(value)
    }
  }

  return {
    median,
    mad,
    values: inliers,
    outliers,
    sampleSize: inliers.length,
    authors: Array.from(inlierAuthors),
  }
}

/**
 * Compute weighted median using interpolation
 */
function computeWeightedMedian(
  values: Array<{ value: number; author: string }>,
  weights: Map<string, number>
): number {
  // Assign weight 1.0 to authors without scores (new monitors)
  const weighted = values.map((v) => ({
    value: v.value,
    weight: weights.get(v.author) || 1.0,
  }))

  // Sort by value
  weighted.sort((a, b) => a.value - b.value)

  // Calculate cumulative weights
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
  const halfWeight = totalWeight / 2

  let cumulativeWeight = 0
  for (let i = 0; i < weighted.length; i++) {
    cumulativeWeight += weighted[i].weight

    if (cumulativeWeight >= halfWeight) {
      // Weighted median is at this index
      return weighted[i].value
    }
  }

  // Fallback to last value (shouldn't happen)
  return weighted[weighted.length - 1].value
}

/**
 * Aggregate boolean values using majority vote
 * Supports optional weighted voting for monitor quality
 */
export function aggregateBoolean(
  values: Array<{ value: boolean; author: string }>,
  policy: AggregationPolicy,
  weights?: Map<string, number>
): BooleanAggregation {
  if (values.length === 0) {
    throw new Error('Cannot aggregate empty boolean values')
  }

  let trueCount = 0
  let falseCount = 0
  let trueWeight = 0
  let falseWeight = 0
  const authors: Set<string> = new Set()

  for (const { value, author } of values) {
    const weight = weights?.get(author) || 1.0

    if (value) {
      trueCount++
      trueWeight += weight
    } else {
      falseCount++
      falseWeight += weight
    }
    authors.add(author)
  }

  const total = trueCount + falseCount
  const totalWeight = trueWeight + falseWeight

  // Use weighted support if weights provided
  const support = weights && weights.size > 0
    ? trueWeight / totalWeight
    : trueCount / total

  const finalValue = support >= policy.quorum

  return {
    value: finalValue,
    trueCount,
    falseCount,
    support,
    sampleSize: total,
    authors: Array.from(authors),
  }
}

/**
 * Aggregate set values (NIPs, labels) with per-item support ratios
 * Supports optional weighted quorum for monitor quality
 */
export function aggregateSet<T extends string | number>(
  itemsByAuthor: Map<string, T[]>,
  policy: AggregationPolicy,
  weights?: Map<string, number>
): SetAggregation<T> {
  if (itemsByAuthor.size === 0) {
    return {
      items: [],
      support: {},
      sampleSize: 0,
      allAuthors: [],
      itemAuthors: {},
    }
  }

  const allAuthors = Array.from(itemsByAuthor.keys())
  const totalAuthors = allAuthors.length

  // Calculate total weight
  const totalWeight = weights && weights.size > 0
    ? allAuthors.reduce((sum, author) => sum + (weights.get(author) || 1.0), 0)
    : totalAuthors

  // Count occurrences of each item (weighted if weights provided)
  const itemWeights = new Map<T, number>()
  const itemAuthorsMap = new Map<T, Set<string>>()

  for (const [author, items] of itemsByAuthor.entries()) {
    const weight = weights?.get(author) || 1.0

    for (const item of items) {
      if (!itemWeights.has(item)) {
        itemWeights.set(item, 0)
        itemAuthorsMap.set(item, new Set())
      }
      itemWeights.set(item, itemWeights.get(item)! + weight)
      itemAuthorsMap.get(item)!.add(author)
    }
  }

  // Calculate support ratios (weighted or unweighted)
  const support: Record<string, number> = {}
  const itemAuthors: Record<string, string[]> = {}
  const items: T[] = []

  for (const [item, weight] of itemWeights.entries()) {
    const authors = itemAuthorsMap.get(item)!
    const ratio = weight / totalWeight
    const key = String(item)

    support[key] = ratio
    itemAuthors[key] = Array.from(authors)

    // Include items that meet the weighted quorum
    if (ratio >= policy.labelQuorum) {
      items.push(item)
    }
  }

  return {
    items,
    support,
    sampleSize: totalAuthors,
    allAuthors,
    itemAuthors,
  }
}

/**
 * Aggregate enum values (network, software) using majority with tiebreaking
 * Supports optional weighted voting for monitor quality
 */
export function aggregateEnum<T extends string>(
  values: Array<{ value: T; author: string; timestamp: number }>,
  weights?: Map<string, number>
): EnumAggregation<T> {
  if (values.length === 0) {
    throw new Error('Cannot aggregate empty enum values')
  }

  // Count occurrences (weighted if weights provided)
  const counts = new Map<T, number>()
  const weightedCounts = new Map<T, number>()
  const authorsByValue = new Map<T, Set<string>>()
  const authors: Set<string> = new Set()

  let totalWeight = 0

  for (const { value, author } of values) {
    const weight = weights?.get(author) || 1.0

    counts.set(value, (counts.get(value) || 0) + 1)
    weightedCounts.set(value, (weightedCounts.get(value) || 0) + weight)

    if (!authorsByValue.has(value)) {
      authorsByValue.set(value, new Set())
    }
    authorsByValue.get(value)!.add(author)
    authors.add(author)
    totalWeight += weight
  }

  // Find majority (by weighted count if weights provided)
  const useWeights = weights && weights.size > 0
  const countsToUse = useWeights ? weightedCounts : counts
  let maxCount = 0
  let winners: Array<{ value: T; count: number }> = []

  for (const [value, count] of countsToUse.entries()) {
    if (count > maxCount) {
      maxCount = count
      winners = [{ value, count }]
    } else if (count === maxCount) {
      winners.push({ value, count })
    }
  }

  // Tiebreak by recency if needed
  let finalValue: T
  if (winners.length === 1) {
    finalValue = winners[0].value
  } else {
    // Find most recent
    const recentValues = values
      .filter((v) => winners.some((w) => w.value === v.value))
      .sort((a, b) => b.timestamp - a.timestamp)
    finalValue = recentValues[0].value
    logger.debug({ winners, finalValue }, 'Enum tie broken by recency')
  }

  const totalCount = values.length
  const support = useWeights
    ? (weightedCounts.get(finalValue) || 0) / totalWeight
    : (counts.get(finalValue) || 0) / totalCount

  // Build distribution (use unweighted counts for transparency)
  const distribution: Record<string, number> = {}
  for (const [value, count] of counts.entries()) {
    distribution[String(value)] = count
  }

  // Build conflicts (minority views)
  const conflicts: Array<{ value: T; count: number; authors: string[] }> = []
  for (const [value, count] of counts.entries()) {
    if (value !== finalValue) {
      conflicts.push({
        value,
        count,
        authors: Array.from(authorsByValue.get(value) || []),
      })
    }
  }

  return {
    value: finalValue,
    support,
    distribution,
    sampleSize: totalCount,
    authors: Array.from(authorsByValue.get(finalValue) || []),
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  }
}

/**
 * Compute aggregated relay state from observations
 * Supports optional monitor quality weights for improved accuracy
 */
export function computeRelayState(
  relayUrl: string,
  observations: RelayObservation[],
  policy: AggregationPolicy,
  weights?: Map<string, number>
): RelayState {
  if (observations.length === 0) {
    throw new Error(`No observations for relay: ${relayUrl}`)
  }

  const state: RelayState = {
    relayUrl,
    updated_at: Date.now(),
    contributingAuthors: Array.from(new Set(observations.map((o) => o.author))),
    observationCount: observations.length,
  }

  // Aggregate network (with optional weights)
  const networks = observations
    .filter((o) => o.network)
    .map((o) => ({ value: o.network!, author: o.author, timestamp: o.created_at }))

  if (networks.length > 0) {
    const enumAgg = aggregateEnum(networks, weights)
    state.network = {
      value: enumAgg.value,
      support: enumAgg.support,
      sampleSize: enumAgg.sampleSize,
      contributingAuthors: enumAgg.authors,
      lastUpdated: Date.now(),
      conflicts: enumAgg.conflicts?.map((c) => ({
        value: c.value,
        support: c.count / enumAgg.sampleSize,
        authors: c.authors,
      })),
    }
  }

  // Aggregate software (with optional weights)
  const softwareFamilies = observations
    .filter((o) => o.software?.family)
    .map((o) => ({ value: o.software!.family!, author: o.author, timestamp: o.created_at }))

  if (softwareFamilies.length > 0) {
    const enumAgg = aggregateEnum(softwareFamilies, weights)
    state.software = {
      family: {
        value: enumAgg.value,
        support: enumAgg.support,
        sampleSize: enumAgg.sampleSize,
        contributingAuthors: enumAgg.authors,
        lastUpdated: Date.now(),
      },
    }
  }

  // Aggregate RTT (with optional weights)
  if (observations.some((o) => o.rtt)) {
    state.rtt = {}

    for (const key of ['open', 'read', 'write', 'info'] as const) {
      const rttValues = observations
        .filter((o) => o.rtt?.[key] !== undefined)
        .map((o) => ({ value: o.rtt![key]!, author: o.author }))

      if (rttValues.length > 0) {
        const numAgg = aggregateNumeric(rttValues, policy, weights)
        state.rtt[key] = {
          value: numAgg.median,
          mad: numAgg.mad,
          support: numAgg.sampleSize / rttValues.length,
          sampleSize: numAgg.sampleSize,
          contributingAuthors: numAgg.authors,
          lastUpdated: Date.now(),
        }
      }
    }
  }

  // Aggregate NIPs (with optional weights)
  const nipsByAuthor = new Map<string, number[]>()
  for (const obs of observations) {
    if (obs.nips && obs.nips.length > 0) {
      nipsByAuthor.set(obs.author, obs.nips)
    }
  }

  if (nipsByAuthor.size > 0) {
    const setAgg = aggregateSet(nipsByAuthor, policy, weights)
    state.nips = {
      list: setAgg.items.sort((a, b) => a - b),
      support: Object.fromEntries(
        Object.entries(setAgg.support).map(([k, v]) => [parseInt(k, 10), v])
      ),
    }
  }

  // Aggregate NIP-11 info document (majority hash wins, tiebreak by recency)
  const withNip11 = observations.filter((o) => o.nip11)
  if (withNip11.length > 0) {
    // Group by JSON hash — identical documents produce the same key
    const buckets = new Map<string, typeof withNip11>()
    for (const obs of withNip11) {
      const key = JSON.stringify(obs.nip11)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(obs)
    }

    // Pick the bucket with the most votes; tiebreak by most recent observation
    let best = withNip11[0]
    let bestCount = 0
    let bestLatest = 0
    for (const group of buckets.values()) {
      const latest = Math.max(...group.map((o) => o.created_at))
      if (group.length > bestCount || (group.length === bestCount && latest > bestLatest)) {
        bestCount = group.length
        bestLatest = latest
        best = group.find((o) => o.created_at === latest)!
      }
    }

    state.nip11 = best.nip11
  }

  // Aggregate requirements (with optional weights)
  const requirementKeys = new Set<string>()
  for (const obs of observations) {
    if (obs.requirements) {
      for (const key of Object.keys(obs.requirements)) {
        requirementKeys.add(key)
      }
    }
  }

  if (requirementKeys.size > 0) {
    state.requirements = {}
    for (const key of requirementKeys) {
      const values = observations
        .filter((o) => o.requirements?.[key] !== undefined)
        .map((o) => ({ value: o.requirements![key] as boolean, author: o.author }))

      if (values.length > 0) {
        const boolAgg = aggregateBoolean(values, policy, weights)
        state.requirements[key] = {
          value: boolAgg.value,
          support: boolAgg.support,
          sampleSize: boolAgg.sampleSize,
          contributingAuthors: boolAgg.authors,
          lastUpdated: Date.now(),
        }
      }
    }
  }

  return state
}
