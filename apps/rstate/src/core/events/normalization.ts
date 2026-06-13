/**
 * Event Normalization Service
 *
 * Parses NIP-66 events (10166, 30166) into structured observations
 */

import type {
  NostrEvent,
  MonitorAnnouncement,
  RelayObservation,
  TrustedRelayAssertion,
  ParsedTags,
} from '../types/events.js'
import { normalizeRelayUrl } from '../../utils/url.js'
import { getLogger } from '../../utils/logger.js'

const logger = getLogger().child({ module: 'normalization' })
export const TRUSTED_RELAY_ASSERTION_KIND = 30385

/**
 * Parse monitor announcement (kind 10166)
 */
export function parseMonitorAnnouncement(event: NostrEvent): MonitorAnnouncement | null {
  try {
    const frequency = findTagValue(event.tags, 'frequency')
    if (!frequency) {
      logger.warn({ eventId: event.id }, 'Monitor announcement missing frequency tag')
      return null
    }

    const monitor: MonitorAnnouncement = {
      pubkey: event.pubkey,
      frequency: parseInt(frequency, 10),
      timeout: {},
      checks: [],
      lastSeen: event.created_at,
      eventId: event.id,
    }

    // Parse timeout tags: ["timeout", "open", "5000"]
    for (const tag of event.tags) {
      if (tag[0] === 'timeout' && tag.length >= 3) {
        const type = tag[1] as 'open' | 'read' | 'write' | 'info'
        const value = parseFloat(tag[2])
        if (!isNaN(value)) {
          monitor.timeout[type] = value
        }
      }
    }

    // Parse check types using 'c' tag
    const checks = findAllTagValues(event.tags, 'c')
    monitor.checks = checks

    // Parse geo if available
    const geoTag = findTag(event.tags, 'g')
    if (geoTag && geoTag.length >= 2) {
      // geohash in geoTag[1]
      // We'll decode this in the geo service
      // For now, just note it exists
    }

    return monitor
  } catch (err) {
    logger.error({ err, eventId: event.id }, 'Failed to parse monitor announcement')
    return null
  }
}

/**
 * Parse relay observation (kind 30166)
 */
export function parseRelayObservation(event: NostrEvent): RelayObservation | null {
  try {
    const parsed = parseTags(event.tags)

    if (!parsed.relayUrl) {
      logger.warn({ eventId: event.id }, 'Relay observation missing d tag (relay URL)')
      return null
    }

    // Normalize relay URL
    const relayUrl = normalizeRelayUrl(parsed.relayUrl)

    const observation: RelayObservation = {
      id: event.id,
      created_at: event.created_at,
      author: event.pubkey,
      relayUrl,
      raw: event,
    }

    // Network
    if (parsed.network) {
      const network = parsed.network.toLowerCase()
      if (['clearnet', 'tor', 'i2p', 'hybrid'].includes(network)) {
        observation.network = network as any
      }
    }

    // Software: prefer raw s tag as family, will merge NIP-11 data below
    if (parsed.software) {
      // s tag is often a URL or identifier, keep it as-is for family
      observation.software = {
        family: parsed.software,
      }
    }

    // RTT
    if (parsed.rtt && Object.keys(parsed.rtt).length > 0) {
      observation.rtt = parsed.rtt
    }

    // NIPs
    if (parsed.nips && parsed.nips.length > 0) {
      observation.nips = parsed.nips
    }

    // Requirements
    if (parsed.requirements && Object.keys(parsed.requirements).length > 0) {
      observation.requirements = parsed.requirements
    }

    // Geohashes
    if (parsed.geohashes && parsed.geohashes.length > 0) {
      observation.geohashes = parsed.geohashes
    }

    // Labels
    if (parsed.labels && parsed.labels.length > 0) {
      observation.labels = parsed.labels
    }

    // NIP-11: check both nip11 tag and event content
    let nip11Source: string | undefined = parsed.nip11

    // If no nip11 tag, try parsing content
    if (!nip11Source && event.content && event.content.trim().length > 0) {
      nip11Source = event.content
    }

    if (nip11Source) {
      try {
        observation.nip11 = JSON.parse(nip11Source)

        // Merge NIP-11 software and version into observation.software if present
        if (observation.nip11) {
          if (!observation.software) {
            observation.software = {}
          }
          if (observation.nip11.software && !observation.software.family) {
            observation.software.family = observation.nip11.software
          }
          if (observation.nip11.version && !observation.software.version) {
            observation.software.version = observation.nip11.version
          }
        }
      } catch (err) {
        logger.warn({ eventId: event.id }, 'Failed to parse NIP-11 JSON')
      }
    }

    return observation
  } catch (err) {
    logger.error({ err, eventId: event.id }, 'Failed to parse relay observation')
    return null
  }
}

/**
 * Parse Trusted Relay Assertion (kind 30385)
 */
export function parseTrustedRelayAssertion(event: NostrEvent): TrustedRelayAssertion | null {
  try {
    if (event.kind !== TRUSTED_RELAY_ASSERTION_KIND) {
      logger.warn({ eventId: event.id, kind: event.kind }, 'Trusted relay assertion has unexpected kind')
      return null
    }

    const tags = Object.fromEntries(
      event.tags
        .filter((tag) => tag.length >= 2)
        .map((tag) => [tag[0], tag[1]])
    )

    let content: Record<string, unknown> | undefined
    if (event.content && event.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(event.content)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          content = parsed as Record<string, unknown>
        }
      } catch {
        logger.debug({ eventId: event.id }, 'Trusted relay assertion content is not JSON')
      }
    }

    const relayUrl = tags.d || stringFrom(content?.relay) || stringFrom(content?.relayUrl)

    if (!relayUrl) {
      logger.warn({ eventId: event.id }, 'Trusted relay assertion missing d tag (relay URL)')
      return null
    }

    const assertion: TrustedRelayAssertion = {
      id: event.id,
      created_at: event.created_at,
      author: event.pubkey,
      relayUrl: normalizeRelayUrl(relayUrl),
      raw: event,
    }

    assertion.status = tags.status ?? stringFrom(content?.status)
    assertion.score = numberFrom(tags.score ?? content?.score)
    assertion.reliability = numberFrom(tags.reliability ?? content?.reliability)
    assertion.quality = numberFrom(tags.quality ?? content?.quality)
    assertion.accessibility = numberFrom(tags.accessibility ?? content?.accessibility)
    assertion.confidence = tags.confidence ?? stringFrom(content?.confidence)

    assertion.observations = numberFrom(tags.observations ?? content?.observations)
    assertion.observationPeriod = tags.observation_period ?? stringFrom(content?.observationPeriod)
    assertion.firstSeen = numberFrom(tags.first_seen ?? content?.firstSeen)

    assertion.algorithm = tags.algorithm ?? stringFrom(content?.algorithm)
    assertion.algorithmUrl = tags.algorithm_url ?? stringFrom(content?.algorithmUrl)

    assertion.operator = tags.operator ?? stringFrom(content?.operator)
    assertion.operatorVerified = tags.operator_verified ?? stringFrom(content?.operatorVerified)
    assertion.operatorConfidence = numberFrom(tags.operator_confidence ?? content?.operatorConfidence)
    assertion.operatorTrust = numberFrom(tags.operator_trust ?? content?.operatorTrust)

    assertion.policy = tags.policy ?? stringFrom(content?.policy)
    assertion.policyConfidence = numberFrom(tags.policy_confidence ?? content?.policyConfidence)

    assertion.countryCode = tags.country_code ?? stringFrom(content?.countryCode)
    assertion.region = tags.region ?? stringFrom(content?.region)
    assertion.isHosting = booleanFrom(tags.is_hosting ?? content?.isHosting)
    assertion.network = tags.network ?? stringFrom(content?.network)

    const labels = parseLabelTags(event.tags)
    if (labels.length > 0) {
      assertion.labels = labels
    }

    return assertion
  } catch (err) {
    logger.error({ err, eventId: event.id }, 'Failed to parse trusted relay assertion')
    return null
  }
}

/**
 * Parse all tags from event
 */
function parseTags(tags: string[][]): ParsedTags {
  const parsed: ParsedTags = {}

  for (const tag of tags) {
    const [name, ...values] = tag

    switch (name) {
      case 'd':
        // Relay URL
        parsed.relayUrl = values[0]
        break

      case 'n':
        // Network
        parsed.network = values[0]
        break

      case 'N':
        // NIP support
        if (values[0]) {
          const nip = parseInt(values[0], 10)
          if (!isNaN(nip)) {
            parsed.nips = parsed.nips || []
            parsed.nips.push(nip)
          }
        }
        break

      case 'R':
        // Requirement (boolean capability)
        // Format: ["R", "auth"] or ["R", "!payment"]
        // Presence = true, '!' prefix = false
        if (values[0]) {
          const value = values[0]
          const isNegated = value.startsWith('!')
          const req = isNegated ? value.slice(1) : value
          parsed.requirements = parsed.requirements || {}
          parsed.requirements[req] = !isNegated
        }
        break

      case 'g':
        // Geohash
        if (values[0]) {
          parsed.geohashes = parsed.geohashes || []
          parsed.geohashes.push(values[0])
        }
        break

      case 's':
        // Software
        parsed.software = values[0]
        break

      case 'rtt-open':
      case 'rtt-read':
      case 'rtt-write':
      case 'rtt-info':
        // RTT measurements
        if (values[0]) {
          const rtt = parseFloat(values[0])
          if (!isNaN(rtt)) {
            parsed.rtt = parsed.rtt || {}
            const key = name.replace('rtt-', '') as 'open' | 'read' | 'write' | 'info'
            parsed.rtt[key] = rtt
          }
        }
        break

      case 'L':
        // Label namespace declaration (not directly used for labels)
        // This just declares that the event contains labels of this namespace
        break

      case 'l':
        // Label value: ["l", value, namespace]
        // The namespace is in values[1], not from previous L tag
        if (values.length >= 2) {
          const value = values[0]
          const namespace = values[1]
          parsed.labels = parsed.labels || []
          parsed.labels.push({ namespace, value })
        }
        break

      case 'nip11':
        // NIP-11 document JSON
        parsed.nip11 = values[0]
        break
    }
  }

  return parsed
}

function parseLabelTags(tags: string[][]): NonNullable<ParsedTags['labels']> {
  const labels: NonNullable<ParsedTags['labels']> = []
  for (const tag of tags) {
    if (tag[0] === 'l' && tag.length >= 3) {
      labels.push({ value: tag[1], namespace: tag[2] })
    }
  }
  return labels
}

function stringFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value
  return undefined
}

function numberFrom(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanFrom(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  const lower = value.toLowerCase()
  if (['true', '1', 'yes'].includes(lower)) return true
  if (['false', '0', 'no'].includes(lower)) return false
  return undefined
}

/**
 * Find a single tag by name
 */
function findTag(tags: string[][], name: string): string[] | undefined {
  return tags.find((tag) => tag[0] === name)
}

/**
 * Find first value of a tag
 */
function findTagValue(tags: string[][], name: string): string | undefined {
  const tag = findTag(tags, name)
  return tag?.[1]
}

/**
 * Find all values of a tag
 */
function findAllTagValues(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name).map((tag) => tag[1]).filter(Boolean)
}

// (no-op helpers end)
