/**
 * Kind 1066 - Relay Status Delta Event Builder
 *
 * Accumulated delta events published on a configurable schedule.
 * Tags: [r, url], [O, status]?, [rtt-open, ms]?, [delta-tags...]?, [client, @nostr-watch/rstate]
 */

import type { Kind1066Data, RelayDelta, OperationalStatus } from '../types.js'
import { buildBaseEvent, relayTag, statusTag, rttOpenTag } from '@nostrwatch/publisher'
import type { UnsignedEvent } from 'nostr-tools/pure'

const KIND = 1066
const CLIENT_TAG = '@nostrwatch/rstate'

export function buildKind1066Event(data: Kind1066Data, pubkey: string = ''): UnsignedEvent {
  const tags: string[][] = [
    relayTag(data.relayUrl),
  ]

  // Add operational status for transitions
  if (data.status === 'up' || data.status === 'down') {
    tags.push(statusTag(mapStatus(data.status)))
  }

  // Add RTT if online
  if (data.rttOpen !== undefined) {
    tags.push(rttOpenTag(data.rttOpen))
  }

  // Add delta tags
  for (const delta of data.deltas) {
    tags.push(...deltaTags(delta))
  }

  return buildBaseEvent({ kind: KIND, pubkey, tags, clientTag: CLIENT_TAG })
}

function mapStatus(status: OperationalStatus): string {
  switch (status) {
    case 'up': return 'online'
    case 'down': return 'offline'
    default: return status
  }
}

function deltaTags(delta: RelayDelta): string[][] {
  const tags: string[][] = []
  const { tag } = delta

  // NIP additions/removals
  if (tag.startsWith('+nip:') || tag.startsWith('-nip:')) {
    const nip = tag.split(':')[1]
    tags.push([tag.startsWith('+') ? 'N+' : 'N-', nip])
    return tags
  }

  // Label additions/removals: +label:ns:val or -label:ns:val
  if (tag.startsWith('+label:') || tag.startsWith('-label:')) {
    const parts = tag.split(':')
    const prefix = tag.startsWith('+') ? 'l+' : 'l-'
    tags.push([prefix, parts[2], parts[1]])
    return tags
  }

  // Named field changes
  if (delta.newValue !== undefined) {
    tags.push([tag, delta.newValue])
  }

  return tags
}
