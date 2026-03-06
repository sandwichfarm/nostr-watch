# Querying NIP-66 Data

How to fetch and aggregate NIP-66 events from Nostr relays.

## Connecting to NIP-66 Relays

NIP-66 events are stored on specific relays. Connect to one or more of these:

```
wss://relay.nostr.watch
wss://relaypag.es
wss://monitorlizard.nostr1.com
```

## Constructing REQ Filters

### JavaScript (nostr-tools)

```javascript
import { SimplePool } from 'nostr-tools'

const pool = new SimplePool()
const relays = ['wss://relay.nostr.watch', 'wss://relaypag.es']

// Get all relay statuses
const statuses = await pool.querySync(relays, {
  kinds: [30166]
})

// Get status for a specific relay
const damusStatus = await pool.querySync(relays, {
  kinds: [30166],
  '#d': ['wss://relay.damus.io']
})

// Get all monitor announcements
const monitors = await pool.querySync(relays, {
  kinds: [10166]
})

// Get clearnet relays running strfry
const strfryRelays = await pool.querySync(relays, {
  kinds: [30166],
  '#n': ['clearnet'],
  '#s': ['strfry']
})
```

### Python (python-nostr)

```python
import json
import websocket

relay_url = "wss://relay.nostr.watch"
ws = websocket.create_connection(relay_url)

# Request all relay statuses
req = json.dumps(["REQ", "sub1", {"kinds": [30166]}])
ws.send(req)

# Read events until EOSE
events = []
while True:
    msg = json.loads(ws.recv())
    if msg[0] == "EVENT":
        events.append(msg[2])
    elif msg[0] == "EOSE":
        break

# Close subscription
ws.send(json.dumps(["CLOSE", "sub1"]))
ws.close()

print(f"Received {len(events)} relay status events")
```

## Aggregating Across Monitors

Multiple monitors report on the same relay. To get a reliable picture, aggregate their observations:

```javascript
import { SimplePool, verifyEvent } from 'nostr-tools'

const pool = new SimplePool()
const relays = ['wss://relay.nostr.watch', 'wss://relaypag.es']

// Get all observations for a relay
const events = await pool.querySync(relays, {
  kinds: [30166],
  '#d': ['wss://relay.damus.io']
})

// Verify signatures and group by monitor
const verified = events.filter(e => verifyEvent(e))
const byMonitor = new Map()
for (const event of verified) {
  const existing = byMonitor.get(event.pubkey)
  // Keep the most recent event per monitor
  if (!existing || event.created_at > existing.created_at) {
    byMonitor.set(event.pubkey, event)
  }
}

// Aggregate RTT values (median across monitors)
function getTagValue(event, tagName) {
  const tag = event.tags.find(t => t[0] === tagName)
  return tag ? Number(tag[1]) : null
}

const rttValues = [...byMonitor.values()]
  .map(e => getTagValue(e, 'rtt-open'))
  .filter(v => v !== null)
  .sort((a, b) => a - b)

const medianRtt = rttValues[Math.floor(rttValues.length / 2)]
console.log(`Median open RTT: ${medianRtt}ms from ${rttValues.length} monitors`)
```

## Signature Verification

Always verify event signatures before trusting the data. This is the key advantage of raw NIP-66 -- you can prove that a specific monitor pubkey signed a specific observation.

```javascript
import { verifyEvent } from 'nostr-tools'

for (const event of events) {
  if (!verifyEvent(event)) {
    console.warn(`Invalid signature from ${event.pubkey}`)
    continue
  }
  // Event is cryptographically verified
}
```

## Subscribing to Live Updates

Use Nostr subscriptions to get real-time updates as monitors publish new data:

```javascript
const sub = pool.subscribeMany(relays, [
  { kinds: [30166], '#d': ['wss://relay.damus.io'] }
], {
  onevent(event) {
    if (verifyEvent(event)) {
      console.log(`Update from monitor ${event.pubkey.slice(0, 8)}:`, event)
    }
  }
})

// Later: close the subscription
sub.close()
```

## Pagination and Limits

NIP-66 relays may store thousands of events. Use `limit` in your REQ filters and paginate with `until`:

```javascript
// First page
const page1 = await pool.querySync(relays, {
  kinds: [30166],
  limit: 100
})

// Next page (older events)
const oldestTimestamp = Math.min(...page1.map(e => e.created_at))
const page2 = await pool.querySync(relays, {
  kinds: [30166],
  limit: 100,
  until: oldestTimestamp
})
```

## Tips

- **Use multiple relays** for redundancy. If one relay is down, others still serve the data.
- **Cache locally**. NIP-66 data updates hourly -- no need to re-fetch constantly.
- **Verify before trusting**. Always call `verifyEvent()` on received events.
- **Filter server-side**. Use tag filters in REQ rather than fetching everything and filtering client-side.
- **Check `created_at`**. Discard events older than the monitor's declared `frequency` -- they may be stale.
