/**
 * Shared Seed Data for Tests
 *
 * Provides a consistent, reusable dataset for parity, cache, and integration tests.
 * Extracted from parity.test.ts and rest_tool_parity.test.ts to reduce duplication.
 */

import type { MonitorAnnouncement, RelayObservation } from '../../src/core/index.js'

export const baseTime = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago

export const monitors: MonitorAnnouncement[] = [
  {
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    frequency: 600,
    timeout: { open: 5000, read: 5000, write: 5000 },
    checks: ['open', 'read', 'write', 'nips'],
    lastSeen: baseTime,
    eventId: 'monitor1-event',
  },
  {
    pubkey: '0000000000000000000000000000000000000000000000000000000000000002',
    frequency: 300,
    timeout: { open: 5000, read: 5000, write: 5000 },
    checks: ['open', 'read', 'write', 'nips'],
    lastSeen: baseTime,
    eventId: 'monitor2-event',
  },
]

export const observations: RelayObservation[] = [
  // Relay 1: wss://relay1.example.com - clearnet, strfry, multiple monitors
  {
    id: 'obs1-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
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
    author: '0000000000000000000000000000000000000000000000000000000000000002',
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

  // Relay 2: wss://relay2.example.com - tor, nostr-rs-relay
  {
    id: 'obs2-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
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
    author: '0000000000000000000000000000000000000000000000000000000000000002',
    relayUrl: 'wss://relay2.example.com',
    network: 'tor',
    created_at: baseTime + 250,
    rtt: { open: 210 },
    nips: [1, 11],
    software: { family: 'nostr-rs-relay', version: '0.8.0' },
    labels: [],
  },

  // Relay 3: wss://relay3.example.com - offline (no open RTT)
  {
    id: 'obs3-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay3.example.com',
    network: 'clearnet',
    created_at: baseTime + 180,
    rtt: {},
    nips: [],
    labels: [{ namespace: 'nip32.geo', value: 'DE' }],
    geohashes: ['u0y'],
  },

  // Additional observations for monitor scoring (need >= 10 for minObservationsForScore)
  {
    id: 'obs4-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay4.example.com',
    network: 'clearnet',
    created_at: baseTime + 300,
    rtt: { open: 48 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs5-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay5.example.com',
    network: 'clearnet',
    created_at: baseTime + 400,
    rtt: { open: 52 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs6-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay6.example.com',
    network: 'clearnet',
    created_at: baseTime + 500,
    rtt: { open: 45 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs7-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay7.example.com',
    network: 'clearnet',
    created_at: baseTime + 600,
    rtt: { open: 49 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs8-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay8.example.com',
    network: 'clearnet',
    created_at: baseTime + 700,
    rtt: { open: 51 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs9-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay9.example.com',
    network: 'clearnet',
    created_at: baseTime + 800,
    rtt: { open: 47 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
  {
    id: 'obs10-monitor1',
    author: '0000000000000000000000000000000000000000000000000000000000000001',
    relayUrl: 'wss://relay10.example.com',
    network: 'clearnet',
    created_at: baseTime + 900,
    rtt: { open: 53 },
    nips: [1, 11, 42, 50],
    software: { family: 'strfry', version: '1.0.0' },
    labels: [{ namespace: 'nip32.geo', value: 'US' }],
    geohashes: ['9q8yy'],
  },
]

/**
 * Helper to seed a StateCore instance with the shared dataset
 */
export function seedCore(core: { ingest: { monitor: (m: MonitorAnnouncement) => void; observations: (obs: RelayObservation[]) => void }; computeAll: () => void }) {
  for (const m of monitors) core.ingest.monitor(m)
  core.ingest.observations(observations)
  core.computeAll()
}
