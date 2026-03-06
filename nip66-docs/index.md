---
layout: doc
---

# NIP-66 Developer Guide

Build applications powered by real-time Nostr relay monitoring data.

[NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) is a Nostr protocol extension that defines how monitors publish relay health, capability, and availability data. The nostr-watch network runs monitors across six continents that publish NIP-66 events every hour.

This guide covers three ways to consume that data:

## Raw NIP-66 Events

Query NIP-66 events directly from Nostr relays. Trustless, free, and fully decentralized -- you verify monitor signatures yourself.

[Get started with raw NIP-66 &rarr;](/nip66/)

## CVM (MCP over Nostr)

Use 21 structured MCP tools over the Nostr protocol. Works with Claude Desktop, AI agents, or any MCP client. Self-hostable.

[Get started with CVM &rarr;](/cvm/)

## REST API

Standard HTTP endpoints with OpenAPI documentation. Lowest barrier to entry for quick prototyping and non-Nostr apps.

[Get started with REST &rarr;](/rest/)

---

Not sure which to use? Read the [interface comparison](/interfaces) to understand the tradeoffs.

## Default NIP-66 Relays

These relays carry NIP-66 monitoring data:

| Relay | Description |
|-------|-------------|
| `wss://relay.nostr.watch` | Primary nostr.watch relay |
| `wss://relaypag.es` | Relaypages NIP-66 relay |
| `wss://monitorlizard.nostr1.com` | Monitor Lizard relay |

## Quick Links

- [NIP-66 specification](https://github.com/nostr-protocol/nips/blob/master/66.md) (upstream NIP)
- [nostr-watch source docs](https://docs.nostr.watch) (internal monorepo documentation)
- [GitHub repository](https://github.com/sandwichfarm/nostr-watch)
