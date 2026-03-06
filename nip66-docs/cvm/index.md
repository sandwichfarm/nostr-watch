# CVM (MCP over Nostr)

CVM (ContextVM) exposes NIP-66 relay intelligence as **21 MCP tools** transported over the Nostr protocol. This gives you structured, queryable access to relay monitoring data without parsing raw events -- while preserving the privacy and decentralization benefits of Nostr.

## What is CVM?

CVM is [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) running over Nostr relays instead of HTTP. Your client sends a tool call as a Nostr event, the rstate server processes it, and returns the result as another Nostr event. No IP addresses exposed, no API keys needed.

## Why Use CVM?

- **Privacy**: Communication happens via Nostr pubkeys, not IP addresses
- **Self-hostable**: Run your own rstate instance for full sovereignty
- **AI-native**: Works with Claude Desktop, AI agents, and any MCP-compatible client
- **Structured data**: Get clean JSON responses instead of parsing raw Nostr events
- **21 tools**: Query, search, filter, compare, and monitor relays with purpose-built tools

## Trust Model

CVM operates on a **verify or self-host** model:

- **Using nostr.watch's CVM**: You trust that the rstate instance is honestly aggregating NIP-66 data. The aggregation logic is open source, but you can't independently verify the results without running your own instance.
- **Self-hosting**: Run your own rstate instance. It ingests raw NIP-66 events directly from Nostr relays, so you verify everything yourself. See [Self-Hosting](./self-hosting).

## Available Tools

CVM provides 21 tools organized into five groups:

| Group | Tools | Description |
|-------|-------|-------------|
| **Relay Queries** | `relays/list`, `relays/state`, `relays/search` | List, get details, and search relays |
| **Geospatial** | `relays/nearby`, `relays/bbox` | Find relays by location |
| **Labels** | `relays/labels`, `relays/labels/list`, `relays/by/label` | Query relay metadata labels |
| **Aggregations** | `relays/by/software`, `relays/by/network`, `relays/by/nip`, `relays/by/country` | Group relays by attributes |
| **Availability** | `relays/online`, `relays/offline`, `relays/dead`, `relays/compare` | Check relay status and compare |
| **Monitors** | `monitors/get`, `monitors/list` | Query monitor information |
| **System** | `health/ping`, `policy/get`, `policy/set` | Health checks and configuration |
| **Subscriptions** | `relays/subscribe_state`, `relays/unsubscribe` | Real-time state change notifications |

See the full [Tools Reference](./tools-reference) for schemas and descriptions.

## Next Steps

- [Getting Started](./getting-started) -- connect to CVM with Claude Desktop or programmatically
- [Tools Reference](./tools-reference) -- complete documentation for all 21 tools
- [Self-Hosting](./self-hosting) -- run your own rstate CVM instance
- [Payments](./payments) -- L402/Cashu payment flows for premium tools
