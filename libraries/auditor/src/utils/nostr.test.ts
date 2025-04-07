import { describe, it, expect, vi } from 'vitest'
import { generateSubId, is64CharHex, messageKey } from './nostr'

describe('nostr utils', () => {
  describe('generateSubId', () => {
    it('should generate string of default length 32', () => {
      const subId = generateSubId()
      expect(subId).toHaveLength(32)
    })

    it('should generate string of specified length', () => {
      const subId = generateSubId(16)
      expect(subId).toHaveLength(16)
    })

    it('should only contain valid characters', () => {
      const subId = generateSubId()
      expect(subId).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should generate random strings', () => {
      const subId1 = generateSubId()
      const subId2 = generateSubId()
      expect(subId1).not.toBe(subId2)
    })

    it('should handle zero length', () => {
      const subId = generateSubId(0)
      expect(subId).toBe('')
    })
  })

  describe('is64CharHex', () => {
    it('should return true for valid 64-char hex string', () => {
      const validHex = 'a'.repeat(64)
      expect(is64CharHex(validHex)).toBe(true)
    })

    it('should return true for mixed case hex string', () => {
      const validHex = 'a'.repeat(32) + 'f'.repeat(32)
      expect(is64CharHex(validHex)).toBe(true)
    })

    it('should return false for non-hex characters', () => {
      const invalidHex = 'g'.repeat(64)
      expect(is64CharHex(invalidHex)).toBe(false)
    })

    it('should return false for wrong length', () => {
      expect(is64CharHex('a'.repeat(63))).toBe(false)
      expect(is64CharHex('a'.repeat(65))).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(is64CharHex('')).toBe(false)
    })
  })

  describe('messageKey', () => {
    it('should return first element of message array', () => {
      const message = ['EVENT', 'test', { id: '123' }] as any
      expect(messageKey(message)).toBe('EVENT')
    })

    it('should handle different message types', () => {
      expect(messageKey(['EOSE', 'test'] as any)).toBe('EOSE')
      expect(messageKey(['REQ', 'test', {}] as any)).toBe('REQ')
    })
  })
}) 