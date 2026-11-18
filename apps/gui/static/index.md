# nostr.watch: Nostr relay monitor

nostr.watch is a free, open-source monitor for Nostr relays. Monitors in several regions check relays every hour for connectivity, read and write support, latency, SSL and DNS, and publish the results as [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) events.

Relay data on https://nostr.watch loads in the browser. For programmatic access use one of the services below.

## Data services

| Service              | URL                                                                              | Use it for                                           |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| REST API v2          | https://api.nostr.watch/v2/                                                      | HTTP + JSON, OpenAPI docs and sandbox                |
| CVM (MCP over Nostr) | https://cvm.nostr.watch                                                          | 21 MCP tools for AI agents and MCP clients           |
| Raw NIP-66 events    | `wss://relay.nostr.watch`, `wss://relaypag.es`, `wss://monitorlizard.nostr1.com` | Trustless access; verify monitor signatures yourself |

REST examples:

```bash
curl 'https://api.nostr.watch/v2/relays?limit=10&sortBy=updated&sortOrder=desc'
curl 'https://api.nostr.watch/v2/relays/state?relayUrl=wss://relay.damus.io'
curl -X POST https://api.nostr.watch/v2/relays/search -H 'Content-Type: application/json' -d '{"nips":[42]}'
```

NIP-66 event kinds: `10166` monitor announcement, `30166` relay status (`d` tag = relay URL), `1066` relay status delta.

## Pages

- [Relays](https://nostr.watch/relays): table of known relays with status, latency and supported NIPs
- [Relay map](https://nostr.watch/relays/map)
- [Relays by software](https://nostr.watch/relays/software)
- [Relays by country](https://nostr.watch/relays/geography)
- [Relays by ISP](https://nostr.watch/relays/isps)
- [Monitors](https://nostr.watch/monitors)
- [Operators](https://nostr.watch/operators)

## Pricing

<!-- agent-pricing:start -->

The website and the raw NIP-66 events are free. Per-request prices for the REST API are listed at https://api.nostr.watch/v2/ and for CVM at https://cvm.nostr.watch.

<!-- agent-pricing:end -->

## FAQ

**What is NIP-66?** A Nostr protocol for relay discovery and liveness monitoring. Monitors publish signed events describing relay health, capabilities and availability.

**Is the data free?** The website and the raw NIP-66 events are free. The REST API and the CVM tools charge small per-request amounts in sats; see Pricing.

**How often is data updated?** Monitors check relays about every hour. The REST API and CVM ingest new monitor events as they are published.

**Can I self-host?** Yes. The monitors and the rstate aggregation engine behind the REST API and CVM are open source.

## About

- Source: https://github.com/sandwichfarm/nostr-watch (MIT)
- Built by [sandwich.farm](https://sandwich.farm)
- Agent summary: https://nostr.watch/llms.txt
