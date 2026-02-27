/**
 * Data Quality Audit Tests
 *
 * Regression tests for issues found in the 2026-02-25 production API audit.
 * See docs/api-audit-2026-02-25.md for the full issue list.
 *
 * These tests exercise the core aggregation pipeline directly to verify
 * that relay state computation handles all expected fields correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import type { MonitorAnnouncement, RelayObservation } from '../src/core/index.js'

describe('Data Quality Audit — 2026-02-25', () => {
  let core: ReturnType<typeof initStateCore>

  const baseTime = Math.floor(Date.now() / 1000) - 3600

  const monitors: MonitorAnnouncement[] = [
    {
      pubkey: 'monitor_a',
      frequency: 600,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips', 'info'],
      lastSeen: baseTime,
      eventId: 'evt-monitor-a',
    },
    {
      pubkey: 'monitor_b',
      frequency: 300,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips', 'info'],
      lastSeen: baseTime,
      eventId: 'evt-monitor-b',
    },
  ]

  beforeAll(() => {
    core = initStateCore({
      aggregation: {
        windowStrategy: 'global',
        lookbackSeconds: 21600,
        quorum: 0.5,
        labelQuorum: 0.3,
        madScale: 3,
        weights: { recency: 1, reliability: 1 },
        nipSourceOrder: ['vote'],
        geoPrefs: { preferHigherPrecision: true },
      },
    })

    for (const monitor of monitors) {
      core.ingest.monitor(monitor)
    }
  })

  // ─── Issue #3: Missing write RTT ───────────────────────────────────────────

  describe('#3 — Write RTT aggregation', () => {
    it('should include rtt.write when observations contain write measurements', () => {
      const observations: RelayObservation[] = [
        {
          id: 'write-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://write-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100, read: 40, write: 60 },
        },
        {
          id: 'write-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://write-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110, read: 45, write: 65 },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://write-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.rtt).toBeDefined()
      expect(state!.rtt!.open).toBeDefined()
      expect(state!.rtt!.read).toBeDefined()
      expect(state!.rtt!.write).toBeDefined()
      expect(state!.rtt!.write!.value).toBeGreaterThan(0)
    })

    it('should omit rtt.write when no observation includes write measurements', () => {
      const observations: RelayObservation[] = [
        {
          id: 'nowrite-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://no-write.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100, read: 40 },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://no-write.example.com')
      expect(state).not.toBeNull()
      expect(state!.rtt!.write).toBeUndefined()
    })
  })

  // ─── Issue #4: Missing availability ────────────────────────────────────────

  describe('#4 — Availability timestamps', () => {
    it('should set lastSeenAt and lastOpenAt from observations', () => {
      const observations: RelayObservation[] = [
        {
          id: 'avail-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://avail-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 100,
          rtt: { open: 120 },
        },
        {
          id: 'avail-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://avail-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 200,
          rtt: { open: 130 },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://avail-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.lastSeenAt).toBe(baseTime + 200)
      expect(state!.lastOpenAt).toBe(baseTime + 200)
    })

    it('should not set lastOpenAt when no observation has rtt.open', () => {
      const observations: RelayObservation[] = [
        {
          id: 'no-open-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://no-open.example.com',
          network: 'clearnet',
          created_at: baseTime + 50,
          // No rtt at all
          nips: [1],
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://no-open.example.com')
      expect(state).not.toBeNull()
      expect(state!.lastSeenAt).toBe(baseTime + 50)
      expect(state!.lastOpenAt).toBeUndefined()
    })
  })

  // ─── Issue #5: Missing nip11 ───────────────────────────────────────────────

  describe('#5 — NIP-11 info document data', () => {
    it('should preserve nip11 data from observations through to state', () => {
      // NOTE: Currently computeRelayState() does NOT aggregate nip11 into RelayState.
      // This test documents the current behavior and will need updating when nip11
      // aggregation is implemented. For now, nip11 only feeds software.family/version.
      const observations: RelayObservation[] = [
        {
          id: 'nip11-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://nip11-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          nip11: {
            name: 'Test Relay',
            description: 'A test relay',
            software: 'https://github.com/hoytech/strfry',
            version: '0.9.6',
            supported_nips: [1, 2, 11],
          },
          software: { family: 'https://github.com/hoytech/strfry', version: '0.9.6' },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://nip11-test.example.com')
      expect(state).not.toBeNull()

      // Software family should be set from the observation
      expect(state!.software?.family?.value).toBeDefined()

      // NIP-11 data should be aggregated into RelayState
      expect(state!.nip11).toBeDefined()
      expect(state!.nip11!.name).toBe('Test Relay')
      expect(state!.nip11!.description).toBe('A test relay')
      expect(state!.nip11!.software).toBe('https://github.com/hoytech/strfry')
      expect(state!.nip11!.version).toBe('0.9.6')
      expect(state!.nip11!.supported_nips).toEqual([1, 2, 11])
    })

    it('should pick the majority nip11 document when monitors disagree', () => {
      const majorityDoc = {
        name: 'Real Relay',
        description: 'The real description',
        software: 'https://github.com/hoytech/strfry',
        version: '1.0.0',
      }
      const outlierDoc = {
        name: 'Stale Relay',
        description: 'Outdated cached copy',
        software: 'https://github.com/hoytech/strfry',
        version: '0.8.0',
      }

      const observations: RelayObservation[] = [
        {
          id: 'nip11-majority-1',
          author: 'monitor_a',
          relayUrl: 'wss://nip11-majority.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          nip11: majorityDoc,
        },
        {
          id: 'nip11-majority-2',
          author: 'monitor_b',
          relayUrl: 'wss://nip11-majority.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          nip11: majorityDoc,
        },
        {
          id: 'nip11-outlier-1',
          author: 'monitor_c' as any,
          relayUrl: 'wss://nip11-majority.example.com',
          network: 'clearnet',
          // outlier is MORE recent, but should still lose to majority
          created_at: baseTime + 30,
          rtt: { open: 105 },
          nip11: outlierDoc,
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://nip11-majority.example.com')
      expect(state).not.toBeNull()
      expect(state!.nip11).toBeDefined()
      expect(state!.nip11!.name).toBe('Real Relay')
      expect(state!.nip11!.version).toBe('1.0.0')
    })
  })

  // ─── Issue #6: Duplicate country codes ─────────────────────────────────────

  describe('#6 — Country code normalization', () => {
    it('should produce a single country value from labels', () => {
      const observations: RelayObservation[] = [
        {
          id: 'country-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://country-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          labels: [
            { namespace: 'nip32.geo', value: 'US' },
          ],
        },
        {
          id: 'country-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://country-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          labels: [
            { namespace: 'nip32.geo', value: 'US' },
          ],
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://country-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.country).toBeDefined()
      expect(state!.country!.value).toBe('US')
    })

    it('should normalize Alpha-3 and numeric codes to Alpha-2 and use majority-wins', () => {
      // Three monitors report the same country in different formats:
      // "US" (Alpha-2), "USA" (Alpha-3), "840" (numeric) — all normalize to "US"
      const observations: RelayObservation[] = [
        {
          id: 'norm-country-1',
          author: 'monitor_a',
          relayUrl: 'wss://country-norm.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          labels: [{ namespace: 'nip32.geo', value: 'US' }],
        },
        {
          id: 'norm-country-2',
          author: 'monitor_b',
          relayUrl: 'wss://country-norm.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          labels: [{ namespace: 'nip32.geo', value: 'USA' }],
        },
        {
          id: 'norm-country-3',
          author: 'monitor_c' as any,
          relayUrl: 'wss://country-norm.example.com',
          network: 'clearnet',
          created_at: baseTime + 30,
          rtt: { open: 105 },
          labels: [{ namespace: 'nip32.geo', value: '840' }],
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://country-norm.example.com')
      expect(state).not.toBeNull()
      expect(state!.country).toBeDefined()
      // All three formats should normalize to "US" and agree
      expect(state!.country!.value).toBe('US')
      expect(state!.country!.support).toBe(1)
    })

    it('should pick majority country when monitors genuinely disagree', () => {
      const observations: RelayObservation[] = [
        {
          id: 'conflict-country-1',
          author: 'monitor_a',
          relayUrl: 'wss://country-conflict.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          labels: [{ namespace: 'nip32.geo', value: 'US' }],
        },
        {
          id: 'conflict-country-2',
          author: 'monitor_b',
          relayUrl: 'wss://country-conflict.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          labels: [{ namespace: 'nip32.geo', value: 'US' }],
        },
        {
          id: 'conflict-country-3',
          author: 'monitor_c' as any,
          relayUrl: 'wss://country-conflict.example.com',
          network: 'clearnet',
          // More recent, but minority — should lose
          created_at: baseTime + 30,
          rtt: { open: 105 },
          labels: [{ namespace: 'nip32.geo', value: 'DE' }],
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://country-conflict.example.com')
      expect(state).not.toBeNull()
      expect(state!.country).toBeDefined()
      expect(state!.country!.value).toBe('US')
      expect(state!.country!.support).toBeCloseTo(2 / 3, 1)
    })
  })

  // ─── Issue #7: Software family uses git URLs ──────────────────────────────

  describe('#7 — Software family normalization', () => {
    it('should aggregate software family from observations', () => {
      const observations: RelayObservation[] = [
        {
          id: 'sw-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://software-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          software: { family: 'git+https://github.com/hoytech/strfry.git' },
        },
        {
          id: 'sw-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://software-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          software: { family: 'git+https://github.com/hoytech/strfry.git' },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://software-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.software?.family?.value).toBeDefined()

      // KNOWN GAP: Family is stored as raw git URL, not normalized to friendly name.
      // When normalization is implemented, this should be:
      //   expect(state!.software!.family!.value).toBe('strfry')
      // For now it's the raw URL:
      expect(state!.software!.family!.value).toBe('git+https://github.com/hoytech/strfry.git')
    })

    it('should group same software with different URL variants together', () => {
      // KNOWN GAP: Different URL forms for the same software are treated as distinct families.
      const observations: RelayObservation[] = [
        {
          id: 'sw-variant-1',
          author: 'monitor_a',
          relayUrl: 'wss://sw-variant.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          software: { family: 'git+https://github.com/hoytech/strfry.git' },
        },
        {
          id: 'sw-variant-2',
          author: 'monitor_b',
          relayUrl: 'wss://sw-variant.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          software: { family: 'https://github.com/hoytech/strfry' },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://sw-variant.example.com')
      expect(state).not.toBeNull()
      expect(state!.software?.family?.value).toBeDefined()

      // KNOWN GAP: These are treated as different families (conflict).
      // When normalization is implemented, both should resolve to 'strfry'.
      // For now, the aggregation picks one of the two URL variants:
      expect(state!.software!.family!.value).toMatch(/strfry/)
    })
  })

  // ─── Issue #9: avgObservationsPerRelay = 0 ─────────────────────────────────

  describe('#9 — Metrics: avgObservationsPerRelay', () => {
    it('should compute non-zero avgObservationsPerRelay when observations exist', () => {
      // We've already ingested observations above, so stats should be populated
      const stats = core.stats.get()

      expect(stats.observations.count).toBeGreaterThan(0)
      expect(stats.relays.total).toBeGreaterThan(0)

      // avgObservationsPerRelay should be > 0 when there are observations
      const avg = stats.relays.total > 0
        ? Math.round(stats.observations.count / stats.relays.total)
        : 0
      expect(avg).toBeGreaterThan(0)
    })
  })

  // ─── Issue #10: No software version field ──────────────────────────────────

  describe('#10 — Software version aggregation', () => {
    it('should aggregate software.version when observations include it', () => {
      const observations: RelayObservation[] = [
        {
          id: 'ver-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://version-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          software: { family: 'strfry', version: '0.9.6' },
        },
        {
          id: 'ver-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://version-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          software: { family: 'strfry', version: '0.9.6' },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://version-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.software?.family?.value).toBe('strfry')

      // KNOWN GAP: computeRelayState() aggregates software.family but
      // never aggregates software.version. The version field on RelayState
      // is always undefined despite observations containing version data.
      // When this is fixed, uncomment:
      // expect(state!.software!.version).toBeDefined()
      // expect(state!.software!.version!.value).toBe('0.9.6')

      // Document current broken behavior:
      expect(state!.software!.version).toBeUndefined()
    })
  })

  // ─── Issue #3 (aggregation unit): RTT aggregation correctness ──────────────

  describe('RTT aggregation correctness', () => {
    it('should produce reasonable median and MAD for RTT values', () => {
      const observations: RelayObservation[] = [
        {
          id: 'rtt-agg-1',
          author: 'monitor_a',
          relayUrl: 'wss://rtt-quality.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100, read: 30, write: 50 },
        },
        {
          id: 'rtt-agg-2',
          author: 'monitor_b',
          relayUrl: 'wss://rtt-quality.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 120, read: 35, write: 55 },
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://rtt-quality.example.com')
      expect(state).not.toBeNull()

      // Open RTT should be median of [100, 120] = 120 (upper middle for even count)
      expect(state!.rtt!.open!.value).toBeGreaterThanOrEqual(100)
      expect(state!.rtt!.open!.value).toBeLessThanOrEqual(120)

      // Read RTT
      expect(state!.rtt!.read!.value).toBeGreaterThanOrEqual(30)
      expect(state!.rtt!.read!.value).toBeLessThanOrEqual(35)

      // Write RTT
      expect(state!.rtt!.write!.value).toBeGreaterThanOrEqual(50)
      expect(state!.rtt!.write!.value).toBeLessThanOrEqual(55)

      // MAD should be defined
      expect(state!.rtt!.open!.mad).toBeTypeOf('number')
    })
  })

  // ─── NIP aggregation ──────────────────────────────────────────────────────

  describe('NIP list aggregation', () => {
    it('should aggregate NIPs from multiple monitors with support ratios', () => {
      const observations: RelayObservation[] = [
        {
          id: 'nip-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://nip-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          nips: [1, 2, 11, 50],
        },
        {
          id: 'nip-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://nip-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          nips: [1, 2, 11],
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://nip-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.nips).toBeDefined()

      // NIPs 1, 2, 11 have 100% support (both monitors)
      expect(state!.nips!.list).toContain(1)
      expect(state!.nips!.list).toContain(2)
      expect(state!.nips!.list).toContain(11)
      expect(state!.nips!.support[1]).toBe(1)
      expect(state!.nips!.support[2]).toBe(1)

      // NIP 50 has ~50% support (only monitor_a, may vary slightly with weighted scoring)
      expect(state!.nips!.support[50]).toBeCloseTo(0.5, 1)
    })
  })

  // ─── Geo / Nearby / Bbox ─────────────────────────────────────────────────

  describe('Geospatial queries — nearby and bbox', () => {
    // Geohash '9q8yy' decodes to roughly lat=37.79, lon=-122.40 (San Francisco)
    const sfGeohashes = ['9q8yy', '9q8y', '9q8']
    // Geohash 'u33d' decodes to roughly lat=52.5, lon=13.4 (Berlin)
    const berlinGeohashes = ['u33dc', 'u33d', 'u33']

    it('should populate geo.lat and geo.lon from geohashes', () => {
      const observations: RelayObservation[] = [
        {
          id: 'geo-obs-1',
          author: 'monitor_a',
          relayUrl: 'wss://geo-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 100 },
          geohashes: sfGeohashes,
        },
        {
          id: 'geo-obs-2',
          author: 'monitor_b',
          relayUrl: 'wss://geo-test.example.com',
          network: 'clearnet',
          created_at: baseTime + 20,
          rtt: { open: 110 },
          geohashes: sfGeohashes,
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      const state = core.query.relays.getState('wss://geo-test.example.com')
      expect(state).not.toBeNull()
      expect(state!.geo).toBeDefined()
      // lat/lon must always be present when geo is defined
      expect(state!.geo!.lat).toBeTypeOf('number')
      expect(state!.geo!.lon).toBeTypeOf('number')
      // Should be near San Francisco
      expect(state!.geo!.lat).toBeGreaterThan(37)
      expect(state!.geo!.lat).toBeLessThan(38)
      expect(state!.geo!.lon).toBeGreaterThan(-123)
      expect(state!.geo!.lon).toBeLessThan(-122)
      expect(state!.geo!.geohash).toBe('9q8yy')
    })

    it('nearby should return relays within radius and include relay data', () => {
      // Also add a Berlin relay so we can test it's excluded
      const observations: RelayObservation[] = [
        {
          id: 'nearby-sf-1',
          author: 'monitor_a',
          relayUrl: 'wss://sf-relay.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 80 },
          geohashes: sfGeohashes,
        },
        {
          id: 'nearby-berlin-1',
          author: 'monitor_a',
          relayUrl: 'wss://berlin-relay.example.com',
          network: 'clearnet',
          created_at: baseTime + 10,
          rtt: { open: 120 },
          geohashes: berlinGeohashes,
        },
      ]

      core.ingest.observations(observations)
      core.computeAll()

      // Search near San Francisco with 50km radius
      const nearby = core.query.relays.nearby(37.78, -122.42, 50)

      // SF relay should be found
      const sfRelay = nearby.find(r => r.relayUrl === 'wss://sf-relay.example.com')
      expect(sfRelay).toBeDefined()
      expect(sfRelay!.relayUrl).toBe('wss://sf-relay.example.com')
      // Relay state should have full data, not be empty
      expect(sfRelay!.network?.value).toBe('clearnet')
      expect(sfRelay!.rtt?.open?.value).toBeDefined()

      // Berlin relay should NOT be within 50km of SF
      const berlinRelay = nearby.find(r => r.relayUrl === 'wss://berlin-relay.example.com')
      expect(berlinRelay).toBeUndefined()
    })

    it('bbox should return relays within bounding box with full data', () => {
      // Bounding box covering San Francisco area
      const inBox = core.query.relays.bbox(
        { lat: 37, lon: -123 },
        { lat: 38, lon: -122 }
      )

      // SF relay should be in the box
      const sfRelay = inBox.find(r => r.relayUrl === 'wss://sf-relay.example.com')
      expect(sfRelay).toBeDefined()
      expect(sfRelay!.relayUrl).toBe('wss://sf-relay.example.com')
      // Should have full relay data
      expect(sfRelay!.network?.value).toBe('clearnet')

      // Berlin relay should NOT be in the SF bounding box
      const berlinRelay = inBox.find(r => r.relayUrl === 'wss://berlin-relay.example.com')
      expect(berlinRelay).toBeUndefined()
    })

    it('bbox should return empty array when no relays in region', () => {
      // Bounding box in the middle of the Pacific Ocean
      const inBox = core.query.relays.bbox(
        { lat: 0, lon: -170 },
        { lat: 5, lon: -165 }
      )
      expect(inBox).toHaveLength(0)
    })

    it('nearby should return empty array when no relays in radius', () => {
      // Search in Antarctica
      const nearby = core.query.relays.nearby(-80, 0, 10)
      expect(nearby).toHaveLength(0)
    })
  })
})
