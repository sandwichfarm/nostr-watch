import { describe, it, expect } from 'vitest'
import { impactAllowed, IMPACT_ORDER } from './impact'

describe('IMPACT_ORDER', () => {
  it('should have exactly 3 entries', () => {
    expect(IMPACT_ORDER).toHaveLength(3)
  })

  it('should contain read, low-write, write in that order', () => {
    expect(IMPACT_ORDER[0]).toBe('read')
    expect(IMPACT_ORDER[1]).toBe('low-write')
    expect(IMPACT_ORDER[2]).toBe('write')
  })

  it('should be readonly (as const — TypeScript type-level constraint)', () => {
    // `as const` provides TypeScript compile-time readonly guarantee.
    // The runtime array exists; mutation is prevented by the type system.
    // We verify the array reference is stable and has the expected content.
    const copy: string[] = [...IMPACT_ORDER]
    expect(copy).toEqual(['read', 'low-write', 'write'])
  })
})

describe('impactAllowed', () => {
  describe('same-level comparisons (always allowed)', () => {
    it('impactAllowed(read, read) returns true', () => {
      expect(impactAllowed('read', 'read')).toBe(true)
    })

    it('impactAllowed(low-write, low-write) returns true', () => {
      expect(impactAllowed('low-write', 'low-write')).toBe(true)
    })

    it('impactAllowed(write, write) returns true', () => {
      expect(impactAllowed('write', 'write')).toBe(true)
    })
  })

  describe('test fits within budget (allowed)', () => {
    it('impactAllowed(read, low-write) returns true', () => {
      expect(impactAllowed('read', 'low-write')).toBe(true)
    })

    it('impactAllowed(read, write) returns true', () => {
      expect(impactAllowed('read', 'write')).toBe(true)
    })

    it('impactAllowed(low-write, write) returns true', () => {
      expect(impactAllowed('low-write', 'write')).toBe(true)
    })
  })

  describe('test exceeds budget (not allowed)', () => {
    it('impactAllowed(write, low-write) returns false', () => {
      expect(impactAllowed('write', 'low-write')).toBe(false)
    })

    it('impactAllowed(write, read) returns false', () => {
      expect(impactAllowed('write', 'read')).toBe(false)
    })

    it('impactAllowed(low-write, read) returns false', () => {
      expect(impactAllowed('low-write', 'read')).toBe(false)
    })
  })
})
