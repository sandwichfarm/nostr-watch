/**
 * Event Normalization Service
 *
 * Parses NIP-66 events (10166, 30166) into structured observations
 */

import type {
  NostrEvent,
  MonitorAnnouncement,
  RelayObservation,
  ParsedTags,
} from '../types/events.js'
import { normalizeRelayUrl } from '../utils/url.js'
import { getLogger } from '../utils/logger.js'

const logger = getLogger().child({ module: 'normalization' })

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
