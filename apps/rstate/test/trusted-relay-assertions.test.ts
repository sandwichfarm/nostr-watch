import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { RelayState } from '../src/core/index.js'
import { initStateCore } from '../src/core/index.js'
import { DEFAULT_POLICY } from '../src/types/aggregation.js'
import {
  AggregateSnapshotStore,
  TRUSTED_RELAY_ASSERTION_ALGORITHM,
  TrustedRelayAssertionService,
  type TrustedRelayAssertion,
} from '../src/core/trust/trusted-relay-assertions.js'
import { buildKind30385Event } from '../src/events/builders/kind30385.js'
import { loadConfig, resetConfig } from '../src/config.js'
import { EventPublisherService } from '../src/services/event-publisher.js'
import { createRelaysTrustListTool, createRelaysTrustTool } from '../src/tools/relays.js'
import { seedCore } from './fixtures/seed-data.js'

const now = 1_800_000_000

function aggregate<T>(value: T, support = 1, sampleSize = 3) {
  return {
    value,
    support,
    sampleSize,
    contributingAuthors: ['monitor-a', 'monitor-b', 'monitor-c'].slice(0, sampleSize),
    lastUpdated: now,
  }
}

function relayState(overrides: Partial<RelayState> = {}): RelayState {
  return {
    relayUrl: 'wss://relay.example.com/',
    network: aggregate('clearnet'),
    software: {
      family: aggregate('strfry'),
      version: aggregate('1.0.0'),
    },
    rtt: {
      open: { ...aggregate(120), mad: 10 },
      read: { ...aggregate(80), mad: 8 },
      write: { ...aggregate(90), mad: 9 },
      info: { ...aggregate(70), mad: 7 },
    },
    nips: {
      list: [1, 9, 11, 12, 15, 16, 20, 22, 33, 40],
      support: { 1: 1, 9: 1, 11: 1, 12: 1, 15: 1, 16: 1, 20: 1, 22: 1, 33: 1, 40: 1 },
    },
    requirements: {
      auth: aggregate(false),
      payment: aggregate(false),
      pow: aggregate(false),
    },
    labels: { 'nip32.geo': ['US'] },
    country: aggregate('US'),
    nip11: {
      supported_nips: [1, 9, 11, 12, 15, 16, 20, 22, 33, 40],
      software: 'git+https://github.com/hoytech/strfry.git',
      version: '1.0.0',
    },
    updated_at: now,
    contributingAuthors: ['monitor-a', 'monitor-b', 'monitor-c'],
    observationCount: 12,
    lastSeenAt: now,
    lastOpenAt: now,
    ...overrides,
  } as RelayState
}

function assertion(overrides: Partial<TrustedRelayAssertion> = {}): TrustedRelayAssertion {
  const base = new TrustedRelayAssertionService({ minObservations: 1 }).trust(relayState(), now)
  return { ...base, ...overrides }
}

afterEach(() => {
  vi.restoreAllMocks()
  resetConfig()
})

describe('kind 30385 event builder', () => {
  it('builds parameterized trusted relay assertion tags', () => {
    const event = buildKind30385Event({ assertion: assertion() }, 'pubkey')
    const tag = (name: string) => event.tags.find((t) => t[0] === name)

    expect(event.kind).toBe(30385)
    expect(event.pubkey).toBe('pubkey')
    expect(tag('d')).toEqual(['d', 'wss://relay.example.com'])
    expect(tag('algorithm')).toEqual(['algorithm', TRUSTED_RELAY_ASSERTION_ALGORITHM])
    expect(tag('client')).toEqual(['client', '@nostrwatch/rstate'])
    expect(tag('status')).toEqual(['status', 'evaluated'])
    expect(tag('score')?.[1]).toMatch(/^\d+$/)
    expect(event.content).toBe('')
  })
})

describe('trusted relay assertion scoring and history', () => {
  it('scores deterministically from RelayState and explains components', () => {
    const service = new TrustedRelayAssertionService({ minObservations: 1, historyEnabled: false })
    const first = service.trust(relayState(), now)
    const second = service.trust(relayState(), now)

    expect(second).toEqual(first)
    expect(first.status).toBe('evaluated')
    expect(first.algorithm).toBe(TRUSTED_RELAY_ASSERTION_ALGORITHM)
    expect(first.score).toBeGreaterThan(0)
    expect(first.explanation.reliability.reachable).toBe(true)
    expect(first.explanation.confidence.observationScore).toBeGreaterThan(0)
  })

  it('marks insufficient and unreachable states without ingesting 1066 data', () => {
    const service = new TrustedRelayAssertionService({ minObservations: 3 })

    expect(service.trust(relayState({ observationCount: 1 }), now).status).toBe('insufficient_data')
    expect(service.trust(relayState({ rtt: {}, lastSeenAt: now, lastOpenAt: now - 600 }), now).status).toBe('unreachable')
  })

  it('retains aggregate history only when enabled and evicts by retention', () => {
    const store = new AggregateSnapshotStore({ historyEnabled: false, historyRetention: 10 })
    store.recordCycle([relayState()], now)
    expect(store.count()).toBe(0)

    store.configure({ historyEnabled: true, historyRetention: 10 })
    store.recordCycle([relayState()], now)
    store.recordCycle([relayState({ rtt: {}, lastOpenAt: now - 1 })], now + 20)

    expect(store.count()).toBe(1)
    expect(store.summarize('wss://relay.example.com').samples).toBe(1)
  })

  it('StateCore records no TRA history when publishing support is disabled', () => {
    const core = initStateCore({ aggregation: DEFAULT_POLICY, trust: { historyEnabled: false, minObservations: 1 } })
    seedCore(core)

    expect(core.query.trustHistoryCount()).toBe(0)
    expect(core.query.trust('wss://relay1.example.com')?.explanation.history.samples).toBe(0)
  })

  it('StateCore records aggregate history when TRA publishing support is enabled', () => {
    const core = initStateCore({
      aggregation: DEFAULT_POLICY,
      trust: { historyEnabled: true, historyRetention: 3600, minObservations: 1 },
    })
    seedCore(core)

    expect(core.query.trustHistoryCount()).toBeGreaterThan(0)
    expect(core.query.trustList({ status: 'evaluated' }).length).toBeGreaterThan(0)
  })
})

describe('kind 30385 config', () => {
  it('loads YAML config values and defaults kind30385 disabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rstate-config-'))
    const configPath = join(dir, 'config.yaml')
    writeFileSync(configPath, `
cvm:
  enabled: false
rest:
  enabled: true
ingestRelays:
  - ws://localhost:7777
publishing:
  enabled: true
  relays:
    - ws://localhost:6969
  signingKey: '${'1'.repeat(64)}'
`)

    const config = loadConfig(configPath)
    expect(config.publishing?.kind30385.enabled).toBe(false)
    expect(config.publishing?.kind30385.minObservations).toBe(3)
    expect(config.publishing?.kind30385.materialChangeThreshold).toBe(0.05)
    expect(config.publishing?.kind30385.historyRetention).toBe(86400)
    expect(config.publishing?.kind30385.publishUnreachable).toBe(false)
  })

  it('loads explicit kind30385 publishing controls', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rstate-config-'))
    const configPath = join(dir, 'config.yaml')
    writeFileSync(configPath, `
cvm:
  enabled: false
rest:
  enabled: true
ingestRelays:
  - ws://localhost:7777
publishing:
  enabled: true
  relays:
    - ws://localhost:6969
  signingKey: '${'2'.repeat(64)}'
  kind30385:
    enabled: true
    schedule: every15m
    minObservations: 7
    materialChangeThreshold: 0.12
    historyRetention: 7200
    publishUnreachable: true
`)

    const config = loadConfig(configPath)
    expect(config.publishing?.kind30385).toMatchObject({
      enabled: true,
      schedule: 'every15m',
      minObservations: 7,
      materialChangeThreshold: 0.12,
      historyRetention: 7200,
      publishUnreachable: true,
    })
  })
})

describe('kind 30385 publisher integration', () => {
  function publisherWith(assertions: TrustedRelayAssertion[]) {
    const publish = vi.fn().mockResolvedValue(undefined)
    const sign = vi.fn((event) => ({ ...event, id: `id-${publish.mock.calls.length}`, sig: 'sig', pubkey: 'pubkey' }))
    const core = {
      query: {
        relays: {
          getAll: () => [],
          online: () => [],
        },
        trustList: vi.fn(() => assertions),
      },
    }
    const publisher = new EventPublisherService(core as any, {
      publishRelays: ['ws://localhost:6969'],
      signingKey: '1'.repeat(64),
      kind1066: { enabled: false, schedule: 'hourly' },
      kind20066: { enabled: false },
      kind1166: { enabled: false, schedule: 'hourly' },
      kind30385: {
        enabled: true,
        schedule: 'hourly',
        minObservations: 1,
        materialChangeThreshold: 0.05,
        historyRetention: 86400,
        publishUnreachable: false,
      },
      announce: { frequency: '3600' },
    })
    ;(publisher as any).publishPool = { publish }
    ;(publisher as any).signer = { pubkey: 'pubkey', sign }
    ;(publisher as any).lastKind30385Refresh = Math.floor(Date.now() / 1000)
    return { publisher, publish, sign, core }
  }

  it('publishes signed assertions and suppresses unchanged non-refresh cycles', async () => {
    const current = assertion({ score: 80, reliability: 80, quality: 80, accessibility: 80 })
    const { publisher, publish, core } = publisherWith([current])

    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][0]).toMatchObject({ kind: 30385, sig: 'sig' })

    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(1)

    current.score = 83
    ;(core.query.trustList as any).mockReturnValue([current])
    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(1)

    current.score = 86
    ;(core.query.trustList as any).mockReturnValue([current])
    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('refreshes unchanged assertions on the configured schedule boundary', async () => {
    const { publisher, publish } = publisherWith([assertion({ score: 80 })])

    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(1)

    ;(publisher as any).lastKind30385Refresh = 0
    await publisher.onAggregationComplete([])
    expect(publish).toHaveBeenCalledTimes(2)
  })
})

describe('trust query API and MCP tools', () => {
  it('exposes trust and trustList query methods with explanatory output', () => {
    const core = initStateCore({ aggregation: DEFAULT_POLICY, trust: { minObservations: 1 } })
    seedCore(core)

    const trust = core.query.trust('wss://relay1.example.com')
    expect(trust?.relayUrl).toBe('wss://relay1.example.com')
    expect(trust?.explanation.quality.nipSupportScore).toBeDefined()
    expect(core.query.trustList({ minConfidence: 0 }).length).toBeGreaterThan(0)
  })

  it('returns trust data through MCP relay trust tools', async () => {
    const core = initStateCore({ aggregation: DEFAULT_POLICY, trust: { minObservations: 1 } })
    seedCore(core)
    const ctx = { core }

    const single = await createRelaysTrustTool(ctx).handler({ relayUrl: 'wss://relay1.example.com' })
    const list = await createRelaysTrustListTool(ctx).handler({ limit: 2, offset: 0 })
    const missing = await createRelaysTrustTool(ctx).handler({ relayUrl: 'wss://missing.example.com' })

    expect(single.trust?.relayUrl).toBe('wss://relay1.example.com')
    expect(missing.trust).toBeNull()
    expect(list.assertions.length).toBeLessThanOrEqual(2)
    expect(list.total).toBeGreaterThanOrEqual(list.assertions.length)
  })
})
