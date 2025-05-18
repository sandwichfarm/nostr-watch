import { describe, it, expect } from 'vitest'
import { capitalize, truncate, toCode, fromCode } from './string'

describe('string utils', () => {
  describe('capitalize', () => {
    it('should capitalize first letter and lowercase rest', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('WORLD')).toBe('World')
      expect(capitalize('tEsT')).toBe('Test')
    })

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('')
    })

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A')
      expect(capitalize('Z')).toBe('Z')
    })
  })

  describe('truncate', () => {
    it('should not truncate strings shorter than maxLength', () => {
      expect(truncate('short string', 64)).toBe('short string')
    })

    it('should truncate strings longer than maxLength', () => {
      const longString = 'a'.repeat(100)
      expect(truncate(longString, 10)).toBe('a'.repeat(7) + '...')
    })

    it('should use default maxLength of 64', () => {
      const longString = 'a'.repeat(100)
      expect(truncate(longString)).toBe('a'.repeat(61) + '...')
    })

    it('should handle empty string', () => {
      expect(truncate('')).toBe('')
    })
  })

  describe('toCode', () => {
    it('should convert spaces to underscores and uppercase', () => {
      expect(toCode('hello world')).toBe('HELLO_WORLD')
    })

    it('should handle multiple spaces', () => {
      expect(toCode('hello  world  test')).toBe('HELLO__WORLD__TEST')
    })

    it('should handle already uppercase text', () => {
      expect(toCode('HELLO WORLD')).toBe('HELLO_WORLD')
    })

    it('should handle empty string', () => {
      expect(toCode('')).toBe('')
    })
  })

  describe('fromCode', () => {
    it('should convert underscores to spaces and lowercase', () => {
      expect(fromCode('HELLO_WORLD')).toBe('hello world')
    })

    it('should handle multiple underscores', () => {
      expect(fromCode('HELLO__WORLD__TEST')).toBe('hello  world  test')
    })

    it('should handle already lowercase text', () => {
      expect(fromCode('hello_world')).toBe('hello world')
    })

    it('should handle empty string', () => {
      expect(fromCode('')).toBe('')
    })
  })
}) 