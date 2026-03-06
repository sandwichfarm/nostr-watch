# Tags Reference

Complete reference for all tags used in NIP-66 events.

## Kind 10166 Tags (Monitor Announcement)

| Tag | Values | Required | Description |
|-----|--------|----------|-------------|
| `frequency` | seconds (e.g. `3600`) | Yes | How often this monitor checks relays |
| `n` | `clearnet`, `tor`, `i2p` | Yes | Networks this monitor covers (one tag per network) |
| `c` | `open`, `read`, `write`, `ssl`, `dns`, `geo`, `info` | Yes | Check types performed (one tag per check) |
| `timeout` | check name, ms (e.g. `open`, `5000`) | No | Timeout for the named check (multi-value tag) |
| `k` | kind number (e.g. `30166`) | No | Event kinds this monitor publishes |
| `g` | geohash (e.g. `u4pruyd`) | No | Geohash of the monitor's physical location |

## Kind 30166 Tags (Relay Status)

| Tag | Values | Required | Description |
|-----|--------|----------|-------------|
| `d` | relay URL | Yes | Addressable identifier (parameterized replaceable) |
| `r` | relay URL | Yes | Queryable relay URL tag |
| `n` | `clearnet`, `tor`, `i2p` | Yes | Network type |
| `R` | see [R tag convention](./event-kinds#the-r-tag-convention) | No | Relay requirement/capability flags |
| `rtt-open` | milliseconds | No | Round-trip time for WebSocket open |
| `rtt-read` | milliseconds | No | Round-trip time for read check |
| `rtt-write` | milliseconds | No | Round-trip time for write check |
| `N` | NIP number | No | Supported NIP (one tag per NIP) |
| `k` | kind number | No | Supported event kind (one tag per kind, max 21) |
| `p` | hex pubkey | No | Relay operator pubkey (from NIP-11) |
| `s` | software name | No | Relay software (from NIP-11) |
| `L` | namespace (e.g. `ISO-639-1`) | No | Label namespace declaration |
| `l` | value, namespace | No | Label value in the declared namespace |

## Kind 1066 Tags (Relay Status Delta)

Kind 1066 uses a **subset** of kind 30166 tags. Only tags that changed since the last status event are included.

| Tag | Values | Description |
|-----|--------|-------------|
| `r` | relay URL | Which relay this delta applies to |
| `R` | capability flags | Changed requirement flags |
| `rtt-open` | milliseconds | Changed open latency |
| `rtt-read` | milliseconds | Changed read latency |
| `rtt-write` | milliseconds | Changed write latency |
| `N` | NIP number | Changed NIP support |

## Tag Querying Patterns

NIP-01 REQ filters support tag matching with the `#<tag-letter>` syntax:

```javascript
// Filter by tag values
{
  kinds: [30166],
  '#n': ['clearnet'],        // network = clearnet
  '#R': ['!auth'],           // does not require auth
  '#N': ['42'],              // supports NIP-42
  '#s': ['strfry'],          // runs strfry software
}
```

Note that tag filters use **string** values, even for numeric tags like `N`. The values `['42']` match the tag `["N", "42"]`.

## Content Field

| Kind | Content | Format |
|------|---------|--------|
| 10166 | Empty string | -- |
| 30166 | NIP-11 info document | JSON string (parse with `JSON.parse()`) |
| 1066 | Empty or partial NIP-11 diff | JSON string |

The kind 30166 content field contains the relay's self-reported NIP-11 information document. This includes fields like `name`, `description`, `supported_nips`, `software`, `version`, `contact`, `limitation`, etc. Always validate and sanitize this data -- it comes from the relay operator, not the monitor.
