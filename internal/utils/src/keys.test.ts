import { describe, it, expect } from 'vitest'
import { nsecToHex, nsecToBytes, tryNsecToHex } from './keys'

// Test key pair (generated for testing only, not used anywhere)
const TEST_HEX = 'cb52317a3001f67ffc3f2bf5dbc39669633fe606ad69a5ca64c9065dcb7869af'
const TEST_NSEC = 'nsec1edfrz73sq8m8llpl906ahsukd93nlesx4456tjnyeyr9mjmcdxhsnrhvcr'

describe('nsecToHex', () => {
  it('converts nsec to hex', () => {
    expect(nsecToHex(TEST_NSEC)).toBe(TEST_HEX)
  })

  it('passes through valid hex', () => {
    expect(nsecToHex(TEST_HEX)).toBe(TEST_HEX)
  })

  it('trims whitespace', () => {
    expect(nsecToHex(`  ${TEST_HEX}  `)).toBe(TEST_HEX)
  })

  it('throws on invalid input', () => {
    expect(() => nsecToHex('not-a-key')).toThrow('Invalid key format')
  })

  it('throws on short hex', () => {
    expect(() => nsecToHex('abcdef')).toThrow('Invalid key format')
  })
})

describe('nsecToBytes', () => {
  it('converts nsec to bytes', () => {
    const bytes = nsecToBytes(TEST_NSEC)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
  })

  it('converts hex to bytes', () => {
    const bytes = nsecToBytes(TEST_HEX)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
  })

  it('throws on invalid input', () => {
    expect(() => nsecToBytes('invalid')).toThrow('Invalid key format')
  })
})

describe('tryNsecToHex', () => {
  it('converts valid nsec', () => {
    expect(tryNsecToHex(TEST_NSEC)).toBe(TEST_HEX)
  })

  it('converts valid hex', () => {
    expect(tryNsecToHex(TEST_HEX)).toBe(TEST_HEX)
  })

  it('returns empty string for undefined', () => {
    expect(tryNsecToHex(undefined)).toBe('')
  })

  it('returns empty string for invalid input', () => {
    expect(tryNsecToHex('garbage')).toBe('')
  })
})
