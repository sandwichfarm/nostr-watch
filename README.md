[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/sandwichfarm/nostr-watch)

# @nostrwatch

A TypeScript monorepo for monitoring, auditing, and describing Nostr relays. `@nostrwatch` is an [OpenSats](https://opensats.org) grant recipient.

## Overview

nostr-watch provides the infrastructure for observing the Nostr relay network. It implements [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) (Relay Monitoring System) to crawl relays, check their health, audit their capabilities, and publish structured results back to the Nostr network. The stack includes client-facing dashboards, long-running monitoring agents, and a library ecosystem that other projects can use independently.

## Architecture

Packages are organized into three layers with a strict dependency direction:

```
internal  →  libraries  →  apps
```

- **internal/** — Infrastructure shared across the monorepo (logging, publishing, utilities)
- **libraries/** — Reusable packages that can be consumed independently
- **apps/** — Product applications (services, dashboards, CLI tools)

See the [Architecture Overview](docs/architecture.md) for details on the adapter pattern and cross-package conventions.

## Packages

### Apps

| Package | Description | Status | Platform |
|---------|-------------|--------|----------|
| [`@nostrwatch/gui`](apps/gui/) | NIP-66 Nostr relay dashboard | `alpha` | Web |
| [`@nostrwatch/relaymon`](apps/relaymon/) | Relay health monitor with NIP-66 event publishing | `alpha` | Node · Deno |
| [`@nostrwatch/trawler`](apps/trawler/) | Relay data crawler for the nostr-watch network | `alpha` | Node · Deno |
| [`@nostrwatch/rstate`](apps/rstate/) | NIP-66 relay intelligence state machine with REST and MCP endpoints | `alpha` | Node |
| [`@nostrwatch/purist`](apps/purist/) | Browser-based relay scanner | `alpha` | Web |
| [`@nostrwatch/umon`](apps/umon/) | Browser extension for monitoring Nostr activity | `alpha` | Web |
| [`@nostrwatch/docker-stacks`](apps/docker-stacks/) | Pre-configured Docker Compose stacks for nostr-watch services | — | Docker |
| ~~[`@nostrwatch/nocapd`](apps/nocapd/)~~ | ~~Relay monitoring daemon~~ — replaced by [`relaymon`](apps/relaymon/) | `deprecated` | — |

### Libraries

| Package | Description | Status | Platform |
|---------|-------------|--------|----------|
| [`@nostrwatch/nocap`](libraries/nocap/) | Extensible relay capability discovery framework | `alpha` | Web · Node |
| [`@nostrwatch/route66`](libraries/route66/) | NIP-66 relay aggregation and state management | `alpha` | Web · Node |
| [`@nostrwatch/auditor`](libraries/auditor/) | Relay validation against advertised NIP support | `alpha` | Web · Node |
| [`@nostrwatch/nostrings`](libraries/nostrings/) | Relay URL sanitization and normalization | `alpha` | Isomorphic |
| [`@nostrwatch/relay-chronicle`](libraries/relay-chronicle/) | Chronicle relay history from NIP-66 delta events | `alpha` | Web · Node |
| [`@nostrwatch/relay-charts`](libraries/relay-charts/) | Chart adapters for relay data visualization | `alpha` | Web |
| [`@nostrwatch/memory-relay`](libraries/memory-relay/) | In-memory Nostr relay for testing and embedding | `alpha` | Web · Node |
| [`@nostrwatch/worker-relay`](libraries/worker-relay/) | Nostr relay running in a Service Worker | `alpha` | Web |
| [`@nostrwatch/websocket`](libraries/websocket/) | Isomorphic WebSocket wrapper | `alpha` | Web · Node · Deno |
| [`@nostrwatch/nocap-route66`](libraries/nocap-route66/) | Transform nocap output into NIP-66 Kind 30166 events | `alpha` | Web · Node |
| [`@nostrwatch/schemata-js-ajv`](libraries/schemata-js-ajv/) | AJV wrappers for Nostr JSON schema validation | `alpha` | Web · Node |
| [`@nostrwatch/negentropy-utils`](libraries/negentropy/) | Negentropy set reconciliation utilities | `alpha` | Web · Node |
| [`@nostrwatch/kuma`](libraries/uptime-kuma-monitor/) | Uptime Kuma push monitor for Nostr relays | `alpha` | Node |
| [`@nostrwatch/db`](libraries/db/) | SQLite database layer | `alpha` | Node |
| [`nostrawl`](libraries/nostrawl/) | Continuous event retrieval from Nostr relays | `alpha` | Node |
| [`@nostrwatch/nip66`](libraries/nip66/) | NIP-66 protocol reference documentation | `docs` | — |
| ~~[`@nostrwatch/schemata`](libraries/schemata/)~~ | ~~JSON schemas for Nostr protocol~~ — moved to `@nostrability/schemata` | `deprecated` | — |
| ~~[`@nostrwatch/sanitize`](libraries/sanitize/)~~ | ~~Relay URL sanitization~~ — replaced by [`nostrings`](libraries/nostrings/) | `deprecated` | — |
| ~~`@nostrwatch/idb`~~ | ~~IndexedDB wrapper~~ — never implemented | `deprecated` | — |
| ~~`@nostrwatch/kit`~~ | ~~Adapter toolkit~~ — never completed | `deprecated` | — |
| ~~[`@nostrwatch/transform`](libraries/transform/)~~ | ~~Data transformation library~~ — never implemented | `deprecated` | — |

### Internal

| Package | Description | Status | Platform |
|---------|-------------|--------|----------|
| [`@nostrwatch/publisher`](internal/publisher/) | Nostr event publishing with adapter pattern | `alpha` | Web · Node |
| [`@nostrwatch/announce`](internal/announce/) | NIP-66 monitor announcement event generation | `alpha` | Web · Node |
| [`@nostrwatch/logger`](internal/logger/) | Structured logging wrapper | `alpha` | Web · Node |
| [`@nostrwatch/utils`](internal/utils/) | Shared utilities (keys, arrays, env detection) | `alpha` | Web · Node |
| [`@nostrwatch/controlflow`](internal/controlflow/) | BullMQ queue management and backoff control | `alpha` | Node |
| [`@nostrwatch/seed`](internal/seed/) | Relay seeding from multiple discovery sources | `alpha` | Node |
| [`@nostrwatch/redis`](internal/redis/) | BullMQ/Redis dashboard server | `alpha` | Node |
| [`@nostrwatch/kinds`](internal/kinds/) | Nostr event kind constants (placeholder) | `alpha` | — |
| ~~[`@nostrwatch/nwcache`](internal/nwcache/)~~ | ~~LMDB caching layer~~ — caching inlined into consumers | `deprecated` | — |

## Getting Started

**Prerequisites:** Node.js >= 20, pnpm >= 8, Git. Optional: Deno >= 1.4 (for trawler/relaymon), Docker (for docker-stacks).

```bash
git clone https://github.com/sandwichfarm/nostr-watch.git
cd nostr-watch
pnpm install
pnpm build
```

See the [Getting Started guide](docs/getting-started.md) for common workflows and development commands.

## Documentation

The documentation site lives in [`docs/`](docs/) and is built with [VitePress](https://vitepress.dev/).

```bash
pnpm docs:dev    # Start dev server at localhost:5173
```

- [Architecture Overview](docs/architecture.md) — Package layers, dependency direction, adapter patterns
- [Getting Started](docs/getting-started.md) — Setup, build, test, and dev workflows
- [All Packages](docs/packages/) — Full package catalog with detailed documentation

## Contributing

`@nostrwatch` is not yet open to external contributions. Contribution guidelines and issue templates are being established. Watch this repo for updates.

## License

[MIT](LICENSE) — Sandwich Farm LLC
