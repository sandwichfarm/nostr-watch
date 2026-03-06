# Monitors

Monitors are the foundation of NIP-66. They are services that periodically check Nostr relays and publish their findings as signed events.

## What Monitors Do

Each monitor:

1. **Maintains a list of relay URLs** to check (discovered through various sources)
2. **Performs health checks** at a configured interval (typically every hour)
3. **Publishes kind 30166 events** with the results -- one event per relay
4. **Publishes kind 10166** to announce itself and its configuration
5. **Publishes kind 1066** delta events when relay state changes

## Monitor Announcements (Kind 10166)

A monitor's announcement event tells you:

- **Frequency** -- how often it checks relays (e.g., every 3600 seconds)
- **Networks** -- which networks it monitors (clearnet, tor, i2p)
- **Checks** -- which check types it performs (open, read, write, ssl, dns, geo, info)
- **Timeouts** -- how long it waits before considering a check failed
- **Location** -- optionally, the monitor's geographic location (geohash)

```json
{
  "kind": 10166,
  "tags": [
    ["frequency", "3600"],
    ["n", "clearnet"],
    ["c", "open"],
    ["c", "read"],
    ["c", "write"],
    ["c", "ssl"],
    ["c", "dns"],
    ["timeout", "open", "5000"],
    ["timeout", "read", "5000"],
    ["timeout", "write", "5000"]
  ]
}
```

## The nostr.watch Monitor Network

nostr.watch operates monitors across multiple geographic regions. Each monitor independently checks relays and publishes results, creating a decentralized observation network.

The aggregation layer (rstate) combines observations from multiple monitors to produce consensus data. This means:

- **No single monitor is a single point of failure** -- if one goes down, others still report
- **Geographic diversity** -- monitors in different regions may see different latencies
- **Outlier detection** -- anomalous readings from one monitor are filtered out
- **Quorum requirements** -- a minimum number of monitors must agree for data to be considered valid

## Discovering Monitors

Query kind 10166 events from NIP-66 relays to discover active monitors:

```javascript
import { SimplePool } from 'nostr-tools'

const pool = new SimplePool()
const relays = ['wss://relay.nostr.watch', 'wss://relaypag.es']

const monitors = await pool.querySync(relays, {
  kinds: [10166]
})

for (const event of monitors) {
  const frequency = event.tags.find(t => t[0] === 'frequency')?.[1]
  const networks = event.tags.filter(t => t[0] === 'n').map(t => t[1])
  const checks = event.tags.filter(t => t[0] === 'c').map(t => t[1])

  console.log(`Monitor ${event.pubkey.slice(0, 16)}...`)
  console.log(`  Checks every ${frequency}s on ${networks.join(', ')}`)
  console.log(`  Performs: ${checks.join(', ')}`)
}
```

Through the CVM or REST API, use the `monitors/list` tool or `GET /monitors` endpoint.

## Monitor Reliability

Not all monitors are equally reliable. rstate tracks monitor reliability scores based on:

- **Coverage** -- how many relays the monitor checks
- **Consistency** -- how closely the monitor's observations match the consensus
- **Timeliness** -- whether the monitor publishes on its declared schedule

These scores are available through the `monitors/get` CVM tool or `GET /monitors/:pubkey/analytics` REST endpoint.

## Running Your Own Monitor

Running your own monitor contributes to the decentralization and reliability of the network. For setup instructions, see the [source documentation](https://docs.nostr.watch).

A monitor needs:

- A server with network access to relays you want to check
- A Nostr private key for signing events
- The nostr-watch monitoring software (relaymon or nocapd)
- Access to NIP-66 relays for publishing results

Your monitor's kind 10166 announcement will be discovered by other participants in the network, and your observations will be included in rstate's aggregation once you meet the quorum requirements.
