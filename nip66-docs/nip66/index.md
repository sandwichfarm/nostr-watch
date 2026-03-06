# Raw NIP-66 Events

[NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) defines a relay monitoring system for Nostr. Monitors periodically check relays and publish their findings as signed Nostr events. You can query these events from any relay that carries them, verify the signatures, and aggregate the data yourself.

This is the most decentralized and privacy-preserving way to access relay monitoring data -- no intermediary, no API keys, no trust required.

## How It Works

1. **Monitors** run health checks against Nostr relays (WebSocket open, read, write, DNS, SSL, geo, NIP-11 info)
2. Each monitor publishes results as **kind 30166** events -- one per relay, updated each check cycle
3. Monitors announce themselves with **kind 10166** events describing their configuration
4. Status changes are logged as **kind 1066** delta events for historical tracking

## Where to Find NIP-66 Events

These relays carry NIP-66 monitoring data:

```
wss://relay.nostr.watch
wss://relaypag.es
wss://monitorlizard.nostr1.com
```

## What You Get

A kind 30166 event for a relay looks like this:

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
    ["rtt-open", "120"],
    ["rtt-read", "85"],
    ["rtt-write", "95"],
    ["N", "1"],
    ["N", "11"],
    ["N", "42"]
  ]
}
```

The `content` field contains the relay's NIP-11 info document (when available). Tags encode structured data about the relay's network type, requirements, latency, and supported NIPs.

## Next Steps

- [Event Kinds](./event-kinds) -- deep dive into kind 10166, 30166, and 1066
- [Tags Reference](./tags-reference) -- complete tag table
- [Querying](./querying) -- how to construct REQ filters and aggregate data
- [Use Cases](./use-cases) -- real-world examples with code
