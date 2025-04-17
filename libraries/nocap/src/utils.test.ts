import { describe, it, expect } from 'vitest'
import { random, parseRelayNetwork, relaysSerializedByNetwork } from './utils'

describe('NoCAP Utils', () => {
  describe('random', () => {
    it('should generate a random string of the specified length', () => {
      const result = random(10)
      expect(result).toHaveLength(10)
      expect(typeof result).toBe('string')
    })

    it('should generate different random strings', () => {
      const result1 = random(10)
      const result2 = random(10)
      expect(result1).not.toBe(result2)
    })
  })

  describe('parseRelayNetwork', () => {
    it('should identify clearnet URLs', () => {
      expect(parseRelayNetwork('wss://relay.example.com')).toBe('clearnet')
      expect(parseRelayNetwork('ws://localhost:4444')).toBe('clearnet')
    })

    it('should identify Tor URLs', () => {
      expect(parseRelayNetwork('wss://example.onion')).toBe('tor')
    })

    it('should identify I2P URLs', () => {
      expect(parseRelayNetwork('wss://example.i2p')).toBe('i2p')
    })
  })

  describe('relaysSerializedByNetwork', () => {
    it('should group relays by network type', () => {
      const relays = [
        'wss://relay1.example.com',
        'wss://relay2.example.com',
        'wss://example.onion',
        'wss://example.i2p'
      ]

      const result = relaysSerializedByNetwork(relays)
      
      expect(result.clearnet).toHaveLength(2)
      expect(result.tor).toHaveLength(1)
      expect(result.i2p).toHaveLength(1)
      
      expect(result.clearnet).toContain('wss://relay1.example.com')
      expect(result.clearnet).toContain('wss://relay2.example.com')
      expect(result.tor).toContain('wss://example.onion')
      expect(result.i2p).toContain('wss://example.i2p')
    })
  })
}) 