/**
 * Kind 20066 - Ephemeral Relay Status Notification
 *
 * Published immediately on up/down transitions only (not init).
 * Tags: [r, url], [O, "down"|"up"], [rtt-open, ms]?, [client, @nostr-watch/rstate]
 */

import type { UnsignedEvent } from 'nostr-tools/pure'
import type { Kind20066Data } from '../types.js'

const KIND = 20066

export function buildKind20066Event(data: Kind20066Data, pubkey: string = ''): UnsignedEvent {
  const tags: string[][] = [
    ['r', data.relayUrl],
    ['O', data.transition === 'up' ? 'online' : 'offline'],
  ]

  if (data.rttOpen !== undefined) {
    tags.push(['rtt-open', String(Math.round(data.rttOpen))])
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
