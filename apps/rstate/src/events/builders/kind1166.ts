/**
 * Kind 1166 - Network Aggregate Snapshot Event
 *
 * Published on a configurable schedule with network-wide statistics.
 * Tags: [category, key, value] triplets + [client, @nostr-watch/rstate]
 */

import type { UnsignedEvent } from 'nostr-tools/pure'
import type { Kind1166Data } from '../types.js'

const KIND = 1166

export function buildKind1166Event(data: Kind1166Data, pubkey: string = ''): UnsignedEvent {
  const tags: string[][] = []

  for (const entry of data.categories) {
    tags.push([entry.category, entry.key, entry.value])
  }

  tags.push(['client', '@nostr-watch/rstate'])

  return {
    kind: KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  }
}
