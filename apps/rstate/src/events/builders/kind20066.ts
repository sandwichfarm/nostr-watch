/**
 * Kind 20066 - Ephemeral Relay Status Notification
 *
 * Published immediately on up/down transitions only (not init).
 * Tags: [r, url], [O, "down"|"up"], [rtt-open, ms]?, [client, @nostr-watch/rstate]
 */

import type { Kind20066Data } from '../types.js'
import { buildBaseEvent, relayTag, statusTag, rttOpenTag } from '@nostrwatch/publisher'
import type { UnsignedEvent } from 'nostr-tools/pure'

const KIND = 20066
const CLIENT_TAG = '@nostrwatch/rstate'

export function buildKind20066Event(data: Kind20066Data, pubkey: string = ''): UnsignedEvent {
  const tags: string[][] = [
    relayTag(data.relayUrl),
    statusTag(data.transition === 'up' ? 'online' : 'offline'),
  ]

  if (data.rttOpen !== undefined) {
    tags.push(rttOpenTag(data.rttOpen))
  }

  return buildBaseEvent({ kind: KIND, pubkey, tags, clientTag: CLIENT_TAG })
}
