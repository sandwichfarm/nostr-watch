import { describe, it, expect } from 'vitest'
import { formatNip } from './Auditor'

describe('formatNip', () => {
  describe('numeric input', () => {
    it('formats 0 as Nip00', () => {
      expect(formatNip(0)).toBe('Nip00')
    })

    it('formats 1 as Nip01', () => {
      expect(formatNip(1)).toBe('Nip01')
    })

    it('formats 9 as Nip09', () => {
      expect(formatNip(9)).toBe('Nip09')
    })

    it('formats 10 as Nip10 without padding', () => {
      expect(formatNip(10)).toBe('Nip10')
    })

    it('formats 42 as Nip42 without padding', () => {
      expect(formatNip(42)).toBe('Nip42')
    })

    it('formats 100 as Nip100 without padding', () => {
      expect(formatNip(100)).toBe('Nip100')
    })
  })

  describe('string input', () => {
    it('converts "1" and pads to Nip01', () => {
      expect(formatNip('1')).toBe('Nip01')
    })

    it('converts "42" to Nip42 without padding', () => {
      expect(formatNip('42')).toBe('Nip42')
    })

    it('converts "100" to Nip100 without padding', () => {
      expect(formatNip('100')).toBe('Nip100')
    })
  })
})
