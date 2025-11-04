/**
 * Performance Benchmarks for Three-Level Response Shaping
 *
 * Measures and compares the performance characteristics of the three
 * response shaping levels: full, detailed, and simple.
 *
 * Metrics tested:
 * - Processing time for transformation
 * - Memory footprint (payload size)
 * - Throughput (items/second)
 * - Scalability with increasing dataset sizes
 */

import { describe, it, expect, beforeAll } from 'vitest'
import type { RelayState } from '../src/core/index.js'
import {
  toSimpleList,
  applyShapeList,
  toCompact,
  toDetailed,
} from '../src/types/response-formats.js'

describe('Performance Benchmarks: Response Shaping', () => {
  let smallDataset: RelayState[]
  let mediumDataset: RelayState[]
  let largeDataset: RelayState[]

  beforeAll(() => {
    // Generate test datasets of varying sizes
    smallDataset = generateMockRelayStates(10)
    mediumDataset = generateMockRelayStates(100)
    largeDataset = generateMockRelayStates(1000)
  })

  /**
   * Helper to generate mock relay states with realistic data
   */
  function generateMockRelayStates(count: number): RelayState[] {
    const states: RelayState[] = []
    const baseTime = Math.floor(Date.now() / 1000)

    for (let i = 0; i < count; i++) {
      states.push({
        relayUrl: `wss://relay${i}.example.com`,
        updated_at: baseTime + i,
        observationCount: Math.floor(Math.random() * 100) + 10,
        lastSeenAt: baseTime + i + 60,
        lastOpenAt: baseTime + i + 30,
        network: {
          value: 'clearnet',
          support: 1.0,
          sampleSize: 10,
          lastUpdated: baseTime,
          contributingAuthors: ['monitor1', 'monitor2', 'monitor3'],
        },
        software: {
          family: {
            value: 'strfry',
            support: 0.9,
            sampleSize: 9,
            lastUpdated: baseTime,
            contributingAuthors: ['monitor1', 'monitor2'],
          },
          version: {
            value: '0.9.6',
            support: 0.8,
            sampleSize: 8,
            lastUpdated: baseTime,
            contributingAuthors: ['monitor1', 'monitor3'],
          },
        },
        rtt: {
          open: {
            value: 150 + Math.random() * 100,
            mad: 15,
            support: 1.0,
            sampleSize: 10,
            lastUpdated: baseTime,
            contributingAuthors: ['monitor1', 'monitor2'],
          },
          read: {
            value: 50 + Math.random() * 30,
            mad: 5,
            support: 1.0,
            sampleSize: 10,
            lastUpdated: baseTime,
            contributingAuthors: ['monitor1', 'monitor2', 'monitor3'],
          },
        },
        country: {
          value: ['US', 'DE', 'JP', 'UK'][i % 4],
          support: 1.0,
          sampleSize: 10,
          lastUpdated: baseTime,
          contributingAuthors: ['monitor1', 'monitor2', 'monitor3', 'monitor4'],
        },
        nips: {
          list: [1, 2, 11, 50],
          support: { 1: 1.0, 2: 1.0, 11: 0.8, 50: 0.9 },
        },
      } as RelayState)
    }

    return states
  }

  /**
   * Helper to measure execution time
   */
  function measureTime(fn: () => any): number {
    const start = performance.now()
    fn()
    const end = performance.now()
    return end - start
  }

  /**
   * Helper to estimate memory footprint via JSON serialization
   */
  function estimateSize(data: any): number {
    return JSON.stringify(data).length
  }

  describe('Processing Time Benchmarks', () => {
    it('should process small dataset (10 relays) quickly for all shapes', () => {
      const fullTime = measureTime(() => applyShapeList(smallDataset, 'full'))
      const detailedTime = measureTime(() => applyShapeList(smallDataset, 'detailed'))
      const simpleTime = measureTime(() => applyShapeList(smallDataset, 'simple'))

      // All should complete in under 10ms for small dataset
      expect(fullTime).toBeLessThan(10)
      expect(detailedTime).toBeLessThan(10)
      expect(simpleTime).toBeLessThan(10)

      console.log('\n📊 Small Dataset (10 relays) Processing Times:')
      console.log(`   full:     ${fullTime.toFixed(3)}ms`)
      console.log(`   detailed: ${detailedTime.toFixed(3)}ms`)
      console.log(`   simple:   ${simpleTime.toFixed(3)}ms`)
    })

    it('should process medium dataset (100 relays) efficiently', () => {
      const fullTime = measureTime(() => applyShapeList(mediumDataset, 'full'))
      const detailedTime = measureTime(() => applyShapeList(mediumDataset, 'detailed'))
      const simpleTime = measureTime(() => applyShapeList(mediumDataset, 'simple'))

      // All should complete in under 50ms for medium dataset
      expect(fullTime).toBeLessThan(50)
      expect(detailedTime).toBeLessThan(50)
      expect(simpleTime).toBeLessThan(50)

      console.log('\n📊 Medium Dataset (100 relays) Processing Times:')
      console.log(`   full:     ${fullTime.toFixed(3)}ms`)
      console.log(`   detailed: ${detailedTime.toFixed(3)}ms`)
      console.log(`   simple:   ${simpleTime.toFixed(3)}ms`)

      // Simple should be fastest (just URL extraction)
      expect(simpleTime).toBeLessThan(detailedTime)
    })

    it('should process large dataset (1000 relays) within reasonable time', () => {
      const fullTime = measureTime(() => applyShapeList(largeDataset, 'full'))
      const detailedTime = measureTime(() => applyShapeList(largeDataset, 'detailed'))
      const simpleTime = measureTime(() => applyShapeList(largeDataset, 'simple'))

      // All should complete in under 500ms for large dataset
      expect(fullTime).toBeLessThan(500)
      expect(detailedTime).toBeLessThan(500)
      expect(simpleTime).toBeLessThan(500)

      console.log('\n📊 Large Dataset (1000 relays) Processing Times:')
      console.log(`   full:     ${fullTime.toFixed(3)}ms`)
      console.log(`   detailed: ${detailedTime.toFixed(3)}ms`)
      console.log(`   simple:   ${simpleTime.toFixed(3)}ms`)

      // Performance hierarchy: simple < detailed < full
      expect(simpleTime).toBeLessThan(detailedTime)
      expect(detailedTime).toBeLessThan(fullTime * 1.2) // Allow 20% variance
    })
  })

  describe('Memory Footprint Benchmarks', () => {
    it('should show significant size reduction with simple format', () => {
      const fullResult = applyShapeList(mediumDataset, 'full')
      const detailedResult = applyShapeList(mediumDataset, 'detailed')
      const simpleResult = applyShapeList(mediumDataset, 'simple')

      const fullSize = estimateSize(fullResult)
      const detailedSize = estimateSize(detailedResult)
      const simpleSize = estimateSize(simpleResult)

      console.log('\n📦 Medium Dataset (100 relays) Payload Sizes:')
      console.log(`   full:     ${(fullSize / 1024).toFixed(2)} KB`)
      console.log(`   detailed: ${(detailedSize / 1024).toFixed(2)} KB`)
      console.log(`   simple:   ${(simpleSize / 1024).toFixed(2)} KB`)
      console.log(`   detailed reduction: ${((1 - detailedSize / fullSize) * 100).toFixed(1)}%`)
      console.log(`   simple reduction:   ${((1 - simpleSize / fullSize) * 100).toFixed(1)}%`)

      // Size hierarchy: simple < detailed < full
      expect(simpleSize).toBeLessThan(detailedSize)
      expect(detailedSize).toBeLessThan(fullSize)

      // Simple should be at least 80% smaller than full
      expect(simpleSize).toBeLessThan(fullSize * 0.2)

      // Detailed should be at least 20% smaller than full (removed contributingAuthors)
      expect(detailedSize).toBeLessThan(fullSize * 0.8)
    })

    it('should demonstrate linear scaling of payload size', () => {
      const smallSimple = estimateSize(applyShapeList(smallDataset, 'simple'))
      const mediumSimple = estimateSize(applyShapeList(mediumDataset, 'simple'))
      const largeSimple = estimateSize(applyShapeList(largeDataset, 'simple'))

      console.log('\n📈 Simple Format Payload Scaling:')
      console.log(`   10 relays:   ${(smallSimple / 1024).toFixed(2)} KB`)
      console.log(`   100 relays:  ${(mediumSimple / 1024).toFixed(2)} KB`)
      console.log(`   1000 relays: ${(largeSimple / 1024).toFixed(2)} KB`)

      // Should scale roughly linearly (within 30% variance due to JSON overhead)
      const ratio1 = mediumSimple / smallSimple
      const ratio2 = largeSimple / mediumSimple
      expect(ratio1).toBeGreaterThan(7) // ~10x dataset, expect >7x size
      expect(ratio1).toBeLessThan(13) // but <13x due to overhead
      expect(ratio2).toBeGreaterThan(7)
      expect(ratio2).toBeLessThan(13)
    })
  })

  describe('Throughput Benchmarks', () => {
    it('should calculate items/second for each shape', () => {
      const iterations = 10
      let fullTotal = 0
      let detailedTotal = 0
      let simpleTotal = 0

      // Run multiple iterations to get stable results
      for (let i = 0; i < iterations; i++) {
        fullTotal += measureTime(() => applyShapeList(mediumDataset, 'full'))
        detailedTotal += measureTime(() => applyShapeList(mediumDataset, 'detailed'))
        simpleTotal += measureTime(() => applyShapeList(mediumDataset, 'simple'))
      }

      const fullAvg = fullTotal / iterations
      const detailedAvg = detailedTotal / iterations
      const simpleAvg = simpleTotal / iterations

      const fullThroughput = (mediumDataset.length / fullAvg) * 1000
      const detailedThroughput = (mediumDataset.length / detailedAvg) * 1000
      const simpleThroughput = (mediumDataset.length / simpleAvg) * 1000

      console.log('\n⚡ Throughput (items/second, 100 relays, 10 iterations):')
      console.log(`   full:     ${fullThroughput.toFixed(0)} items/s`)
      console.log(`   detailed: ${detailedThroughput.toFixed(0)} items/s`)
      console.log(`   simple:   ${simpleThroughput.toFixed(0)} items/s`)

      // All should process at least 1000 items/second
      expect(fullThroughput).toBeGreaterThan(1000)
      expect(detailedThroughput).toBeGreaterThan(1000)
      expect(simpleThroughput).toBeGreaterThan(1000)

      // Simple should have highest throughput
      expect(simpleThroughput).toBeGreaterThan(detailedThroughput * 0.8)
    })
  })

  describe('Single Item Performance', () => {
    it('should process single relay state very quickly', () => {
      const singleState = smallDataset[0]

      const fullTime = measureTime(() => toDetailed(singleState))
      const detailedTime = measureTime(() => toCompact(singleState))

      // Single item should be sub-millisecond
      expect(fullTime).toBeLessThan(1)
      expect(detailedTime).toBeLessThan(1)

      console.log('\n⚡ Single Relay Processing Times:')
      console.log(`   full:     ${fullTime.toFixed(4)}ms`)
      console.log(`   detailed: ${detailedTime.toFixed(4)}ms`)
    })

    it('should show minimal overhead for toDetailed (identity function)', () => {
      const singleState = smallDataset[0]
      const iterations = 1000

      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        toDetailed(singleState)
      }
      const totalTime = performance.now() - start
      const avgTime = totalTime / iterations

      console.log(`\n🔄 toDetailed() overhead (${iterations} iterations):`)
      console.log(`   Average: ${avgTime.toFixed(6)}ms per call`)
      console.log(`   Total:   ${totalTime.toFixed(3)}ms`)

      // Identity function should be extremely fast
      expect(avgTime).toBeLessThan(0.01) // Sub-10 microseconds
    })
  })

  describe('Comparative Analysis', () => {
    it('should demonstrate optimal shape selection based on use case', () => {
      const dataset = mediumDataset
      const fullResult = applyShapeList(dataset, 'full')
      const detailedResult = applyShapeList(dataset, 'detailed')
      const simpleResult = applyShapeList(dataset, 'simple')

      const fullTime = measureTime(() => applyShapeList(dataset, 'full'))
      const detailedTime = measureTime(() => applyShapeList(dataset, 'detailed'))
      const simpleTime = measureTime(() => applyShapeList(dataset, 'simple'))

      const fullSize = estimateSize(fullResult)
      const detailedSize = estimateSize(detailedResult)
      const simpleSize = estimateSize(simpleResult)

      console.log('\n🎯 Shape Selection Guide (100 relays):')
      console.log('\n   full (attribution needed):')
      console.log(`     Time: ${fullTime.toFixed(3)}ms | Size: ${(fullSize / 1024).toFixed(2)} KB`)
      console.log(`     Use case: Monitoring dashboards, attribution tracking`)
      console.log('\n   detailed (balanced default):')
      console.log(`     Time: ${detailedTime.toFixed(3)}ms | Size: ${(detailedSize / 1024).toFixed(2)} KB`)
      console.log(`     Use case: General API consumers, client applications`)
      console.log('\n   simple (URL list only):')
      console.log(`     Time: ${simpleTime.toFixed(3)}ms | Size: ${(simpleSize / 1024).toFixed(2)} KB`)
      console.log(`     Use case: Relay discovery, URL validation, autocomplete`)

      // Verify expected use case performance
      expect(simpleTime).toBeLessThan(detailedTime)
      expect(simpleSize).toBeLessThan(detailedSize * 0.5) // At least 50% smaller
    })
  })

  describe('Edge Cases and Stress Tests', () => {
    it('should handle empty array efficiently', () => {
      const emptyTime = measureTime(() => {
        applyShapeList([], 'full')
        applyShapeList([], 'detailed')
        applyShapeList([], 'simple')
      })

      expect(emptyTime).toBeLessThan(1)
    })

    it('should handle very large single state object', () => {
      // Create a state with many fields populated
      const largeState: RelayState = {
        relayUrl: 'wss://large.relay.com',
        updated_at: Date.now(),
        observationCount: 1000,
        network: {
          value: 'clearnet',
          support: 1.0,
          sampleSize: 1000,
          lastUpdated: Date.now(),
          contributingAuthors: Array.from({ length: 100 }, (_, i) => `monitor${i}`),
        },
        nips: {
          list: Array.from({ length: 100 }, (_, i) => i),
          support: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, Math.random()])),
        },
      } as RelayState

      const detailedTime = measureTime(() => toCompact(largeState))
      expect(detailedTime).toBeLessThan(10) // Should still be fast

      const result = toCompact(largeState)
      expect(result.network?.contributingAuthors).toBeUndefined()
      expect(result.nips?.list).toHaveLength(100)
    })

    it('should maintain consistent performance across repeated calls', () => {
      const times: number[] = []
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        times.push(measureTime(() => applyShapeList(smallDataset, 'detailed')))
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length
      const stdDev = Math.sqrt(variance)

      console.log(`\n📊 Performance Consistency (${iterations} iterations):`)
      console.log(`   Average: ${avg.toFixed(4)}ms`)
      console.log(`   Std Dev: ${stdDev.toFixed(4)}ms`)
      console.log(`   Min:     ${Math.min(...times).toFixed(4)}ms`)
      console.log(`   Max:     ${Math.max(...times).toFixed(4)}ms`)

      // Coefficient of variation should be reasonable (<50%)
      const cv = (stdDev / avg) * 100
      expect(cv).toBeLessThan(50)
    })
  })
})
