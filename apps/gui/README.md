# @nostrwatch/gui

SvelteKit dashboard for monitoring and exploring Nostr relays.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/gui?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/gui)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

Web-based dashboard for browsing, testing, and researching Nostr relays (WebSocket servers that store and forward events). Built with SvelteKit 2.5 and Svelte 5 with SSR disabled and a static adapter — the entire application runs in the browser. Uses IndexedDB (via Dexie) for client-side storage and connects to the nostr-watch relay network for real-time relay data aggregated from NIP-66 (relay monitoring specification) monitors.

## Prerequisites

- Node.js >=22 (Volta pins 22.15.0)
- pnpm >=8

No environment variables are required. `@nostrwatch/gui` is a client-only app — runtime configuration is available through the in-app Preferences page (cache wipe, monitor management).

## Installation

```sh
# From monorepo root
pnpm install
```

Workspace dependencies (`@nostrwatch/route66`, `@nostrwatch/nocap`, `@nostrwatch/worker-relay`, and others) are linked automatically by pnpm workspaces.

## Quick Start

```sh
# Start development server (port 5173)
pnpm --filter @nostrwatch/gui dev

# Production build
pnpm --filter @nostrwatch/gui build

# Preview built bundle
pnpm --filter @nostrwatch/gui preview
```

## Configuration

No environment variables. Runtime configuration is available through the in-app Preferences page — use it to wipe local cache, manage monitors, or adjust display settings. Vite build configuration is at `vite.config.ts` (dev) and `vite.production.js` (production builds).

## Known Limitations

- **GUI Table Configuration Separation:** Built-in config is not separated from user config in `apps/gui/src/lib/components/data-view/table/utils.ts` (line 30). User customizations cannot cleanly override or extend built-in table column configurations; there is no supported override mechanism. No workaround available at this time. See [CONCERNS.md — GUI Table Configuration Separation](../../.planning/codebase/CONCERNS.md#gui-table-configuration-separation).

- **Worker-based Computation Fallback Issues:** `dimensions-worker-manager.ts` (lines 189, 200) falls back silently to legacy stores when workers fail, with no telemetry tracking fallback frequency or performance impact. Slow or failing hardware may degrade performance without any visible indicator. See [CONCERNS.md — Worker-based Computation Fallback Issues](../../.planning/codebase/CONCERNS.md#worker-based-computation-fallback-issues).

- **GUI Store Initialization Race Conditions:** Multiple stores in `seed.ts` and `nip11s.ts` depend on StateManager initialization timing. Race conditions are possible on slow hardware or under heavy load, potentially leaving the app in an inconsistent state on startup. See [CONCERNS.md — GUI Store Initialization Race Conditions](../../.planning/codebase/CONCERNS.md#gui-store-initialization-race-conditions).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/route66`](../../libraries/route66/README.md) — relay monitoring state manager; gui uses Route66 as its primary data layer
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — low-level relay connection primitives
- [`@nostrwatch/worker-relay`](../../libraries/worker-relay/README.md) — in-browser relay worker used by gui for background processing
- [`@nostrwatch/relay-charts`](../../libraries/relay-charts/README.md) — chart adapters for relay data visualization
- [`@nostrwatch/relay-chronicle`](../../libraries/relay-chronicle/README.md) — NIP-66 relay state composition used to build timeline views
- [`@nostrwatch/utils`](../../internal/utils/README.md) — shared utilities used across the monorepo

## License

[MIT](../../LICENSE)
