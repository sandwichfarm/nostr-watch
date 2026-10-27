import { afterEach, describe, expect, it } from 'vitest'
import { UniversalWebSocket } from '@nostrwatch/websocket'
import { ConversationTest } from '#base/ConversationTest.js'
import { Auditor } from '#base/Auditor.js'
import { Emitter } from '#base/Emitter.js'
import { SuiteState } from '#base/SuiteState.js'
import type { ISuite } from '#base/Suite.js'
import { createRelayFixture, populatedFixtureEvents, type RelayFault, type RelayFixtureOptions } from '#src/testing/relayFixture.js'
import * as checks from './tests/index.js'

const required = [
  'ChildPath', 'FilterIds', 'FilterEmptyLists', 'FilterSemantics', 'FilterInclusiveRange',
  'FilterUnknownKeys', 'FilterLimitOrder', 'LimitLive', 'SubscriptionLifecycle',
  'SubscriptionIsolation', 'EventValidation', 'EventPersistence', 'ReplaceableEvents',
  'AddressableEvents', 'EphemeralEvents',
]
const active: Awaited<ReturnType<typeof createRelayFixture>>[] = []

afterEach(async () => {
  await Promise.all(active.splice(0).map(fixture => fixture.close()))
  Emitter.removeAllListeners('all:abort')
})

async function run(name: string, options: RelayFixtureOptions = {}, timeoutMs = 2500, urlSuffix = '') {
  const fixture = await createRelayFixture(options)
  active.push(fixture)
  const socket = new UniversalWebSocket(fixture.url + urlSuffix, undefined, { autoConnect: false, connectTimeout: 300 })
  const suite = { socket, state: new SuiteState(), reset() {}, testKey: 'unset' } as unknown as ISuite
  const Constructor = checks[name] as new (suite: ISuite) => ConversationTest
  expect(Constructor, `${name} must be registered in the generated test index`).toBeTypeOf('function')
  const test = new Constructor(suite)
  Object.assign(test, { timeoutMs })
  await test.run()
  // Message delivery/close callbacks are asynchronous; the fixture receives the closes next turn.
  await new Promise(resolve => setTimeout(resolve, 5))
  expect([...fixture.connections.values()]).toHaveLength(0)
  return { result: test.resulter.result, fixture, data: test.data }
}

describe('NIP-01 conversations against a deterministic WebSocket relay', () => {
  it('runs registered checks through the public Auditor and retains per-test endpoint evidence', async () => {
    const fixture = await createRelayFixture({ child: 'distinct', events: populatedFixtureEvents() })
    active.push(fixture)
    const auditor = new Auditor({ nips: new Set(['Nip01']), options: {} })
    const output = await auditor.test(fixture.url)
    const suite = output.suites.Nip01
    expect(suite.reason).toBe('')
    expect(suite.pass).toBe(true)
    expect(suite.incomplete).toBe(true) // Prefix probes may be unavailable on an accepting relay.
    expect(Object.keys(suite.tests)).toEqual(expect.arrayContaining(required))
    for (const name of required) {
      expect(suite.tests[name].failed, name).toEqual([])
      expect(suite.tests[name].pass, name).toBe(true)
    }
    for (const [name, result] of Object.entries(suite.tests)) {
      expect(result.failed, name).toEqual([])
    }
    expect(suite.data.ChildPath.observation).toBe('child returned a different event set')
    expect(suite.data.ChildPath.childPath).toMatch(/^\/relay\/auditor-/)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fixture.connections.size).toBe(0)
  }, 45000)

  it.each(required.filter(name => name !== 'ChildPath'))('%s passes conforming behavior with positive evidence', async name => {
    const { result } = await run(name)
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.passed.length).toBeGreaterThan(0)
    expect(result.pass).toBe(true)
  })

  const failures: [string, RelayFault][] = [
    ['FilterIds', 'ignore-ids'],
    ['FilterEmptyLists', 'empty-list'],
    ['FilterSemantics', 'filter-and'],
    ['FilterSemantics', 'multi-filter'],
    ['FilterSemantics', 'index-tail'],
    ['FilterSemantics', 'lowercase-tags'],
    ['FilterInclusiveRange', 'exclusive-bounds'],
    ['FilterUnknownKeys', 'unknown-filter'],
    ['FilterLimitOrder', 'oldest-first'],
    ['FilterLimitOrder', 'reverse-ties'],
    ['LimitLive', 'limit-zero-history'],
    ['LimitLive', 'limit-live'],
    ['SubscriptionLifecycle', 'merge-subscriptions'],
    ['SubscriptionLifecycle', 'ignore-close'],
    ['SubscriptionIsolation', 'global-subscriptions'],
    ['EventValidation', 'accept-invalid'],
    ['EventPersistence', 'duplicate-storage'],
    ['ReplaceableEvents', 'retain-replaced'],
    ['AddressableEvents', 'collapse-addresses'],
    ['EphemeralEvents', 'store-ephemeral'],
    ['FilterIds', 'malformed-ok'],
    ['EventValidation', 'ok-no-prefix'],
    ['FilterIds', 'malformed-event'],
  ]
  it.each(failures)('%s detects %s', async (name, fault) => {
    const { result } = await run(name, { faults: [fault] }, 1600)
    expect(result.skipped).toEqual([])
    expect(result.pass).toBe(false)
    expect(result.failed.length).toBeGreaterThan(0)
  })

  it('unknown-key rejection is reported as unsupported, without a false conformance pass', async () => {
    const { result } = await run('FilterUnknownKeys', { faults: ['reject-unknown-filter'] })
    expect(result.failed).toEqual([])
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.pass).toBe(false)
  })

  it.each(['FilterIds', 'LimitLive', 'SubscriptionIsolation', 'EventPersistence'])('%s records unavailable write prerequisites', async name => {
    const { result } = await run(name, { rejectWrites: true })
    expect(result.pass).toBe(false)
    expect(result.failed).toEqual([])
    expect(result.skipped.length).toBeGreaterThan(0)
  })

  it.each(['missing-eose', 'unrelated-eose'] as RelayFault[])('does not pass a query with %s', async fault => {
    const { result } = await run('FilterIds', { faults: [fault] }, 300)
    expect(result.pass).toBe(false)
    expect(result.failed.length).toBeGreaterThan(0)
  })

  it.each(['alias', 'replica'] as const)('reports a possible child %s using two stable nonempty comparisons', async child => {
    const { result, fixture, data } = await run('ChildPath', { child })
    expect(result.pass).toBe(false)
    expect(result.failed).toEqual([])
    expect(result.skipped[0]?.message).toContain('Possible child-path alias')
    expect(data.possibleAlias).toBe(true)
    expect(fixture.received.some(item => item.path.startsWith('/relay/auditor-'))).toBe(true)
  })

  it.each(['LimitLive', 'SubscriptionLifecycle', 'SubscriptionIsolation'])('%s cannot pass after a later prerequisite is rejected', async name => {
    const { result } = await run(name, { rejectWritesAfter: name === 'LimitLive' ? 1 : 2 })
    expect(result.passed.length).toBeGreaterThan(0)
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.failed).toEqual([])
    expect(result.pass).toBe(false)
  })

  it('permits a child relay whose event responses differ', async () => {
    const { result } = await run('ChildPath', { child: 'distinct' })
    expect(result.pass).toBe(true)
    expect(result.skipped).toEqual([])
  })

  it('preserves a nested relay path and query parameters when deriving its child', async () => {
    const { result, fixture } = await run('ChildPath', { child: 'distinct', path: '/nested/relay/' }, 2500, '?tenant=fixture')
    expect(result.pass).toBe(true)
    expect(fixture.requests).toEqual(expect.arrayContaining([
      '/nested/relay/?tenant=fixture',
      expect.stringMatching(/^\/nested\/relay\/auditor-[^?]+\?tenant=fixture$/),
    ]))
  })

  it('does not identify an alias from changing parent data', async () => {
    const { result } = await run('ChildPath', { child: 'alias', faults: ['changing-parent'] })
    expect(result.pass).toBe(false)
    expect(result.failed).toEqual([])
    expect(result.skipped[0]?.message).toContain('Parent result changed')
  })

  it('accepts machine-readable prefixes without requiring a space after the colon', async () => {
    const { result } = await run('EventValidation', { faults: ['compact-prefix'] })
    expect(result.pass).toBe(true)
    expect(result.failed).toEqual([])
  })

  it('permits a child path that changes the response to an empty set', async () => {
    const { result } = await run('ChildPath', { child: 'empty' })
    expect(result.pass).toBe(true)
    expect(result.skipped).toEqual([])
  })

  it('does not equate empty parent and child results with relay identity', async () => {
    const { result } = await run('ChildPath', { child: 'alias', events: [] })
    expect(result.pass).toBe(false)
    expect(result.failed).toEqual([])
    expect(result.skipped[0]?.message).toContain('Empty parent')
  })

  it('records opaque child connection rejection as inconclusive', async () => {
    const { result } = await run('ChildPath', { child: 'reject' })
    expect(result.failed).toEqual([])
    expect(result.skipped[0]?.message).toContain('transport')
    expect(result.pass).toBe(false)
  })

  it('records silent child queries as inconclusive', async () => {
    const { result } = await run('ChildPath', { child: 'silent' })
    expect(result.failed).toEqual([])
    expect(result.skipped[0]?.message).toContain('did not complete')
    expect(result.pass).toBe(false)
  })
})
