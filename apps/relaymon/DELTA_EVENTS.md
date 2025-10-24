# Delta Events (Kind 1066) - Usage Guide

## Overview

Delta events (Kind 1066) track **changes in relay state over time**. Instead of publishing complete relay information on every check, delta events only publish what changed, enabling:

- **Implicit downtime detection** - No separate downtime events needed
- **Change tracking** - Detect software updates, config changes, NIP support changes
- **Time series reconstruction** - Rebuild complete relay history from deltas
- **Bandwidth optimization** - Only publish changes, not full state
- **Multi-resolution queries** - Filter by time period (6h, 1d, 7d, 30d)

---

## Quick Start

### Enable Delta Events

Add to your `config.yaml`:

```yaml
relaymon:
  delta:
    enabled: true
    max_retries: 10  # Stop publishing after 10 consecutive offline checks
```

### Enable Period Aggregates (Optional)

```yaml
relaymon:
  delta:
    enabled: true
    max_retries: 10
    periods:
      enabled: true
      definitions:
        - '6h'   # Publish every check (if check interval is 6h)
        - '1d'   # Publish every 4th check
        - '7d'   # Publish every 28th check
        - '30d'  # Publish every ~120th check
```

---

## Event Structure

### Online Relay Event

When a relay is **online**, the event includes:
- `['d', relay_url]` - Relay identifier
- `['T', 'period']` - Period tag(s) for aggregates (optional, cascading)
- `['rtt-open', 'duration_ms']` - Connection time
- Delta tags (changes, additions, removals)

**Example:**
```json
{
  "kind": 1066,
  "tags": [
    ["d", "wss://relay.example.com"],
    ["T", "6h"],
    ["T", "1d"],
    ["rtt-open", "123"],
    ["name", "New Relay Name"],
    ["+supported_nips", "50"],
    ["-supported_nips", "42"],
    ["limitation.auth_required", "true"]
  ],
  "content": ""
}
```

### Offline Relay Event

When a relay is **offline**, the event only includes:
- `['d', relay_url]` - Relay identifier
- `['T', 'period']` - Period tag(s) if applicable
- `['retry', 'N']` - Retry attempt number

**No deltas** are included for offline relays.

**Example:**
```json
{
  "kind": 1066,
  "tags": [
    ["d", "wss://offline-relay.example.com"],
    ["retry", "5"]
  ],
  "content": ""
}
```

---

## Delta Tag Format

### Field Change
```
["field_name", "new_value"]
```
Example: `["name", "Updated Relay"]`

### Field Addition
```
["+field_name", "value"]
```
Example: `["+contact", "admin@relay.com"]`

### Field Removal
```
["-field_name", "old_value"]
```
Example: `["-software", "old-relay-software"]`

### Nested Fields (Dot Notation)
```
["parent.child", "value"]
```
Example: `["limitation.max_message_length", "32768"]`

### Array Elements
```
["+array_field", "added_element"]
["-array_field", "removed_element"]
```
Example:
- `["+supported_nips", "50"]` - Added NIP 50 support
- `["-supported_nips", "42"]` - Removed NIP 42 support

### Complex Arrays (JSON)
For `retention`, `fees.*` fields - entire array as JSON:
```
["retention", "[{\"kinds\":[0,1],\"time\":3600}]"]
```

---

## Period Aggregates

### How Periods Work

Period aggregates allow you to **filter events by time resolution**:

- **`T` tag (single-letter)** - Indexable, filterable
- **Cascading** - Events include ALL applicable periods
- **Snapshots** - State compared against last period boundary

### Example Timeline

**Check interval: 6h**
**Periods: ["6h", "1d", "7d"]**

| Check # | Time     | Periods Emitted | T Tags             |
|---------|----------|-----------------|---------------------|
| 1       | 0h       | 6h, 1d, 7d      | `['T','6h']['T','1d']['T','7d']` |
| 2       | 6h       | 6h              | `['T','6h']`       |
| 3       | 12h      | 6h              | `['T','6h']`       |
| 4       | 18h      | 6h              | `['T','6h']`       |
| 5       | 24h      | 6h, 1d          | `['T','6h']['T','1d']` |
| ...     | ...      | ...             | ...                |
| 28      | 168h (7d)| 6h, 1d, 7d      | `['T','6h']['T','1d']['T','7d']` |

### Why Cascading T Tags?

Each event is **queryable at all its resolution levels**:

```javascript
// Get ALL events (any period)
{ kinds: [1066], "#d": ["wss://relay.example.com"] }

// Get events with 6h resolution data
{ kinds: [1066], "#d": ["wss://relay.example.com"], "#T": ["6h"] }

// Get events with daily aggregate data
{ kinds: [1066], "#d": ["wss://relay.example.com"], "#T": ["1d"] }

// Get weekly summaries only
{ kinds: [1066], "#d": ["wss://relay.example.com"], "#T": ["7d"] }
```

---

## Query Examples

### Get All Delta Events for a Relay
```javascript
{
  kinds: [1066],
  "#d": ["wss://relay.example.com"]
}
```

### Get Recent Changes (Last 1000 Events)
```javascript
{
  kinds: [1066],
  "#d": ["wss://relay.example.com"],
  limit: 1000
}
```

### Get Daily Aggregates Only
```javascript
{
  kinds: [1066],
  "#d": ["wss://relay.example.com"],
  "#T": ["1d"]
}
```

### Get Weekly Summaries for Multiple Relays
```javascript
{
  kinds: [1066],
  "#d": [
    "wss://relay1.example.com",
    "wss://relay2.example.com"
  ],
  "#T": ["7d"]
}
```

### Get All 7-Day Period Events (Any Relay)
```javascript
{
  kinds: [1066],
  "#T": ["7d"],
  limit: 100
}
```

### Time-Bounded Query
```javascript
{
  kinds: [1066],
  "#d": ["wss://relay.example.com"],
  since: 1704067200,  // Jan 1, 2024
  until: 1735689600   // Jan 1, 2025
}
```

---

## Use Cases

### 1. Uptime Monitoring

**Detect downtime implicitly:**
```javascript
// Offline events have 'retry' tag, online events have 'rtt-open'
const isDown = event.tags.some(t => t[0] === 'retry');
const retryCount = event.tags.find(t => t[0] === 'retry')?.[1];
```

### 2. Software Update Detection

**Track relay software changes:**
```javascript
const softwareChange = event.tags.find(t => t[0] === 'software');
if (softwareChange) {
  console.log(`Relay updated to: ${softwareChange[1]}`);
}
```

### 3. NIP Support Tracking

**Monitor compatibility changes:**
```javascript
const addedNips = event.tags.filter(t => t[0] === '+supported_nips');
const removedNips = event.tags.filter(t => t[0] === '-supported_nips');
```

### 4. Fee Changes

**Alert on pricing updates:**
```javascript
const feeChange = event.tags.find(t => t[0].includes('fees'));
if (feeChange) {
  const newFees = JSON.parse(feeChange[1]);
  console.log('Fees updated:', newFees);
}
```

### 5. State Reconstruction

**Rebuild relay state from deltas:**
```typescript
function reconstructState(deltas: Kind1066Event[]): RelayInfo {
  const state = {};

  for (const event of deltas.sort((a, b) => a.created_at - b.created_at)) {
    for (const tag of event.tags) {
      const [key, value] = tag;

      if (key.startsWith('+')) {
        // Addition
        const field = key.slice(1);
        if (field.includes('.')) {
          setNested(state, field, value);
        } else {
          state[field] = value;
        }
      } else if (key.startsWith('-')) {
        // Removal
        const field = key.slice(1);
        delete state[field];
      } else if (key !== 'd' && key !== 'T' && key !== 'rtt-open' && key !== 'retry') {
        // Change
        if (key.includes('.')) {
          setNested(state, key, value);
        } else {
          state[key] = value;
        }
      }
    }
  }

  return state;
}
```

### 6. Historical Analysis

**Query different resolutions for analysis:**
```javascript
// High-resolution: every 6 hours
const detailedData = await queryEvents({ "#T": ["6h"], since, until });

// Medium-resolution: daily summaries
const dailyData = await queryEvents({ "#T": ["1d"], since, until });

// Low-resolution: weekly trends
const weeklyData = await queryEvents({ "#T": ["7d"], since, until });
```

---

## Best Practices

### 1. Choose Appropriate Periods

Match periods to your check interval:

✅ **Good:**
- Check interval: 6h → Periods: `["6h", "1d", "7d"]`
- Check interval: 1h → Periods: `["1h", "6h", "1d"]`

❌ **Bad:**
- Check interval: 7h → Periods: `["6h", "1d"]` (not clean multiples)

### 2. Set Reasonable max_retries

```yaml
max_retries: 10  # Stop after 10 offline checks
```

- **Too low:** Miss recovery events
- **Too high:** Spam for permanently offline relays
- **Recommended:** 10-20 retries

### 3. Filter by Period for Bandwidth

If you only need weekly trends, filter for them:
```javascript
{ "#T": ["7d"] }  // Much less data than all events
```

### 4. Handle First Check

First check has **all fields as additions** (`+field`):
```javascript
const isFirstCheck = event.tags.every(t =>
  t[0].startsWith('+') || t[0] === 'd' || t[0] === 'rtt-open' || t[0] === 'T'
);
```

### 5. Monitor Cascading Tags

Events with multiple T tags contain **cumulative state changes**:
```javascript
const periods = event.tags.filter(t => t[0] === 'T').map(t => t[1]);
// ['6h', '1d', '7d'] means deltas since 7d ago
```

---

## Troubleshooting

### No Delta Events Published

**Check configuration:**
```yaml
relaymon:
  delta:
    enabled: true  # ← Must be true
```

**Check logs:**
```bash
# Should see delta-related logs
grep "delta" relaymon.log
```

### Period Warnings on Startup

```
[WARN] Period "1d" is not a clean multiple of check interval
```

**Solution:** Adjust check interval or periods to be clean multiples.

### Events Missing Period Tags

**Reason:** Periods not enabled or not yet crossed boundary.

**Solution:**
```yaml
relaymon:
  delta:
    periods:
      enabled: true  # ← Enable periods
```

### Large Event Sizes

**Cause:** Complex arrays (retention, fees) can be large when stringified.

**Solution:**
- Monitor event sizes
- Consider not including complex fields in deltas
- Use period filtering to reduce bandwidth

---

## Performance Considerations

### Database Growth

- **Delta state table:** One row per monitored relay
- **Period snapshots:** One row per relay per period (e.g., 4 periods = 4 rows)
- **Growth:** O(relays × periods) storage

### Event Publishing

- **Baseline:** Every check publishes one event
- **With periods:** Same frequency, just additional tags
- **Bandwidth:** Minimal - only changes published

### Query Performance

- **Single-letter T tag:** Fully indexable in Nostr
- **Filtering:** Very efficient with period tags
- **Recommendation:** Use period filters for large time ranges

---

## Future Enhancements

Potential improvements being considered:

1. **Compression:** Delta compression for long-running relays
2. **Batch deltas:** Multiple changes in single event
3. **Delta chains:** Reference previous events for validation
4. **Metrics:** Built-in analytics on delta patterns
5. **NIP Proposal:** Standardize Kind 1066 for all monitors

---

## Support

For issues or questions:
- GitHub: [nostr-watch/relaymon](https://github.com/nostr-watch/relaymon)
- Nostr: Check monitor's `owner` pubkey in config

---

## Technical Reference

- **Event Kind:** 1066
- **Identifier Tag:** `d` (relay URL)
- **Period Tag:** `T` (single-letter, indexable)
- **State Storage:** SQLite (`relay_delta_state`, `relay_period_snapshots`)
- **Delta Detection:** Deep object comparison with dot notation
- **Complex Arrays:** JSON stringified as atomic values

---

**Version:** 1.0.0 (Phase 1 & 2 Complete)
**Last Updated:** 2025-10-25
