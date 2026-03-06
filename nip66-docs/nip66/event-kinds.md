# Event Kinds

NIP-66 defines three event kinds that together describe the relay monitoring lifecycle.

| Kind | NIP-01 Type | Purpose | `d` Tag |
|------|-------------|---------|---------|
| **10166** | Replaceable | Monitor announcement -- declares a monitor's existence and capabilities | monitor pubkey |
| **30166** | Parameterized replaceable | Relay status -- current health and metadata for one relay | relay URL |
| **1066** | Regular | Relay status delta -- append-only history entry | none |

## Kind 10166 -- Monitor Announcement

A monitor publishes kind 10166 to announce itself on the Nostr network. It declares which checks it performs, how often, and on which networks. This event is **replaceable** -- a monitor publishes one and updates it when its configuration changes.

```json
{
  "kind": 10166,
  "pubkey": "<monitor-pubkey>",
  "content": "",
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

### Tags

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `frequency` | `3600` | Check interval in seconds |
| `n` | `clearnet` | Network monitored (`clearnet`, `tor`, `i2p`) |
| `c` | `open` | Check type performed (`open`, `read`, `write`, `ssl`, `dns`, `geo`, `info`) |
| `timeout` | `open`, `5000` | Timeout in ms for the named check (multi-value tag) |
| `k` | `30166` | Event kinds published by this monitor |
| `g` | `u4pruyd` | Geohash of the monitor's location |

### How to Use It

Query kind 10166 events to discover active monitors. The `frequency` tag tells you how often to expect fresh data. Compare multiple monitors' check configurations to understand coverage.

```javascript
const monitorFilter = { kinds: [10166] }
```

## Kind 30166 -- Relay Status

A monitor publishes kind 30166 to report the **current status** of a specific relay. One event exists per (relay, monitor) pair -- the `d` tag is the relay URL, making this a **parameterized replaceable event**.

The `content` field contains the relay's NIP-11 info document (if available) as a JSON string.

```json
{
  "kind": 30166,
  "pubkey": "<monitor-pubkey>",
  "content": "{\"supported_nips\":[1,11,42],\"software\":\"strfry\",\"version\":\"1.0.0\"}",
  "tags": [
    ["d", "wss://relay.damus.io"],
    ["r", "wss://relay.damus.io"],
    ["n", "clearnet"],
    ["R", "!auth"],
    ["R", "!payment"],
    ["R", "!pow"],
    ["rtt-open", "120"],
    ["rtt-read", "85"],
    ["rtt-write", "95"],
    ["N", "1"],
    ["N", "11"],
    ["N", "42"],
    ["s", "strfry"],
    ["l", "draft7", "nip66.draft"]
  ]
}
```

### Tags

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `d` | `wss://relay.damus.io` | Relay URL -- addressable identifier |
| `r` | `wss://relay.damus.io` | Relay URL (queryable) |
| `n` | `clearnet` | Network type (`clearnet`, `tor`, `i2p`) |
| `R` | `!auth` | Relay requirement flags (see [R tag convention](#the-r-tag-convention)) |
| `rtt-open` | `120` | Round-trip time in ms for WebSocket open |
| `rtt-read` | `85` | Round-trip time in ms for read check |
| `rtt-write` | `95` | Round-trip time in ms for write check |
| `N` | `1` | Supported NIP number (one tag per NIP) |
| `k` | `1` | Supported event kind (one tag per kind, max 21) |
| `p` | `<pubkey>` | Relay operator pubkey (from NIP-11) |
| `s` | `strfry` | Relay software (from NIP-11 `software` field) |
| `L` | `ISO-639-1` | Label namespace for language tags |
| `l` | `en`, `ISO-639-1` | Label value in the given namespace |
| `l` | `draft7`, `nip66.draft` | NIP-66 draft version label |

### How to Use It

This is the primary event kind for relay intelligence. Query kind 30166 events filtered by relay URL, network, or supported NIPs to build relay selection logic.

```javascript
// Get status for a specific relay from all monitors
const relayFilter = {
  kinds: [30166],
  '#d': ['wss://relay.damus.io']
}

// Get all clearnet relay statuses
const clearnetFilter = {
  kinds: [30166],
  '#n': ['clearnet']
}
```

## Kind 1066 -- Relay Status Delta

Kind 1066 is an append-only log recording relay status changes over time. Unlike kind 30166 (which is replaceable), these events **accumulate** and are used for historical analysis.

Kind 1066 uses a subset of kind 30166 tags to record which checks changed and what the new values are.

### How to Use It

Query kind 1066 events to build historical timelines -- when relays went offline, latency trends, software version changes, etc.

```javascript
// Get recent status changes for a relay
const deltaFilter = {
  kinds: [1066],
  '#r': ['wss://relay.damus.io'],
  since: Math.floor(Date.now() / 1000) - 86400 // last 24 hours
}
```

## The R Tag Convention

The `R` tag signals relay capability flags. A value **without** `!` prefix means the flag is **active**; a value **with** `!` prefix means it is **not active**.

| Tag Value | Meaning |
|-----------|---------|
| `open` | Relay accepted a WebSocket connection |
| `read` | Relay responded to a REQ subscription |
| `write` | Relay accepted an EVENT message |
| `ssl` | TLS certificate is currently valid |
| `auth` | Relay requires NIP-42 authentication |
| `payment` | Relay requires payment |
| `pow` | Relay requires proof of work |
| `!auth` | Relay does **not** require authentication |
| `!payment` | Relay does **not** require payment |
| `!pow` | Relay does **not** require proof of work |

Use R tags to filter relays by access requirements. For example, to find open relays that don't require authentication or payment:

```javascript
const openRelayFilter = {
  kinds: [30166],
  '#R': ['!auth', '!payment']
}
```
