// @ts-nocheck — Dev utilities use old RelayState structure; needs full rewrite.
// TODO: Update mock generators and debug printers to use new AggregatedValue structure.
/**
 * Development Utilities
 *
 * Helper functions for development, debugging, and testing
 *
 * TODO: Update mock generators to use new AggregatedValue structure
 * The RelayState type has been refactored to use AggregatedValue wrappers,
 * but these dev utilities still use the old structure. This is acceptable
 * for development utilities but should be updated when these tools are actively used.
 */

import type { RelayState } from '../core/types/aggregation.js'
import type { StateCore } from '../core/index.js'

/**
 * Generate mock relay state for testing
 * NOTE: Uses old RelayState structure - needs update to AggregatedValue format
 */
export function generateMockRelay(url: string, overrides?: Partial<RelayState>): RelayState {
  const base: RelayState = {
    url,
    name: url.split('//')[1]?.split('.')[0] || 'relay',
    description: `Mock relay at ${url}`,
    pubkey: '0000000000000000000000000000000000000000000000000000000000000000',
    contact: 'test@example.com',
    software: 'mock-relay',
    version: '1.0.0',
    network: 'clearnet',
    supportsNip: {
      '1': { support: 1.0, confidence: 1.0 },
      '11': { support: 1.0, confidence: 1.0 },
    },
    open: {
      is: true,
      support: 1.0,
      confidence: 1.0,
    },
    read: {
      is: true,
      support: 1.0,
      confidence: 1.0,
    },
    write: {
      is: true,
      support: 1.0,
      confidence: 1.0,
    },
    geo: {
      lat: 37.7749,
      lon: -122.4194,
      precision: 6,
      support: 1.0,
      confidence: 1.0,
    },
    latency: {
      open: { median: 50, mad: 10, confidence: 1.0 },
      read: { median: 30, mad: 5, confidence: 1.0 },
      write: { median: 40, mad: 8, confidence: 1.0 },
    },
    limitations: {
      payment_required: false,
      auth_required: false,
      restricted_writes: false,
    },
    labels: {
      country: ['US'],
      city: ['San Francisco'],
      isp: ['example-isp'],
      asn: ['AS12345'],
    },
    lastSeen: Date.now(),
    monitors: {
      total: 1,
      agreeing: 1,
    },
    ...overrides,
  }

  return base as any as RelayState
}

/**
 * Generate multiple mock relays
 */
export function generateMockRelays(count: number, urlPrefix: string = 'wss://relay'): RelayState[] {
  const relays: RelayState[] = []

  for (let i = 0; i < count; i++) {
    const url = `${urlPrefix}${i}.example.com`
    relays.push(generateMockRelay(url, {
      latency: {
        open: { median: 50 + i * 10, mad: 10, confidence: 1.0 },
        read: { median: 30 + i * 5, mad: 5, confidence: 1.0 },
        write: { median: 40 + i * 8, mad: 8, confidence: 1.0 },
      },
    }))
  }

  return relays
}

/**
 * Export relay state to JSON file
 */
export function exportRelayStateToJSON(core: StateCore, filePath: string): void {
  const fs = require('fs')

  const relays = core.query.relays.getAll()
  const data = {
    exportedAt: new Date().toISOString(),
    relayCount: relays.length,
    relays: relays,
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log(`Exported ${relays.length} relays to ${filePath}`)
}

/**
 * Profile query performance
 */
export async function profileQuery<T>(
  name: string,
  fn: () => T,
  iterations: number = 100
): Promise<{ result: T; avgMs: number; minMs: number; maxMs: number }> {
  const times: number[] = []

  let result: T | undefined

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    result = fn()
    const end = performance.now()
    times.push(end - start)
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length
  const minMs = Math.min(...times)
  const maxMs = Math.max(...times)

  console.log(`\nProfile: ${name}`)
  console.log(`  Iterations: ${iterations}`)
  console.log(`  Average: ${avgMs.toFixed(2)}ms`)
  console.log(`  Min: ${minMs.toFixed(2)}ms`)
  console.log(`  Max: ${maxMs.toFixed(2)}ms`)

  return { result: result!, avgMs, minMs, maxMs }
}

/**
 * Benchmark multiple queries
 */
export async function benchmarkQueries(core: StateCore) {
  console.log('Benchmarking RelayVM queries...\n')

  // Get all relays
  await profileQuery('Get all relays', () => {
    return core.query.relays.getAll()
  }, 50)

  // Search by NIP
  await profileQuery('Search by NIP', () => {
    return core.query.relays.search({ nips: [42] })
  }, 50)

  // Get specific relay
  const allRelays = core.query.relays.getAll()
  if (allRelays.length > 0) {
    const firstRelay = allRelays[0]
    await profileQuery('Get specific relay', () => {
      return core.query.relays.getState(firstRelay.relayUrl)
    }, 100)
  }

  // Get labels
  await profileQuery('List labels', () => {
    return core.query.relays.listLabels()
  }, 50)

  // Monitor list
  await profileQuery('List monitors', () => {
    return core.query.monitors.getAll()
  }, 50)

  console.log('\n✓ Benchmark complete')
}

/**
 * Generate relay state report
 */
export function generateStateReport(core: StateCore): string {
  const stats = core.stats.get()
  const relays = core.query.relays.getAll()
  const monitors = core.query.monitors.getAll()
  const labels = core.query.relays.listLabels()

  const report = `
RelayVM State Report
====================

Generated: ${new Date().toISOString()}

## Overview
- Total Relays: ${relays.length}
- Total Observations: ${stats.observations.count}
- Total Monitors: ${monitors.length}
- Total Labels: ${labels.length}

## Relay Breakdown

### By Network
${(() => {
  const byNetwork = core.query.relays.byNetwork()
  return Object.entries(byNetwork)
    .map(([network, relays]) => `- ${network}: ${relays.length}`)
    .join('\n')
})()}

### By Software
${(() => {
  const bySoftware = core.query.relays.bySoftware()
  return Object.entries(bySoftware)
    .slice(0, 10)
    .map(([software, relays]) => `- ${software}: ${relays.length}`)
    .join('\n')
})()}

### By Status
- Online: ${core.query.relays.online({ onlineWindowSeconds: 3600 }).length}
- Offline: ${core.query.relays.offline({ offlineThresholdSeconds: 3600 }).length}

## Top NIPs Supported
${(() => {
  const byNip = core.query.relays.byNip()
  return Object.entries(byNip)
    .sort(([, a], [, b]) => b.relays.length - a.relays.length)
    .slice(0, 10)
    .map(([nip, data]) => `- NIP-${nip}: ${data.relays.length} relays (${(data.supportRatio * 100).toFixed(1)}% support)`)
    .join('\n')
})()}

## Monitor Statistics
${monitors.map((m: any) => `- ${m.name || m.pubkey.substring(0, 8)}...: ${m.frequency}s frequency`).join('\n')}
`

  return report
}

/**
 * Validate relay state integrity
 */
export function validateStateIntegrity(core: StateCore): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const relays = core.query.relays.getAll()

  // Check each relay
  // NOTE: This validation uses old RelayState structure - needs update
  relays.forEach((relay: any, i: number) => {
    // URL validation
    if (!relay.relayUrl || (!relay.relayUrl.startsWith('wss://') && !relay.relayUrl.startsWith('ws://'))) {
      errors.push(`Relay ${i}: Invalid URL: ${relay.relayUrl}`)
    }

    // Network validation (now wrapped in AggregatedValue)
    const networkValue = relay.network?.value
    if (networkValue && !['clearnet', 'tor', 'i2p', 'hybrid'].includes(networkValue)) {
      errors.push(`Relay ${i} (${relay.relayUrl}): Invalid network: ${networkValue}`)
    }

    // RTT validation (now in rtt property instead of latency)
    if (relay.rtt?.open?.value !== undefined && relay.rtt.open.value < 0) {
      errors.push(`Relay ${i} (${relay.relayUrl}): Negative RTT: ${relay.rtt.open.value}`)
    }

    // Geo coordinates validation
    if (relay.geo) {
      if (relay.geo.lat < -90 || relay.geo.lat > 90) {
        errors.push(`Relay ${i} (${relay.relayUrl}): Invalid latitude: ${relay.geo.lat}`)
      }
      if (relay.geo.lon < -180 || relay.geo.lon > 180) {
        errors.push(`Relay ${i} (${relay.relayUrl}): Invalid longitude: ${relay.geo.lon}`)
      }
    }

    // Monitor counts
    if (relay.monitors && relay.monitors.agreeing > relay.monitors.total) {
      errors.push(`Relay ${i} (${relay.relayUrl}): Agreeing monitors (${relay.monitors.agreeing}) > total (${relay.monitors.total})`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Debug: Print relay state in human-readable format
 */
export function debugPrintRelay(relay: RelayState): void {
  console.log(`\n=== Relay: ${relay.relayUrl} ===`)
  console.log(`Name: ${relay.name || 'N/A'}`)
  console.log(`Software: ${relay.software || 'unknown'} ${relay.version || ''}`)
  console.log(`Network: ${relay.network}`)

  console.log('\nStatus:')
  console.log(`  Open: ${relay.open?.is ? '✓' : '✗'} (support: ${(relay.open?.support || 0) * 100}%)`)
  console.log(`  Read: ${relay.read?.is ? '✓' : '✗'} (support: ${(relay.read?.support || 0) * 100}%)`)
  console.log(`  Write: ${relay.write?.is ? '✓' : '✗'} (support: ${(relay.write?.support || 0) * 100}%)`)

  if (relay.latency) {
    console.log('\nLatency:')
    if (relay.latency.open) {
      console.log(`  Open: ${relay.latency.open.median}ms ± ${relay.latency.open.mad}ms`)
    }
    if (relay.latency.read) {
      console.log(`  Read: ${relay.latency.read.median}ms ± ${relay.latency.read.mad}ms`)
    }
    if (relay.latency.write) {
      console.log(`  Write: ${relay.latency.write.median}ms ± ${relay.latency.write.mad}ms`)
    }
  }

  if (relay.geo) {
    console.log('\nLocation:')
    console.log(`  Coordinates: ${relay.geo.lat.toFixed(4)}, ${relay.geo.lon.toFixed(4)}`)
    console.log(`  Precision: ${relay.geo.precision}`)
  }

  console.log('\nNIPs Supported:')
  Object.entries(relay.supportsNip || {})
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([nip, data]) => {
      console.log(`  NIP-${nip}: ${(data.support * 100).toFixed(0)}% support`)
    })

  if (relay.labels) {
    console.log('\nLabels:')
    Object.entries(relay.labels).forEach(([namespace, values]) => {
      console.log(`  ${namespace}: ${values.join(', ')}`)
    })
  }

  console.log(`\nMonitors: ${relay.monitors?.total || 0} (${relay.monitors?.agreeing || 0} agreeing)`)
  console.log(`Last Seen: ${new Date(relay.lastSeen).toISOString()}`)
}

/**
 * Compare two relay states (for debugging changes)
 */
export function compareRelayStates(before: RelayState, after: RelayState): string[] {
  const changes: string[] = []

  // Check primitive fields
  const fields: (keyof RelayState)[] = ['name', 'description', 'software', 'version', 'network', 'contact']
  fields.forEach(field => {
    if (before[field] !== after[field]) {
      changes.push(`${field}: ${before[field]} → ${after[field]}`)
    }
  })

  // Check status
  if (before.open?.is !== after.open?.is) {
    changes.push(`open: ${before.open?.is} → ${after.open?.is}`)
  }
  if (before.read?.is !== after.read?.is) {
    changes.push(`read: ${before.read?.is} → ${after.read?.is}`)
  }
  if (before.write?.is !== after.write?.is) {
    changes.push(`write: ${before.write?.is} → ${after.write?.is}`)
  }

  // Check NIPs
  const beforeNips = new Set(Object.keys(before.supportsNip || {}))
  const afterNips = new Set(Object.keys(after.supportsNip || {}))

  const addedNips = [...afterNips].filter(n => !beforeNips.has(n))
  const removedNips = [...beforeNips].filter(n => !afterNips.has(n))

  if (addedNips.length > 0) {
    changes.push(`NIPs added: ${addedNips.join(', ')}`)
  }
  if (removedNips.length > 0) {
    changes.push(`NIPs removed: ${removedNips.join(', ')}`)
  }

  return changes
}

/**
 * Memory usage report
 */
export function getMemoryUsage(): {
  heapUsed: string
  heapTotal: string
  external: string
  arrayBuffers: string
} {
  const usage = process.memoryUsage()

  return {
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
    arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
  }
}

/**
 * Stress test: Generate load on the system
 */
export async function stressTest(
  core: StateCore,
  config: {
    durationSeconds: number
    requestsPerSecond: number
    queryTypes?: string[]
  }
): Promise<void> {
  const { durationSeconds, requestsPerSecond, queryTypes = ['list', 'search', 'get'] } = config

  console.log(`Starting stress test...`)
  console.log(`  Duration: ${durationSeconds}s`)
  console.log(`  Rate: ${requestsPerSecond} req/s`)
  console.log(`  Query types: ${queryTypes.join(', ')}`)

  const startTime = Date.now()
  const endTime = startTime + durationSeconds * 1000
  const intervalMs = 1000 / requestsPerSecond

  let requestCount = 0
  let errorCount = 0

  while (Date.now() < endTime) {
    const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)]

    try {
      switch (queryType) {
        case 'list':
          core.query.relays.list({ limit: 100, offset: 0 })
          break
        case 'search':
          core.query.relays.search({
            filter: { nips: [1, 9, 11] },
            limit: 100,
            offset: 0,
          })
          break
        case 'get':
          const relays = core.query.relays.list({ limit: 1, offset: 0 })
          if (relays.relays[0]) {
            core.query.relays.get(relays.relays[0].url)
          }
          break
      }

      requestCount++
    } catch (err) {
      errorCount++
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  const actualDuration = (Date.now() - startTime) / 1000
  const actualRps = requestCount / actualDuration

  console.log(`\nStress test complete:`)
  console.log(`  Total requests: ${requestCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`  Actual RPS: ${actualRps.toFixed(2)}`)
  console.log(`  Error rate: ${((errorCount / requestCount) * 100).toFixed(2)}%`)
}
