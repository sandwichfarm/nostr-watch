/**
 * Delta Detector
 *
 * Compares two RelayState snapshots to produce RelayDelta diffs
 */

import type { RelayState } from '../core/types/aggregation.js'
import type { RelayDelta } from './types.js'

/**
 * Detect diffs between two RelayState snapshots
 */
export function detectDeltas(prev: RelayState, curr: RelayState): RelayDelta[] {
  const deltas: RelayDelta[] = []

  // Network changes
  if (prev.network?.value !== curr.network?.value) {
    deltas.push({
      tag: 'network',
      oldValue: prev.network?.value,
      newValue: curr.network?.value,
    })
  }

  // Software family changes
  if (prev.software?.family?.value !== curr.software?.family?.value) {
    deltas.push({
      tag: 'software.family',
      oldValue: prev.software?.family?.value,
      newValue: curr.software?.family?.value,
    })
  }

  // Software version changes
  if (prev.software?.version?.value !== curr.software?.version?.value) {
    deltas.push({
      tag: 'software.version',
      oldValue: prev.software?.version?.value,
      newValue: curr.software?.version?.value,
    })
  }

  // NIP list changes
  const prevNips = new Set(prev.nips?.list ?? [])
  const currNips = new Set(curr.nips?.list ?? [])

  for (const nip of currNips) {
    if (!prevNips.has(nip)) {
      deltas.push({ tag: `+nip:${nip}`, newValue: String(nip) })
    }
  }
  for (const nip of prevNips) {
    if (!currNips.has(nip)) {
      deltas.push({ tag: `-nip:${nip}`, oldValue: String(nip) })
    }
  }

  // Country changes
  if (prev.country?.value !== curr.country?.value) {
    deltas.push({
      tag: 'country',
      oldValue: prev.country?.value,
      newValue: curr.country?.value,
    })
  }

  // Label changes
  const prevLabels = prev.labels ?? {}
  const currLabels = curr.labels ?? {}
  const allNamespaces = new Set([...Object.keys(prevLabels), ...Object.keys(currLabels)])

  for (const ns of allNamespaces) {
    const prevVals = new Set(prevLabels[ns] ?? [])
    const currVals = new Set(currLabels[ns] ?? [])

    for (const val of currVals) {
      if (!prevVals.has(val)) {
        deltas.push({ tag: `+label:${ns}:${val}`, newValue: val })
      }
    }
    for (const val of prevVals) {
      if (!currVals.has(val)) {
        deltas.push({ tag: `-label:${ns}:${val}`, oldValue: val })
      }
    }
  }

  // NIP-11 field changes
  detectNip11Deltas(prev.nip11, curr.nip11, deltas)

  return deltas
}

function detectNip11Deltas(
  prev: Record<string, any> | undefined,
  curr: Record<string, any> | undefined,
  deltas: RelayDelta[]
): void {
  const trackedFields = ['name', 'description', 'contact', 'pubkey', 'software', 'version']

  for (const field of trackedFields) {
    const oldVal = prev?.[field]
    const newVal = curr?.[field]

    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      deltas.push({
        tag: `nip11.${field}`,
        oldValue: oldVal != null ? String(oldVal) : undefined,
        newValue: newVal != null ? String(newVal) : undefined,
      })
    }
  }
}

/**
 * Merge deltas, keeping the latest for each tag.
 * Paired add/remove deltas cancel out (e.g. +nip:42 then -nip:42 = no delta).
 */
export function mergeDeltas(existing: RelayDelta[], incoming: RelayDelta[]): RelayDelta[] {
  const byTag = new Map<string, RelayDelta>()

  for (const d of existing) byTag.set(d.tag, d)
  for (const d of incoming) byTag.set(d.tag, d)

  // Cancel paired add/remove deltas
  for (const tag of byTag.keys()) {
    const inverse = inverseTag(tag)
    if (inverse && byTag.has(inverse)) {
      byTag.delete(tag)
      byTag.delete(inverse)
    }
  }

  return Array.from(byTag.values())
}

/**
 * Get the inverse of a paired add/remove tag, or null if not a paired tag.
 *   +nip:42  <-> -nip:42
 *   +label:ns:val <-> -label:ns:val
 */
function inverseTag(tag: string): string | null {
  if (tag.startsWith('+')) return '-' + tag.slice(1)
  if (tag.startsWith('-')) return '+' + tag.slice(1)
  return null
}
