# Use Cases

Real-world examples of building with raw NIP-66 events.

## Relay Discovery

Find relays that match specific criteria for your app's needs.

```javascript
import { SimplePool, verifyEvent } from 'nostr-tools'

const pool = new SimplePool()
const nip66Relays = ['wss://relay.nostr.watch', 'wss://relaypag.es']

// Find relays that support NIP-42 (auth) and NIP-50 (search)
const events = await pool.querySync(nip66Relays, {
  kinds: [30166],
  '#N': ['42'],
  '#n': ['clearnet']
})

const verified = events.filter(e => verifyEvent(e))

// Deduplicate by relay URL (keep most recent per relay across monitors)
const relayMap = new Map()
for (const event of verified) {
  const relayUrl = event.tags.find(t => t[0] === 'd')?.[1]
  if (!relayUrl) continue

  const existing = relayMap.get(relayUrl)
  if (!existing || event.created_at > existing.created_at) {
    relayMap.set(relayUrl, event)
  }
}

// Filter for relays that also support NIP-50
const results = [...relayMap.values()].filter(event => {
  const nips = event.tags.filter(t => t[0] === 'N').map(t => t[1])
  return nips.includes('50')
})

console.log(`Found ${results.length} relays supporting NIP-42 + NIP-50`)
```

## Health Dashboard

Build a monitoring dashboard that shows relay health across the network.

```javascript
// Fetch all relay statuses and compute network-wide stats
const allStatuses = await pool.querySync(nip66Relays, {
  kinds: [30166],
  '#n': ['clearnet']
})

const verified = allStatuses.filter(e => verifyEvent(e))

// Group by relay URL, keeping latest event per (relay, monitor) pair
const relays = new Map() // relayUrl -> Map<monitorPubkey, event>
for (const event of verified) {
  const url = event.tags.find(t => t[0] === 'd')?.[1]
  if (!url) continue

  if (!relays.has(url)) relays.set(url, new Map())
  const monitors = relays.get(url)

  const existing = monitors.get(event.pubkey)
  if (!existing || event.created_at > existing.created_at) {
    monitors.set(event.pubkey, event)
  }
}

// Compute stats
const stats = {
  totalRelays: relays.size,
  totalObservations: verified.length,
  softwareBreakdown: {},
}

for (const [url, monitors] of relays) {
  // Use most recent observation for software detection
  const latest = [...monitors.values()].sort((a, b) => b.created_at - a.created_at)[0]
  const software = latest.tags.find(t => t[0] === 's')?.[1] || 'unknown'
  stats.softwareBreakdown[software] = (stats.softwareBreakdown[software] || 0) + 1
}

console.log(`Network: ${stats.totalRelays} relays, ${stats.totalObservations} observations`)
console.log('Software:', stats.softwareBreakdown)
```

## Client Relay Selection

Help a Nostr client pick the best relays for a user based on latency and reliability.

```javascript
// Get relay statuses from monitors near the user's region
const events = await pool.querySync(nip66Relays, {
  kinds: [30166],
  '#n': ['clearnet'],
  '#R': ['!auth', '!payment'] // only free, open relays
})

const verified = events.filter(e => verifyEvent(e))

// Aggregate RTT per relay (median across monitors)
const relayRtt = new Map()
for (const event of verified) {
  const url = event.tags.find(t => t[0] === 'd')?.[1]
  const rttOpen = event.tags.find(t => t[0] === 'rtt-open')?.[1]
  if (!url || !rttOpen) continue

  if (!relayRtt.has(url)) relayRtt.set(url, [])
  relayRtt.get(url).push(Number(rttOpen))
}

// Rank by median latency
const ranked = [...relayRtt.entries()]
  .map(([url, rtts]) => {
    rtts.sort((a, b) => a - b)
    return { url, medianRtt: rtts[Math.floor(rtts.length / 2)], monitors: rtts.length }
  })
  .filter(r => r.monitors >= 2) // require at least 2 monitor observations
  .sort((a, b) => a.medianRtt - b.medianRtt)

console.log('Top 5 fastest open relays:')
for (const relay of ranked.slice(0, 5)) {
  console.log(`  ${relay.url} - ${relay.medianRtt}ms (${relay.monitors} monitors)`)
}
```

## Uptime Analytics

Track relay uptime over time using kind 1066 delta events.

```javascript
const now = Math.floor(Date.now() / 1000)
const oneWeekAgo = now - 7 * 86400

// Get delta events for a relay over the past week
const deltas = await pool.querySync(nip66Relays, {
  kinds: [1066],
  '#r': ['wss://relay.damus.io'],
  since: oneWeekAgo
})

const verified = deltas.filter(e => verifyEvent(e))
  .sort((a, b) => a.created_at - b.created_at)

// Track state transitions
let timeline = []
for (const event of verified) {
  const rTags = event.tags.filter(t => t[0] === 'R')
  const isOpen = rTags.some(t => t[1] === 'open')
  const isClosed = !isOpen

  timeline.push({
    time: new Date(event.created_at * 1000).toISOString(),
    monitor: event.pubkey.slice(0, 8),
    open: isOpen,
  })
}

console.log(`${timeline.length} state changes in the past week`)
```

## Monitor Discovery

Find and evaluate the monitors whose data you're consuming.

```javascript
// Get all monitor announcements
const announcements = await pool.querySync(nip66Relays, {
  kinds: [10166]
})

const verified = announcements.filter(e => verifyEvent(e))

for (const event of verified) {
  const frequency = event.tags.find(t => t[0] === 'frequency')?.[1]
  const networks = event.tags.filter(t => t[0] === 'n').map(t => t[1])
  const checks = event.tags.filter(t => t[0] === 'c').map(t => t[1])

  console.log(`Monitor: ${event.pubkey.slice(0, 16)}...`)
  console.log(`  Frequency: every ${frequency}s`)
  console.log(`  Networks: ${networks.join(', ')}`)
  console.log(`  Checks: ${checks.join(', ')}`)
}
```
