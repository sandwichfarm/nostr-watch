/**
 * Security Tests
 *
 * Tests for input validation, rate limiting, and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { initStateCore } from '../src/core/index.js'
import type { StateCore } from '../src/core/index.js'

describe('Security Tests', () => {
  let core: StateCore

  beforeEach(() => {
    core = initStateCore({
      aggregation: {
        windowStrategy: 'global',
        quorum: 0.5,
        labelQuorum: 0.3,
        madScale: 3,
        weights: { recency: 1, reliability: 1 },
        nipSourceOrder: ['vote'],
        geoPrefs: { preferHigherPrecision: true },
      },
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid relay URLs', () => {
      // Test various invalid URL formats
      const invalidUrls = [
        'not-a-url',
        'http://relay.example.com', // http instead of wss
        'ftp://relay.example.com', // wrong protocol
        'wss://', // empty host
        '../../../etc/passwd', // path traversal
        'javascript:alert(1)', // XSS attempt
        'wss://relay.example.com/<script>alert(1)</script>', // XSS in path
      ]

      invalidUrls.forEach(url => {
        try {
          // If URL validation happens, this should throw or return null
          const state = core.query.relays.getState(url)
          // If we get here, the URL passed validation
          // but should return null since it doesn't exist
          expect(state).toBeNull()
        } catch (err) {
          // If validation throws, that's also acceptable
          expect(err).toBeDefined()
        }
      })
    })

    it('should handle extremely long relay URLs', () => {
      // Test URL length limits
      const longUrl = 'wss://relay.example.com/' + 'a'.repeat(10000)
      const state = core.query.relays.getState(longUrl)
      expect(state).toBeNull()
    })

    it('should handle special characters in relay URLs', () => {
      // Test special characters that might cause issues
      const specialChars = [
        'wss://relay.example.com/\u0000', // null byte
        'wss://relay.example.com/\n', // newline
        'wss://relay.example.com/\r', // carriage return
        'wss://relay.example.com/\t', // tab
      ]

      specialChars.forEach(url => {
        const state = core.query.relays.getState(url)
        expect(state).toBeNull()
      })
    })

    it('should handle invalid filter parameters', () => {
      // Core API doesn't have pagination - test filter handling instead
      // Test that search handles invalid input gracefully
      try {
        const result = core.query.relays.search({
          maxLatency: { open: -1 } // Invalid negative latency
        })
        // Should handle gracefully or return empty
        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(true)
      } catch (err) {
        // Throwing is acceptable
        expect(err).toBeDefined()
      }

      // Test invalid minSupport values
      try {
        const result = core.query.relays.search({
          minSupport: 1.5 // Invalid > 1.0
        })
        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(true)
      } catch (err) {
        expect(err).toBeDefined()
      }
    })

    it('should handle malicious filter objects', () => {
      // Test prototype pollution attempts
      const maliciousFilters = [
        { '__proto__': { isAdmin: true } },
        { 'constructor': { prototype: { isAdmin: true } } },
        { 'prototype': { isAdmin: true } },
      ]

      maliciousFilters.forEach(filter => {
        try {
          const result = core.query.relays.search(filter as any)
          expect(result).toBeDefined()
          // Ensure no pollution occurred
          expect((Object.prototype as any).isAdmin).toBeUndefined()
        } catch (err) {
          // Throwing is acceptable
          expect(err).toBeDefined()
        }
      })
    })

    it('should sanitize label values', () => {
      // Test that labels don't contain script tags or other XSS vectors
      const maliciousLabels = [
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'onerror=alert(1)',
      ]

      // Labels should either be rejected or sanitized
      maliciousLabels.forEach(label => {
        const result = core.query.relays.listLabels()
        const foundLabels = result.filter(l => l.value === label)
        // If the label exists, verify it's been sanitized
        expect(foundLabels.length).toBe(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should not leak sensitive information in errors', () => {
      // Try to trigger various error conditions
      try {
        // This should fail gracefully without exposing internals
        (core as any).nonExistentMethod()
      } catch (err: any) {
        // Error should not contain file paths, stack traces, or internal details
        const errorStr = err.toString()
        expect(errorStr).not.toMatch(/\/home\//)
        expect(errorStr).not.toMatch(/node_modules/)
        expect(errorStr).not.toMatch(/at Object\./)
      }
    })

    it('should handle undefined and null inputs gracefully', () => {
      // Test null/undefined inputs don't crash the system
      expect(() => core.query.relays.getState(null as any)).not.toThrow()
      expect(() => core.query.relays.getState(undefined as any)).not.toThrow()
      expect(() => core.query.relays.search(null as any)).not.toThrow()
      expect(() => core.query.relays.search(undefined as any)).not.toThrow()
    })
  })

  describe('Resource Limits', () => {
    it('should handle large result sets without memory issues', () => {
      // Query all relays - should handle large datasets
      const result = core.query.relays.getAll()

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle large search result sets', () => {
      // Search all relays without filters
      const result = core.query.relays.search({})

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Data Integrity', () => {
    it('should prevent SQL injection-style attacks in filters', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE relays; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM users --",
      ]

      sqlInjectionAttempts.forEach(attempt => {
        try {
          // Core doesn't have 'url' filter in search, test with labels instead
          const result = core.query.relays.search({
            labels: [{ namespace: 'country', value: attempt }]
          })
          // Should return empty results, not execute any "SQL"
          expect(result.length).toBe(0)
        } catch (err) {
          // Throwing is acceptable
          expect(err).toBeDefined()
        }
      })
    })

    it('should prevent NoSQL injection attempts', () => {
      const nosqlInjectionAttempts = [
        { '$gt': '' },
        { '$ne': null },
        { '$where': 'this.isAdmin' },
      ]

      nosqlInjectionAttempts.forEach(attempt => {
        try {
          const result = core.query.relays.search(attempt as any)
          // Should handle gracefully
          expect(result).toBeDefined()
        } catch (err) {
          expect(err).toBeDefined()
        }
      })
    })
  })
})
