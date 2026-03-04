# @nostrwatch/nip66

Protocol documentation for NIP-66 — the Nostr Relay Monitoring System.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

[NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) defines a relay monitoring system for the Nostr protocol. Nostr is a simple, open protocol that allows clients to communicate via relays — WebSocket servers that store and forward signed events (the fundamental data unit of Nostr). NIP-66 specifies three event kinds that monitors publish to describe relay health, capabilities, and availability.

This directory serves as the reference documentation for the NIP-66 event model used throughout the nostr-watch monorepo. The implementation lives in [`@nostrwatch/publisher`](../../internal/publisher/README.md); this package provides protocol-level documentation for developers integrating with or extending the NIP-66 system.

## Installation

This package contains protocol documentation only — there is no installable TypeScript code in this directory. For the NIP-66 implementation, see [`@nostrwatch/publisher`](../../internal/publisher/README.md).

## Quick Start

NIP-66 monitors publish events to the Nostr network. Below are representative examples of each event kind.

**Kind 30166 — Relay status event** (one per relay per monitor):

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
    ["l", "draft7", "nip66.draft"]
  ]
}
```

**Kind 10166 — Monitor announcement event** (one per monitor, replaceable):

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

## API

### Event Kinds

NIP-66 defines three event kinds that together describe the relay monitoring lifecycle:

| Kind | NIP-01 Type | Purpose | `d` Tag |
|------|-------------|---------|---------|
| 10166 | Replaceable | Monitor announcement — declares a monitor's existence and capabilities | monitor pubkey |
| 30166 | Parameterized replaceable | Relay status — current health and metadata for one relay | relay URL |
| 1066 | Regular | Relay status delta — append-only history entry for relay-chronicle | none |

### Kind 10166 — Monitor Announcement

A monitor publishes kind 10166 to announce itself on the Nostr network. It declares which checks it performs, how often, and on which networks. This event is replaceable — a monitor publishes one event and updates it when its configuration changes.

**Tags for kind 10166:**

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `frequency` | `3600` | Check interval in seconds |
| `n` | `clearnet` | Network monitored (`clearnet`, `tor`, `i2p`) |
| `c` | `open` | Check type performed (`open`, `read`, `write`, `ssl`, `dns`, `geo`, `info`) |
| `timeout` | `open`, `5000` | Timeout in milliseconds for the named check (multi-value tag) |
| `k` | `30166` | Event kinds published by this monitor |
| `g` | `u4pruyd` | Geohash of the monitor's location |

### Kind 30166 — Relay Status

A monitor publishes kind 30166 to report the current status of a specific relay. One event exists per (relay, monitor) pair — the `d` tag is the relay URL, making this a parameterized replaceable event. The `content` field contains the relay's NIP-11 info document (if available) as a JSON string.

**Tags for kind 30166:**

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `d` | `wss://relay.damus.io` | Relay URL — the addressable identifier for this event |
| `r` | `wss://relay.damus.io` | Relay URL (queryable tag) |
| `n` | `clearnet` | Network type (`clearnet`, `tor`, `i2p`) |
| `R` | `!auth` | Relay requirement flags (prefix `!` = not required) |
| `R` | `payment` | Relay requires payment |
| `R` | `pow` | Relay requires proof of work |
| `R` | `ssl` | TLS certificate is valid |
| `rtt-open` | `120` | Round-trip time in ms for WebSocket open check |
| `rtt-read` | `85` | Round-trip time in ms for read check |
| `rtt-write` | `95` | Round-trip time in ms for write check |
| `N` | `1` | Supported NIP number (one tag per NIP) |
| `k` | `1` | Event kind supported by the relay (one tag per kind, max 21) |
| `p` | `<pubkey>` | Relay operator pubkey (from NIP-11) |
| `s` | `strfry` | Relay software (from NIP-11 `software` field) |
| `L` | `ISO-639-1` | Label namespace for language tags |
| `l` | `en`, `ISO-639-1` | Label value in the given namespace |
| `l` | `draft7`, `nip66.draft` | NIP-66 draft version label |

### Kind 1066 — Relay Status Delta

A monitor publishes kind 1066 as an append-only log entry recording a relay status change. Unlike kind 30166, these events accumulate over time and are consumed by [`@nostrwatch/relay-chronicle`](../relay-chronicle/README.md) to build historical timelines.

Kind 1066 is a regular event (not replaceable). It uses a subset of kind 30166 tags to record which checks changed and what the new values are.

### The `R` Tag Convention

The `R` tag signals relay capability flags. A value without `!` prefix means the flag is active; a value with `!` prefix means it is not active:

| Tag Value | Meaning |
|-----------|---------|
| `open` | Relay accepted a WebSocket connection |
| `read` | Relay responded to a REQ subscription |
| `write` | Relay accepted an EVENT message |
| `ssl` | TLS certificate is currently valid |
| `auth` | Relay requires NIP-42 authentication |
| `payment` | Relay requires payment (NIP-57) |
| `pow` | Relay requires proof of work |
| `!auth` | Relay does not require authentication |
| `!payment` | Relay does not require payment |
| `!pow` | Relay does not require proof of work |

## Known Limitations

This package contains protocol documentation only, with no executable code. For the implementation, see [`@nostrwatch/publisher`](../../internal/publisher/README.md). The NIP-66 specification is still in draft — the `l draft7 nip66.draft` tag in kind 30166 events reflects this status.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — implementation of kind 10166 and kind 30166 event publishing
- [`@nostrwatch/nocap-route66`](../nocap-route66/README.md) — converts nocap check results into NIP-66 kind 30166 events
- [`@nostrwatch/nocap`](../nocap/README.md) — performs the relay checks that produce the data encoded in NIP-66 events
- [`@nostrwatch/relay-chronicle`](../relay-chronicle/README.md) — consumes kind 1066 delta events to build relay history timelines

## License

[MIT](../../LICENSE)
