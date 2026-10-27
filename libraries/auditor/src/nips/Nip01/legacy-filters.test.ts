import { describe, expect, it } from 'vitest'
import { Expect } from '#base/Expect.js'
import { SuiteState } from '#base/SuiteState.js'
import type { ISuite } from '#base/Suite.js'
import { FilterRange } from './tests/FilterRange.js'
import { FilterMulti } from './tests/FilterMulti.js'

function owner(): ISuite {
  const state = new SuiteState()
  state.set('samples', { FilterRange: [10, 20, 30, 40], FilterMulti: [10, 10, 20, 30] })
  return { state, socket: {}, registerIngestor() {} } as unknown as ISuite
}

describe('sampled NIP-01 filter checks', () => {
  it('evaluates range membership instead of asserting a truthy callback', () => {
    const test = new FilterRange(owner())
    test.digest()
    test.onMessageEvent(['EVENT', 'range', { created_at: 35 } as any])
    const assertions = new Expect()
    test.test(assertions)
    expect(assertions.failed.map(result => result.message)).toContain('return only events within range')
  })

  it('accepts fewer events than the maximum when every returned event is in range', () => {
    const test = new FilterRange(owner())
    test.digest()
    test.onMessageEvent(['EVENT', 'range', { created_at: 25 } as any])
    const assertions = new Expect()
    test.test(assertions)
    expect(assertions.failed).toEqual([])
  })

  it('uses distinct sampled timestamp filters without assuming overlapping queries produce duplicate events', () => {
    const test = new FilterMulti(owner())
    test.digest()
    expect(test.filters).toEqual([
      { since: 10, until: 10, limit: 1 },
      { since: 30, until: 30, limit: 1 },
    ])
    test.addEvent({ created_at: 10 } as any)
    test.totalEvents = 1
    const assertions = new Expect()
    test.test(assertions)
    expect(assertions.failed).toEqual([])
  })
})
