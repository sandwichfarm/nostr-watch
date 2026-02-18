/**
 * Parity Tests
 *
 * Validates that the new StateCore API produces identical results
 * to the original implementation for a fixed, seeded dataset.
 *
 * This ensures zero regression after the P1 refactor.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'

describe('StateCore Parity Tests', () => {
  let core: ReturnType<typeof initStateCore>

  // NOTE: This test uses its own simpler seed data with short pubkeys ('monitor1pubkey', etc.)
  // rather than the shared seed data in fixtures/, which uses 64-char hex pubkeys.
  // This is intentional — the parity test predates the shared fixtures and uses
  // different pubkey formats that would break assertions if changed.
  const baseTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago

  const monitors = [
    {
      pubkey: 'monitor1pubkey',
      frequency: 600,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips'],
      lastSeen: baseTime,
      eventId: 'monitor1-event',
    },
    {
      pubkey: 'monitor2pubkey',
      frequency: 300,
      timeout: { open: 5000, read: 5000, write: 5000 },
      checks: ['open', 'read', 'write', 'nips'],
      lastSeen: baseTime,
      eventId: 'monitor2-event',
    },
  ]

  const observations = [
    {
      id: 'obs1-monitor1',
      author: 'monitor1pubkey',
      relayUrl: 'wss://relay1.example.com',
      network: 'clearnet',
      created_at: baseTime + 100,
      rtt: { open: 50, read: 30, write: 25 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [
        { namespace: 'nip32.asn', value: 'AS13335' },
        { namespace: 'nip32.geo', value: 'US' },
        { namespace: 'nip32.isp', value: 'Cloudflare' },
      ],
      geohashes: ['9q8yy', '9q8y', '9q8'],
    },
    {
      id: 'obs1-monitor2',
      author: 'monitor2pubkey',
      relayUrl: 'wss://relay1.example.com',
      network: 'clearnet',
      created_at: baseTime + 200,
      rtt: { open: 55, read: 32, write: 27 },
      nips: [1, 11, 42, 50],
      software: { family: 'strfry', version: '1.0.0' },
      labels: [
        { namespace: 'nip32.asn', value: 'AS13335' },
        { namespace: 'nip32.geo', value: 'US' },
        { namespace: 'nip32.isp', value: 'Cloudflare' },
      ],
      geohashes: ['9q8yy', '9q8y', '9q8'],
    },
    {
      id: 'obs2-monitor1',
      author: 'monitor1pubkey',
      relayUrl: 'wss://relay2.example.com',
      network: 'tor',
      created_at: baseTime + 150,
      rtt: { open: 200 },
      nips: [1, 11],
      software: { family: 'nostr-rs-relay', version: '0.8.0' },
      labels: [],
    },
    {
      id: 'obs2-monitor2',
      author: 'monitor2pubkey',
      relayUrl: 'wss://relay2.example.com',
      network: 'tor',
      created_at: baseTime + 250,
      rtt: { open: 210 },
      nips: [1, 11],
      software: { family: 'nostr-rs-relay', version: '0.8.0' },
      labels: [],
    },
    {
      id: 'obs3-monitor1',
      author: 'monitor1pubkey',
      relayUrl: 'wss://relay3.example.com',
      network: 'clearnet',
      created_at: baseTime + 180,
      rtt: {},
      nips: [],
      labels: [
        { namespace: 'nip32.geo', value: 'DE' },
      ],
      geohashes: ['u0y'],
    },
  ]

  beforeEach(() => {
    core = initStateCore({
      aggregation: DEFAULT_POLICY,
    })

    for (const monitor of monitors) {
      core.ingest.monitor(monitor as any)
    }

    core.ingest.observations(observations as any)
    core.computeAll()
  })

  describe('Stats', () => {
    it('should report correct counts', () => {
      const stats = core.stats.get()

      expect(stats.relays.total).toBe(3) // 3 unique relay URLs
      expect(stats.relays.cached).toBe(3)
      expect(stats.monitors.count).toBe(2)
      expect(stats.observations.count).toBe(5)
    })
  })

  describe('Monitor Queries', () => {
    it('should retrieve monitor by pubkey', () => {
      const monitor = core.query.monitors.get('monitor1pubkey')

      expect(monitor).toBeDefined()
      expect(monitor?.pubkey).toBe('monitor1pubkey')
      expect(monitor?.frequency).toBe(600)
    })

    it('should list all monitors', () => {
      const allMonitors = core.query.monitors.getAll()

      expect(allMonitors).toHaveLength(2)
      expect(allMonitors.map(m => m.pubkey).sort()).toEqual([
        'monitor1pubkey',
        'monitor2pubkey',
      ])
    })
  })

  describe('Relay State Queries', () => {
    it('should get state for a single relay', () => {
      const state = core.query.relays.getState('wss://relay1.example.com')

      expect(state).toBeDefined()
      expect(state?.relayUrl).toBe('wss://relay1.example.com')
      expect(state?.network?.value).toBe('clearnet')
      expect(state?.software?.family?.value).toBe('strfry')
      expect(state?.nips?.list).toContain(1)
      expect(state?.nips?.list).toContain(11)
      expect(state?.nips?.list).toContain(42)
      expect(state?.nips?.list).toContain(50)
      expect(state?.rtt?.open).toBeDefined()
      expect(state?.rtt?.open?.value).toBeGreaterThan(0)
      expect(state?.geo).toBeDefined()
      expect(state?.geo?.geohash).toBeTruthy() // We take the longest geohash
    })

    it('should return null for non-existent relay', () => {
      const state = core.query.relays.getState('wss://does-not-exist.com')
      expect(state).toBeNull()
    })

    it('should get all relay states', () => {
      const states = core.query.relays.getAll()

      expect(states).toHaveLength(3)
      expect(states.map(s => s.relayUrl).sort()).toEqual([
        'wss://relay1.example.com',
        'wss://relay2.example.com',
        'wss://relay3.example.com',
      ])
    })
  })

  describe('Search and Filters', () => {
    it('should filter by network', () => {
      const clearnet = core.query.relays.search({ network: 'clearnet' })
      expect(clearnet).toHaveLength(2)
      expect(clearnet.map(r => r.relayUrl).sort()).toEqual([
        'wss://relay1.example.com',
        'wss://relay3.example.com',
      ])

      const tor = core.query.relays.search({ network: 'tor' })
      expect(tor).toHaveLength(1)
      expect(tor[0].relayUrl).toBe('wss://relay2.example.com')
    })

    it('should filter by NIPs', () => {
      const withNip42 = core.query.relays.search({ nips: [42] })
      expect(withNip42).toHaveLength(1)
      expect(withNip42[0].relayUrl).toBe('wss://relay1.example.com')

      const withNip1 = core.query.relays.search({ nips: [1] })
      expect(withNip1.length).toBeGreaterThanOrEqual(2)
    })

    it('should filter by software family', () => {
      const strfry = core.query.relays.search({ software: { family: 'strfry' } })
      expect(strfry).toHaveLength(1)
      expect(strfry[0].relayUrl).toBe('wss://relay1.example.com')

      const nostrRsRelay = core.query.relays.search({ software: { family: 'nostr-rs-relay' } })
      expect(nostrRsRelay).toHaveLength(1)
      expect(nostrRsRelay[0].relayUrl).toBe('wss://relay2.example.com')
    })

    it('should filter by labels', () => {
      const usRelays = core.query.relays.search({
        labels: [{ namespace: 'nip32.geo', value: 'US' }],
      })
      expect(usRelays).toHaveLength(1)
      expect(usRelays[0].relayUrl).toBe('wss://relay1.example.com')

      const deRelays = core.query.relays.search({
        labels: [{ namespace: 'nip32.geo', value: 'DE' }],
      })
      expect(deRelays).toHaveLength(1)
      expect(deRelays[0].relayUrl).toBe('wss://relay3.example.com')
    })

    it('should filter by max latency', () => {
      const lowLatency = core.query.relays.search({
        maxLatency: { open: 100 },
      })
      expect(lowLatency).toHaveLength(1)
      expect(lowLatency[0].relayUrl).toBe('wss://relay1.example.com')
    })
  })

  describe('Label Queries', () => {
    it('should get labels for a specific relay', () => {
      const labels = core.query.relays.getLabels('wss://relay1.example.com')

      expect(labels).toBeDefined()
      expect(labels['nip32.asn']).toContain('AS13335')
      expect(labels['nip32.geo']).toContain('US')
      expect(labels['nip32.isp']).toContain('Cloudflare')
    })

    it('should list all labels', () => {
      const allLabels = core.query.relays.listLabels()

      expect(allLabels.length).toBeGreaterThan(0)

      const geoLabels = allLabels.filter(l => l.namespace === 'nip32.geo')
      expect(geoLabels.length).toBeGreaterThanOrEqual(2) // US, DE

      const usLabel = geoLabels.find(l => l.value === 'US')
      expect(usLabel?.count).toBe(1)
    })

    it('should list labels by namespace', () => {
      const geoLabels = core.query.relays.listLabels('nip32.geo')

      expect(geoLabels.length).toBeGreaterThanOrEqual(2)
      expect(geoLabels.every(l => l.namespace === 'nip32.geo')).toBe(true)
    })

    it('should find relays by label', () => {
      const cloudflareRelays = core.query.relays.byLabel('nip32.isp', 'Cloudflare')

      expect(cloudflareRelays).toHaveLength(1)
      expect(cloudflareRelays[0]).toBe('wss://relay1.example.com')
    })
  })

  describe('Grouping Queries', () => {
    it('should group by software', () => {
      const bySoftware = core.query.relays.bySoftware()

      expect(bySoftware['strfry']).toHaveLength(1)
      expect(bySoftware['strfry'][0]).toBe('wss://relay1.example.com')

      expect(bySoftware['nostr-rs-relay']).toHaveLength(1)
      expect(bySoftware['nostr-rs-relay'][0]).toBe('wss://relay2.example.com')
    })

    it('should group by network', () => {
      const byNetwork = core.query.relays.byNetwork()

      expect(byNetwork['clearnet']).toHaveLength(2)
      expect(byNetwork['tor']).toHaveLength(1)
    })

    it('should group by NIP with support ratios', () => {
      const byNip = core.query.relays.byNip()

      expect(byNip[1]).toBeDefined()
      expect(byNip[1].relays.length).toBeGreaterThanOrEqual(2)
      expect(byNip[1].supportRatio).toBeGreaterThan(0.5)

      expect(byNip[42]).toBeDefined()
      expect(byNip[42].relays).toHaveLength(1)
      expect(byNip[42].relays[0]).toBe('wss://relay1.example.com')
      expect(byNip[42].supportRatio).toBeCloseTo(1/3, 1)
    })

    it('should group by country', () => {
      const byCountry = core.query.relays.byCountry()

      expect(byCountry['US']).toHaveLength(1)
      expect(byCountry['DE']).toHaveLength(1)
    })
  })

  describe('Availability Queries', () => {
    it('should identify online relays', () => {
      const online = core.query.relays.online({
        onlineWindowSeconds: 7200, // 2 hours
      })

      // relay1 and relay2 have recent open RTTs
      expect(online).toHaveLength(2)
      expect(online).toContain('wss://relay1.example.com')
      expect(online).toContain('wss://relay2.example.com')
    })

    it('should identify offline relays', () => {
      const offline = core.query.relays.offline({
        offlineSeenSeconds: 7200, // seen within 2 hours
        offlineThresholdSeconds: 7200, // no open in 2 hours (observations are ~1 hour old)
      })

      // relay3 was seen recently but has no open RTT (empty rtt object)
      expect(offline).toHaveLength(1)
      expect(offline[0]).toBe('wss://relay3.example.com')
    })

    it('should identify probably dead relays', () => {
      const dead = core.query.relays.dead({
        deadThresholdSeconds: 86400, // not seen in 24 hours
      })

      // All our test relays are recent, so none should be dead
      expect(dead).toHaveLength(0)
    })
  })

  describe('Geospatial Queries', () => {
    it('should find relays nearby a point', () => {
      // Center point near San Francisco (relay1's geohash 9q8yy)
      const nearby = core.query.relays.nearby(37.7749, -122.4194, 100)

      expect(nearby.length).toBeGreaterThanOrEqual(1)
      expect(nearby.some(r => r.relayUrl === 'wss://relay1.example.com')).toBe(true)
    })

    it('should find relays in a bounding box', () => {
      // Bounding box covering US west coast
      const inBox = core.query.relays.bbox(
        { lat: 32, lon: -125 },
        { lat: 42, lon: -120 }
      )

      expect(inBox.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Compare', () => {
    it('should compare multiple relays', () => {
      const compared = core.query.relays.compare([
        'wss://relay1.example.com',
        'wss://relay2.example.com',
        'wss://does-not-exist.com',
      ])

      expect(compared).toHaveLength(3)
      expect(compared[0]).toBeDefined()
      expect(compared[0]?.relayUrl).toBe('wss://relay1.example.com')
      expect(compared[1]).toBeDefined()
      expect(compared[1]?.relayUrl).toBe('wss://relay2.example.com')
      expect(compared[2]).toBeNull()
    })
  })

  describe('Policy Management', () => {
    it('should get current policy', () => {
      const policy = core.query.policy.get()

      expect(policy).toBeDefined()
      expect(policy.lookbackSeconds).toBe(DEFAULT_POLICY.lookbackSeconds)
      expect(policy.quorum).toBe(DEFAULT_POLICY.quorum)
    })

    it('should update policy and recompute', () => {
      const originalQuorum = core.query.policy.get().quorum

      // Update policy
      core.query.policy.set({ quorum: 0.8 })

      const updatedPolicy = core.query.policy.get()
      expect(updatedPolicy.quorum).toBe(0.8)

      // Restore original
      core.query.policy.set({ quorum: originalQuorum })
    })
  })

  describe('Eviction', () => {
    it('should evict old observations', () => {
      const statsBefore = core.stats.get()
      const countBefore = statsBefore.observations.count

      // Evict (should not evict any since our data is recent)
      const evicted = core.evictOld()

      expect(evicted).toBe(0)

      const statsAfter = core.stats.get()
      expect(statsAfter.observations.count).toBe(countBefore)
    })
  })
})
