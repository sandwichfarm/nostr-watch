import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/core/types/aggregation.js'
import type { NostrEvent, RelayObservation } from '../src/core/types/events.js'
import { parseTrustedRelayAssertion } from '../src/core/events/normalization.js'
import { resetConfig, getConfig } from '../src/config.js'
import { toCompact } from '../src/types/response-formats.js'

const providerPubkey = 'ad3cdbe9fb09b8edf7b3e0e5286d66e58b58eaa64d061bbcf3a935edf8abf421'

function traEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'tra-event-1',
    pubkey: providerPubkey,
    kind: 30385,
    created_at: 1_704_067_200,
    tags: [
      ['d', 'wss://Relay.Example.com/'],
      ['status', 'evaluated'],
      ['algorithm', 'v0.1'],
      ['algorithm_url', 'https://trustedrelays.xyz/ALGORITHM.md'],
      ['score', '82'],
      ['reliability', '94'],
      ['quality', '76'],
      ['accessibility', '81'],
      ['confidence', 'high'],
      ['observations', '12450'],
      ['observation_period', '30d'],
      ['first_seen', '1640000000'],
      ['operator', providerPubkey],
      ['operator_verified', 'nip11'],
      ['operator_confidence', '70'],
      ['operator_trust', '88'],
      ['policy', 'moderated'],
      ['policy_confidence', '85'],
      ['country_code', 'DE'],
      ['region', 'Bavaria'],
      ['is_hosting', 'true'],
    ],
    content: '',
    sig: 'sig',
    ...overrides,
  }
}

describe('Trusted Relay Assertions', () => {
  describe('normalization', () => {
    it('parses kind 30385 assertion tags into structured data', () => {
      const assertion = parseTrustedRelayAssertion(traEvent())

      expect(assertion).not.toBeNull()
      expect(assertion!.relayUrl).toBe('wss://relay.example.com')
      expect(assertion!.author).toBe(providerPubkey)
      expect(assertion!.status).toBe('evaluated')
      expect(assertion!.score).toBe(82)
      expect(assertion!.reliability).toBe(94)
      expect(assertion!.quality).toBe(76)
      expect(assertion!.accessibility).toBe(81)
      expect(assertion!.confidence).toBe('high')
      expect(assertion!.observations).toBe(12450)
      expect(assertion!.policy).toBe('moderated')
      expect(assertion!.countryCode).toBe('DE')
      expect(assertion!.isHosting).toBe(true)
    })
  })

  describe('core aggregation and response shaping', () => {
    it('aggregates TRA data alongside NIP-66 relay state', () => {
      const core = initStateCore({ aggregation: DEFAULT_POLICY })
      const observation: RelayObservation = {
        id: 'obs-1',
        author: 'monitor-a',
        relayUrl: 'wss://relay.example.com',
        created_at: 1_704_067_100,
        network: 'clearnet',
        rtt: { open: 100 },
      }
      const assertion = parseTrustedRelayAssertion(traEvent())!

      core.ingest.observations([observation])
      core.ingest.trustedRelayAssertions([assertion])
      core.computeAll()

      const state = core.query.relays.getState('wss://relay.example.com')
      expect(state).not.toBeNull()
      expect(state!.trustedRelay?.status?.value).toBe('evaluated')
      expect(state!.trustedRelay?.score?.value).toBe(82)
      expect(state!.trustedRelay?.reliability?.value).toBe(94)
      expect(state!.trustedRelay?.assertionCount).toBe(1)
      expect(state!.trustedRelay?.publisherCount).toBe(1)
      expect(state!.trustedRelay?.contributingAuthors).toEqual([providerPubkey])

      const compact = toCompact(state!)
      expect(compact.trustedRelay?.score?.value).toBe(82)
      expect((compact.trustedRelay as any).contributingAuthors).toBeUndefined()
      expect((compact.trustedRelay?.score as any).contributingAuthors).toBeUndefined()
    })

    it('exposes a null-valued note when no TRA data exists for a relay', () => {
      const core = initStateCore({ aggregation: DEFAULT_POLICY })
      core.ingest.observations([
        {
          id: 'obs-no-tra',
          author: 'monitor-a',
          relayUrl: 'wss://no-tra.example.com',
          created_at: 1_704_067_100,
          network: 'clearnet',
        },
      ])
      core.computeAll()

      const state = core.query.relays.getState('wss://no-tra.example.com')
      expect(state).not.toBeNull()
      expect(state!.trustedRelay).toEqual({
        status: null,
        score: null,
        reliability: null,
        quality: null,
        accessibility: null,
        assertionCount: 0,
        publisherCount: 0,
        contributingAuthors: [],
        note: 'no_trusted_relay_assertions',
      })
    })
  })
})

describe('Trusted Relay Assertion configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetConfig()
    process.env = { ...originalEnv }
    process.env.CVM_ENABLED = 'false'
    process.env.REST_ENABLED = 'true'
    process.env.INGEST_RELAYS = 'ws://localhost:6969'
    process.env.TRA_ENABLED = 'true'
    process.env.TRA_RELAYS = 'wss://nos.lol,wss://relay.damus.io,wss://relay.primal.net'
    process.env.TRA_PUBKEYS = providerPubkey
    process.env.STATE_DB_PATH = './tmp/state.json'
    process.env.STATE_BACKUP_DIR = './tmp/backups'
    process.env.STATE_BACKUP_RETENTION = '3'
  })

  afterEach(() => {
    process.env = originalEnv
    resetConfig()
  })

  it('loads dedicated TRA relays/pubkeys and state database config from env', () => {
    const config = getConfig()

    expect(config.trustedRelayAssertions).toEqual({
      enabled: true,
      relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'],
      pubkeys: [providerPubkey],
    })
    expect(config.stateDatabase).toEqual({
      enabled: true,
      path: './tmp/state.json',
      backupDir: './tmp/backups',
      backupRetention: 3,
    })
  })
})
