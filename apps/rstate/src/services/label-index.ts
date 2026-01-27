/**
 * Label Index Service
 *
 * Generic index for NIP-32 labels
 * Supports efficient queries by namespace and value
 */

import type { Label, RelayObservation } from '../types/events.js'
import type { LabelAggregation } from '../types/aggregation.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'label-index' })

/**
 * Label index entry
 */
interface LabelEntry {
  relays: Set<string>
  authors: Set<string>
  qualities: number[]
}

export class LabelIndexService {
  // Map<namespace, Map<value, LabelEntry>>
  private index: Map<string, Map<string, LabelEntry>> = new Map()

  constructor() {
    logger.info('Label index initialized')
  }

  /**
   * Index labels from observations
   */
  indexObservations(observations: RelayObservation[]): void {
    // Clear and rebuild index
    this.index.clear()

    for (const obs of observations) {
      if (!obs.labels || obs.labels.length === 0) continue

      for (const label of obs.labels) {
        this.addLabel(obs.relayUrl, obs.author, label)
      }
    }

    logger.debug({ namespaces: this.index.size }, 'Label index rebuilt')
  }

  /**
   * Add a label to the index
   */
  private addLabel(relayUrl: string, author: string, label: Label): void {
    let namespaceMap = this.index.get(label.namespace)
    if (!namespaceMap) {
      namespaceMap = new Map()
      this.index.set(label.namespace, namespaceMap)
    }

    let entry = namespaceMap.get(label.value)
    if (!entry) {
      entry = {
        relays: new Set(),
        authors: new Set(),
        qualities: [],
      }
      namespaceMap.set(label.value, entry)
    }

    entry.relays.add(relayUrl)
    entry.authors.add(author)
    if (label.quality !== undefined) {
      entry.qualities.push(label.quality)
    }
  }

  /**
   * Get all namespaces
   */
  getNamespaces(): string[] {
    return Array.from(this.index.keys()).sort()
  }

  /**
   * Get all values for a namespace
   */
  getValues(namespace: string): string[] {
    const namespaceMap = this.index.get(namespace)
    if (!namespaceMap) return []
    return Array.from(namespaceMap.keys()).sort()
  }

  /**
   * Get relays with a specific label
   */
  getRelaysByLabel(namespace: string, value: string): string[] {
    const entry = this.index.get(namespace)?.get(value)
    return entry ? Array.from(entry.relays) : []
  }

  /**
   * Get labels for a specific relay
   */
  getLabelsForRelay(relayUrl: string): Record<string, string[]> {
    const labels: Record<string, string[]> = {}

    for (const [namespace, namespaceMap] of this.index.entries()) {
      const values: string[] = []
      for (const [value, entry] of namespaceMap.entries()) {
        if (entry.relays.has(relayUrl)) {
          values.push(value)
        }
      }
      if (values.length > 0) {
        labels[namespace] = values
      }
    }

    return labels
  }

  /**
   * Get aggregated label data for a namespace-value pair
   */
  getLabelAggregation(namespace: string, value: string, totalAuthors?: number): LabelAggregation | null {
    const entry = this.index.get(namespace)?.get(value)
    if (!entry) return null

    const avgQuality =
      entry.qualities.length > 0
        ? entry.qualities.reduce((a, b) => a + b, 0) / entry.qualities.length
        : undefined

    // Calculate support ratio: authors with this label / total authors
    // If totalAuthors not provided, use count instead of ratio
    const support = totalAuthors && totalAuthors > 0
      ? entry.authors.size / totalAuthors
      : entry.authors.size

    return {
      value,
      support,
      relays: Array.from(entry.relays),
      authors: Array.from(entry.authors),
      avgQuality,
    }
  }

  /**
   * Get all labels grouped by namespace
   */
  getAllLabels(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [namespace, namespaceMap] of this.index.entries()) {
      result[namespace] = Array.from(namespaceMap.keys()).sort()
    }
    return result
  }

  /**
   * Get statistics
   */
  getStats(): {
    namespaceCount: number
    totalValues: number
  } {
    let totalValues = 0
    for (const namespaceMap of this.index.values()) {
      totalValues += namespaceMap.size
    }

    return {
      namespaceCount: this.index.size,
      totalValues,
    }
  }
}
