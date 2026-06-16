/**
 * Kind 30385 - Trusted Relay Assertion
 *
 * Parameterized replaceable relay assertion.
 * Tags: [d, canonicalRelayUrl], [status, ...], score/component tags,
 * [algorithm, rstate-aggregate-v1], [client, @nostrwatch/rstate]
 */

import type { UnsignedEvent } from 'nostr-tools/pure'
import { buildBaseEvent } from '@nostrwatch/publisher'
import type { Kind30385Data } from '../types.js'
import { TRUSTED_RELAY_ASSERTION_KIND } from '../../core/trust/trusted-relay-assertions.js'

const CLIENT_TAG = '@nostrwatch/rstate'

export function buildKind30385Event(data: Kind30385Data, pubkey: string = ''): UnsignedEvent {
  const { assertion } = data
  const tags: string[][] = [
    ['d', assertion.relayUrl],
    ['status', assertion.status],
    ['algorithm', assertion.algorithm],
    ['reliability', String(assertion.reliability)],
    ['quality', String(assertion.quality)],
    ['accessibility', String(assertion.accessibility)],
    ['confidence', assertion.confidence.level],
    ['confidence_score', String(assertion.confidence.score)],
    ['observations', String(assertion.observations)],
    ['observation_period', formatPeriod(assertion.observationPeriodSeconds)],
  ]

  if (assertion.score !== undefined) tags.push(['score', String(assertion.score)])
  if (assertion.firstSeen !== undefined) tags.push(['first_seen', String(assertion.firstSeen)])
  if (assertion.lastSeen !== undefined) tags.push(['last_seen', String(assertion.lastSeen)])
  if (assertion.network) tags.push(['network', assertion.network])
  if (assertion.countryCode) tags.push(['country_code', assertion.countryCode])
  if (assertion.software?.family) tags.push(['software', assertion.software.family])
  if (assertion.software?.version) tags.push(['software_version', assertion.software.version])

  for (const [requirement, value] of Object.entries(assertion.requirements ?? {})) {
    tags.push(['requirement', requirement, String(value)])
  }

  return buildBaseEvent({
    kind: TRUSTED_RELAY_ASSERTION_KIND,
    pubkey,
    tags,
    content: '',
    clientTag: CLIENT_TAG,
  })
}

function formatPeriod(seconds: number): string {
  if (seconds > 0 && seconds % (24 * 3600) === 0) return `${seconds / (24 * 3600)}d`
  if (seconds > 0 && seconds % 3600 === 0) return `${seconds / 3600}h`
  if (seconds > 0 && seconds % 60 === 0) return `${seconds / 60}m`
  return `${Math.max(0, Math.round(seconds))}s`
}
