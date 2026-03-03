/**
 * Kind 1166 - Network Aggregate Snapshot Event
 *
 * Published on a configurable schedule with network-wide statistics.
 * Tags: [category, key, value] triplets + [client, @nostr-watch/rstate]
 */

import type { Kind1166Data } from '../types.js'
import { buildBaseEvent } from '@nostrwatch/publisher'
import type { UnsignedEvent } from 'nostr-tools/pure'

const KIND = 1166
const CLIENT_TAG = '@nostrwatch/rstate'

export function buildKind1166Event(data: Kind1166Data, pubkey: string = ''): UnsignedEvent {
  const tags: string[][] = []

  for (const entry of data.categories) {
    tags.push([entry.category, entry.key, entry.value])
  }

  return buildBaseEvent({ kind: KIND, pubkey, tags, clientTag: CLIENT_TAG })
}
