import type { UnsignedEvent } from 'nostr-tools/pure'

export interface BaseEventOptions {
  kind: number
  pubkey?: string
  tags?: string[][]
  content?: string
  clientTag?: string
}

/** Create a base unsigned event with standard NIP-66 structure. */
export function buildBaseEvent(opts: BaseEventOptions): UnsignedEvent {
  const tags = opts.tags ? [...opts.tags] : []

  if (opts.clientTag) {
    tags.push(['client', opts.clientTag])
  }

  return {
    kind: opts.kind,
    pubkey: opts.pubkey ?? '',
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: opts.content ?? '',
  }
}

/** ['r', url] */
export function relayTag(url: string): string[] {
  return ['r', url]
}

/** ['O', status] where status is 'online' or 'offline' */
export function statusTag(status: string): string[] {
  return ['O', status]
}

/** ['rtt-open', roundedMs] */
export function rttOpenTag(ms: number): string[] {
  return ['rtt-open', String(Math.round(ms))]
}
