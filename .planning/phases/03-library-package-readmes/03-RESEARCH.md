# Phase 03: Library Package READMEs - Research

**Researched:** 2026-03-04
**Domain:** Technical writing / monorepo documentation / adapter-pattern documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Libraries get FULL documentation per styleguide Package Type Matrix — API section is Required
- Adapter-bearing libraries (nocap, route66, kit) need dedicated "Adapter Pattern" subsection explaining: interface to implement, registration mechanism, existing adapters as examples
- nocap README is a success criterion: developer must understand adapters without reading source
- nip66 README is a success criterion: must explain protocol event kinds and data model for NIP-66 newcomers
- For each adapter-bearing library: document the adapter interface, show how to create a new adapter, list existing adapters with one-line descriptions
- Follow the pattern established in Phase 2's publisher README (adapter pattern documentation)
- Link to actual adapter source directories as reference implementations
- Same approach as Phase 2: CONCERNS.md first, then light source audit (for Known Limitations)
- CONCERNS.md has entries for: route66 (hardcoded filter limits, default relay config, incomplete RTT extraction), auditor (incomplete filter range testing)
- These MUST appear in respective READMEs
- kit, nocap-route66, sanitize, transform — need assessment during research
- If deprecated or empty: deprecation stubs; if active but unlisted in requirements: write full READMEs anyway
- Same conventions as Phase 2: TypeScript, no semicolons, single quotes, ESM imports
- Use real relay URLs (wss://relay.damus.io, wss://nos.lol)
- Libraries are published to npm — Installation section shows `pnpm add @nostrwatch/pkg` (not workspace install)
- Quick Start must produce visible output or meaningful side effect

### Claude's Discretion

- How to group the 17+ libraries across plan waves — balance by complexity
- Whether to split nocap and route66 into dedicated plans (roadmap suggests yes)
- Section depth per library — scale to API surface area
- How to handle the 4 unlisted directories (assess during research)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIB-01 | README.md for libraries/nocap following styleguide (adapter-based relay capability discovery) | Adapter interfaces fully read: AbstractAdapter, IAdapter, IAdapterConstructor, 5 adapter types (websocket, dns, geo, info, ssl), useAdapter/useAdapters registration API |
| LIB-02 | README.md for libraries/route66 following styleguide (relay aggregation + state management) | ICacheAdapter interface documented, 2 cache adapters (NostrSqliteAdapter, NostrToolsAdapter), 1 websocket adapter, StateManager, ChronicleService APIs verified |
| LIB-03 | README.md for libraries/auditor following styleguide (Nostr event validation) | Existing README exists (98 lines, wrong format), source confirms: NIP suites (01,02,11,22,42,50,65,77), Auditor class API, SuiteTest pattern |
| LIB-04 | README.md for libraries/schemata following styleguide (JSON Schema definitions) | Existing README (52 lines, wrong format), package migrating to @nostrability/schemata, wraps JSON Schema definitions for Nostr kinds |
| LIB-05 | README.md for libraries/schemata-js-ajv following styleguide (AJV validation) | Existing README (60 lines, wrong format), uses @nostrability/schemata, exports validateNip11/validateMessage/validateNote |
| LIB-06 | README.md for libraries/relay-charts following styleguide (relay metric visualization) | Existing README (419 lines, richly documented), adapter system for Chart.js/ECharts/Recharts, needs styleguide conformance |
| LIB-07 | README.md for libraries/relay-chronicle following styleguide (relay event history) | Existing README (792 lines, richly documented), needs styleguide conformance including Known Limitations and Agent Skills sections |
| LIB-08 | README.md for libraries/nostrawl following styleguide (queue-based web crawler) | Existing README (95 lines), nostrawl wraps nostr-fetch with PQueue/BullMQ adapters, needs styleguide conformance |
| LIB-09 | README.md for libraries/db following styleguide (database client abstractions) | Existing README (97 lines), SQLite-backed relay database, needs styleguide conformance |
| LIB-10 | README.md for libraries/idb following styleguide (IndexedDB wrapper) | No README, no source files — only node_modules present. Appears to be an empty stub directory |
| LIB-11 | README.md for libraries/websocket following styleguide (WebSocket connection management) | No README, full source exists: UniversalWebSocket class, cross-platform (Node/Browser/Deno), on/once/off/connect/send/close/terminate API |
| LIB-12 | README.md for libraries/nip66 following styleguide (NIP-66 relay check protocol) | No README, no source — only node_modules present. NIP-66 used extensively across codebase. Must document protocol: kinds 10166/30166/1066, event model, monitor lifecycle |
| LIB-13 | README.md for libraries/nostrings following styleguide (relay URL validation) | Existing README (110 lines, wrong format/wrong package name in examples), exports sanitize/qualify/normalize/dedup |
| LIB-14 | README.md for libraries/memory-relay following styleguide (in-memory relay) | No README, source has AbstractMemoryRelay class, svelte.ts export, used for testing |
| LIB-15 | README.md for libraries/negentropy following styleguide (NIP-49 support) | Existing README (150 lines, wrong format — uses yarn), NIP-77 not NIP-49: ClientHandler/ServerHandler sync protocol |
| LIB-16 | README.md for libraries/worker-relay following styleguide (web worker relay) | Existing README (45 lines, wrong format), WorkerRelayInterface class, sqlite-wasm, OPFS persistence, NIP-119 |
| LIB-17 | README.md for libraries/uptime-kuma-monitor following styleguide (uptime monitoring) | Existing README (67 lines, needs styleguide conformance), CLI + library API, uses nocap websocket adapter |
</phase_requirements>

---

## Summary

Phase 3 is a large writing phase covering 17+ libraries across multiple complexity tiers. The primary challenge is not technical discovery but accurate source-reading and consistent application of the Phase 1 styleguide. Every library has been source-audited: 10 already have existing READMEs in wrong formats (missing required MD043 headings, using wrong package names, using npm/yarn not pnpm, JavaScript not TypeScript), while 7 have no README at all.

The adapter-bearing libraries (nocap, route66) require the deepest effort. The nocap adapter system is fully documented from source: five adapter types (websocket, dns, geo, info, ssl), registration via `useAdapter(Adapter)` and `useAdapters([...])`, the `AbstractAdapter` base class to extend, and `static type` property as the dispatch key. route66 has two adapter dimensions: cache adapters (ICacheAdapter interface with REQ/COUNT/DELETE/DUMP/addEvent methods) and websocket adapters. The Phase 2 `internal/publisher/README.md` establishes the exact adapter documentation pattern to follow.

Four unlisted directories (kit, nocap-route66, sanitize, transform) have been assessed: kit has only an empty adapter scaffold (node_modules, no source), sanitize has only node_modules, transform has all-empty source files — these three get deprecation stubs. nocap-route66 is a lightly active package with real source (Transform class converting nocap output to NIP-66 kind 30166 events) but superseded by `libraries/nocap-route66` itself being reabsorbed into `internal/publisher` — it gets a minimal README rather than a full conforming one.

**Primary recommendation:** Follow roadmap plan groupings exactly (03-01 through 03-05), start each plan by reading the existing README (if any), reading source package.json and key source files, then write to the styleguide template. The nocap plan (03-02) requires the most depth and should reference `AbstractAdapter`, `IAdapter`, `IAdapterConstructor`, and `AdapterType` verbatim from source.

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| markdownlint-cli2 | installed (pnpm lint:docs) | README format validation | CI enforcement, MD043 section-order, MD040 language tags |
| pnpm | >=9 | Package manager | Monorepo standard; installation examples must use pnpm not npm/yarn |

### Content Sources (per library)

| Source | Trust Level | Use For |
|--------|-------------|---------|
| `libraries/*/package.json` | HIGH | Package name, version, description, runtime info |
| `libraries/*/src/index.ts` | HIGH | Public exports — what goes in API section |
| `libraries/*/src/**/*.ts` (interfaces, classes) | HIGH | Method signatures, parameter types |
| `libraries/*/adapters/` | HIGH | Existing adapter implementations as examples |
| `.planning/codebase/CONCERNS.md` | HIGH | Known Limitations — authoritative source |
| Existing README (if present) | MEDIUM | Content reference only — structure must be replaced |

### Validation Command

```sh
pnpm lint:docs
```

Runs markdownlint-cli2 against `libraries/*/README.md`. Every README must pass before plan completion.

---

## Architecture Patterns

### Required README Structure (MD043 enforced)

The markdownlint config enforces this exact heading sequence via MD043:

```
# @nostrwatch/package-name           ← H1 (any text)
[tagline optional]
[badges]
## Overview                          ← REQUIRED ANCHOR
[optional sections: Prerequisites, etc.]
## Installation                      ← REQUIRED ANCHOR
## Quick Start                       ← REQUIRED ANCHOR
[optional sections: API, Configuration, Adapter Pattern, etc.]
## Known Limitations                 ← REQUIRED ANCHOR
## Agent Skills                      ← optional, but required by styleguide for libraries
## Related Packages                  ← optional, but required by styleguide for libraries
## License                           ← REQUIRED ANCHOR
```

**Critical:** MD043 requires these 5 anchors in order: Overview, Installation, Quick Start, Known Limitations, License. All other sections are wildcards.

### Badge Pattern (published libraries)

```markdown
[![npm version](https://img.shields.io/npm/v/@nostrwatch/PACKAGE-NAME?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/PACKAGE-NAME)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
```

### Adapter Documentation Pattern (from Phase 2 publisher README)

The `internal/publisher/README.md` establishes the gold standard for adapter documentation:
1. **What the adapter does** — one sentence
2. **Base class to extend** — TypeScript class signature
3. **Interface to implement** — key methods with signatures
4. **Registration mechanism** — how to pass adapter to host class
5. **Existing adapter list** — bulleted, each with one-line description

### nocap Adapter Pattern (verified from source)

```ts
// Source: libraries/nocap/src/classes/AbstractAdapter.ts + Base.ts

import {AbstractAdapter, type IAdapter, type AdapterType} from '@nostrwatch/nocap'

export class MyDnsAdapter extends AbstractAdapter implements IAdapter {
  static type: AdapterType = 'dns'  // must be one of: 'websocket'|'dns'|'geo'|'info'|'ssl'
  readonly slug: string = 'MyDnsAdapter'

  constructor(base: Base) {
    super(base)
  }

  initialize(): void {
    // setup logic
  }

  async check_dns(): Promise<void> {
    // perform DNS check
    // call this.base.finish('dns', result) to resolve
  }
}

// Registration:
const nocap = new Nocap('wss://relay.damus.io')
await nocap.useAdapter(MyDnsAdapter)
// or multiple:
await nocap.useAdapters([MyDnsAdapter, MyWebsocketAdapter])
const result = await nocap.check('dns')
```

**Five adapter types and their required methods:**

| Type | Interface | Required Methods |
|------|-----------|-----------------|
| `websocket` | `IWebsocketAdapter` | `check_open()`, `check_read()`, `check_write()` |
| `dns` | `IDnsAdapter` | `check_dns()` |
| `info` | `IInfoAdapter` | `check_info()` |
| `ssl` | `ISslAdapter` | `check_ssl()` |
| `geo` | `IGeoAdapter` | `check_geo()` |

**Existing adapters (in `libraries/nocap/adapters/default/`):**
- `DnsAdapterDefault` — DNS lookup via Cloudflare DNS-over-HTTPS (1.1.1.1)
- `GeoAdapterDefault` — Geographic IP lookup
- `InfoAdapterDefault` — NIP-11 info document fetch
- `SslAdapterDefault` — TLS certificate validation
- `WebsocketAdapterDefault` — WebSocket open/read/write checks

### route66 Adapter Pattern (verified from source)

route66 has two adapter dimensions:

**Cache adapters** implement `ICacheAdapter`:
```ts
// Source: libraries/route66/src/core/CacheAdapter.ts
import {CacheAdapter, type ICacheAdapter} from '@nostrwatch/route66'

export class MyCacheAdapter extends CacheAdapter implements ICacheAdapter {
  readonly slug = 'MyCacheAdapter'

  async ready(): Promise<void> { /* signal readiness */ }
  async REQ(filters: any[]): Promise<IEvent[]> { /* query events */ }
  async COUNT(filters: any[]): Promise<number> { /* count events */ }
  async DELETE(filters: any[]): Promise<string[]> { /* delete events */ }
  async addEvent(event: IEvent): Promise<void> { /* insert event */ }
  async addEvents(events: IEvent[]): Promise<void> { /* batch insert */ }
  async putEvent(event: IEvent): Promise<void> { /* upsert event */ }
}
```

**Existing adapters (in `libraries/route66/adapters/`):**
- `cache/NostrSqliteAdapter` — SQLite-backed cache adapter
- `cache/NostrToolsAdapter` — nostr-tools pool-backed cache adapter
- `websocket/NostrToolsAdapter` — nostr-tools WebSocket adapter

### Deprecation Stub Pattern (for kit, sanitize, transform)

```markdown
# @nostrwatch/PACKAGE-NAME

> **DEPRECATED** — This package has been replaced by [...](...). No further updates will be made here.

## Overview

[One sentence reason for deprecation.]

## Installation

N/A — this package is deprecated.

## Quick Start

N/A — see replacement package.

## Known Limitations

This package is deprecated and receives no maintenance. See replacement.

## License

[MIT](../../LICENSE)
```

Note: deprecation stubs must still satisfy MD043 (Overview, Installation, Quick Start, Known Limitations, License). The Phase 2 nwcache README demonstrates this pattern.

---

## Unlisted Library Assessment

| Directory | Contents | Status | Action |
|-----------|----------|--------|--------|
| `libraries/kit/` | Only `adapters/kit-adapter-idb/` (empty, node_modules only), no package.json, no src | Empty scaffold | Deprecation stub — no active code |
| `libraries/nocap-route66/` | Real source: `Transform.ts`, `kinds/30166.ts`, `kinds/10166.ts`, `kinds/0.ts`. Active but superseded by `internal/publisher` | Superseded | Full README per styleguide (it has real source) |
| `libraries/sanitize/` | Only node_modules, no source files | Empty stub | Deprecation stub |
| `libraries/transform/` | Source files exist but all are empty (0 bytes). `index.ts` is empty. | Empty scaffold | Deprecation stub |

**nocap-route66 is the one exception** — it has real TypeScript source (Transform class, Kind30166/10166/0 event builders). Write a full README. Package name: `@nostrwatch/nocap-route66`, version `0.0.1`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section order validation | Custom heading checker | markdownlint-cli2 MD043 | Already configured in `.markdownlint-cli2.jsonc` |
| Badge URLs | Custom badge generator | shields.io URLs from styleguide template | Exact URLs documented in styleguide |
| Known Limitations content | Guessing from source | Read `.planning/codebase/CONCERNS.md` first | Authoritative, already sourced |
| Adapter interface documentation | Free-form prose | Read interface files (`IAdapter.ts`, `ICacheAdapter.ts`) | Exact TypeScript types go in docs |
| Existing README content | Rewrite from scratch | Use existing content where accurate, restructure | Several libraries have good API docs already |

---

## Common Pitfalls

### Pitfall 1: Wrong Package Name in Installation Examples

**What goes wrong:** Existing nostrings README shows `npm install @nostrwatch/relay-sanitizer` (old package name). The actual published name is `@nostrwatch/nostrings`.
**Why it happens:** Package was renamed but README not updated.
**How to avoid:** Always verify package name from `package.json` `name` field, not from existing README.
**Warning signs:** Installation command uses different name than the H1 heading.

### Pitfall 2: Missing MD043 Required Anchors

**What goes wrong:** README passes visual inspection but fails `pnpm lint:docs` because heading text doesn't exactly match `## Known Limitations` (e.g., `## Limitations` or `## Caveats`).
**Why it happens:** MD043 is case-insensitive (`match_case: false`) but requires exact text match otherwise.
**How to avoid:** Use exact heading text: `## Overview`, `## Installation`, `## Quick Start`, `## Known Limitations`, `## License`. Run `pnpm lint:docs` after writing each README.
**Warning signs:** CI fails on heading check despite README looking correct.

### Pitfall 3: Deprecation Stubs Skipping Required Headings

**What goes wrong:** Deprecation stub omits Quick Start, Installation, or Known Limitations because "they're not applicable for deprecated packages."
**Why it happens:** Styleguide says stubs are minimal, but MD043 still applies.
**How to avoid:** Include all 5 MD043 anchors even in stubs — stub them with "N/A — see replacement" content. Phase 2 nwcache README demonstrates this.
**Warning signs:** `pnpm lint:docs` fails with MD043 on stub files.

### Pitfall 4: Code Examples Using Wrong Conventions

**What goes wrong:** Examples use `const x = 1;` (semicolons) or `require()` or `"double quotes"`.
**Why it happens:** Reflex from other codebases.
**How to avoid:** No semicolons, single quotes, ESM imports (`import {X} from 'pkg'`), TypeScript (`ts` language tag). Check against styleguide Code Example Guidelines.
**Warning signs:** Linter would catch some; visual review catches rest.

### Pitfall 5: nip66 Library Has No Source

**What goes wrong:** The `libraries/nip66/` directory contains only `node_modules` — there is no TypeScript source, no package.json at the library level. LIB-12 requires a README for this directory.
**Why it happens:** The directory may have been created as a placeholder; actual NIP-66 protocol types are embedded in other libraries.
**How to avoid:** Write nip66 README as a protocol documentation library — its purpose is to be a reference for what NIP-66 events look like, sourcing from the NIP spec and from the kinds used in `internal/publisher` and `libraries/nocap-route66`. The README is protocol documentation, not API documentation.
**Warning signs:** Attempting to document a TypeScript API that doesn't exist.

### Pitfall 6: idb Library Has No Source

**What goes wrong:** `libraries/idb/` contains only `node_modules` — no source, no package.json.
**Why it happens:** Empty placeholder directory.
**How to avoid:** Write a deprecation stub. LIB-10 requires a README — a minimal stub satisfies the requirement.

### Pitfall 7: negentropy README Says NIP-49, Not NIP-77

**What goes wrong:** REQUIREMENTS.md says negentropy is "NIP-49 support" but the actual package implements NIP-77 (Negentropy Syncing) via ClientHandler/ServerHandler pattern.
**Why it happens:** Mislabel in requirements.
**How to avoid:** Describe the actual package behavior (NIP-77 Negentropy set reconciliation), note the requirements label discrepancy in the README's Overview without making it confusing.
**Warning signs:** Research says NIP-49 is a different spec (key encryption) — not what this library does.

### Pitfall 8: Existing READMEs With Wrong Content

**What goes wrong:** Existing READMEs (relay-chronicle 792 lines, relay-charts 419 lines) have rich content but wrong structure — they lack all MD043 required sections, use emoji-heavy feature lists, and wrong install commands.
**Why it happens:** Organically written before styleguide existed.
**How to avoid:** Treat them as content drafts. Extract the accurate technical content, rewrite the structure to conform to MD043 + styleguide. Do not copy format, only copy accurate technical content.
**Warning signs:** Running `pnpm lint:docs` before writing new README shows existing failures.

---

## Code Examples

### nocap Quick Start

```ts
// Source: libraries/nocap/src/classes/Base.ts + adapters/default/

import Nocap from '@nostrwatch/nocap'
import {WebsocketAdapterDefault} from '@nostrwatch/nocap/adapters/default'
import {DnsAdapterDefault} from '@nostrwatch/nocap/adapters/default'

const nocap = new Nocap('wss://relay.damus.io')
await nocap.useAdapters([WebsocketAdapterDefault, DnsAdapterDefault])

const result = await nocap.check(['open', 'read', 'dns'])
console.log(result)
// { url: 'wss://relay.damus.io', open: { status: 'success', duration: 120 }, ... }
```

### nocap Custom Adapter

```ts
// Source: libraries/nocap/src/classes/AbstractAdapter.ts

import {AbstractAdapter, type IAdapter, type AdapterType} from '@nostrwatch/nocap'

export class MyDnsAdapter extends AbstractAdapter implements IAdapter {
  static type: AdapterType = 'dns'
  readonly slug: string = 'MyDnsAdapter'

  constructor(base: any) {
    super(base)
  }

  initialize(): void {}

  async check_dns(): Promise<void> {
    const result = { data: { ipv4: ['1.2.3.4'] }, duration: 50, status: 'success' }
    this.base.finish('dns', result)
  }
}
```

### route66 Quick Start

```ts
// Source: libraries/route66/src/index.ts + managers/StateManager.ts

import {Route66} from '@nostrwatch/route66'
import {NostrSqliteAdapter} from '@nostrwatch/route66-adapter-sqlite'

const r66 = new Route66()
await r66.useAdapters({cache: NostrSqliteAdapter})
await r66.init()

const relays = await r66.cache.getRelays({network: 'clearnet'})
```

### auditor Quick Start

```ts
// Source: libraries/auditor/src/base/Auditor.ts

import {Auditor} from '@nostrwatch/auditor'

const auditor = new Auditor({nips: new Set(['Nip01', 'Nip11'])})
await auditor.detectSupportedNips('wss://relay.damus.io')
const result = await auditor.test('wss://relay.damus.io')
console.log(result)
// { relay: 'wss://relay.damus.io', pass: true, passrate: 0.875, ... }
```

### websocket Quick Start

```ts
// Source: libraries/websocket/src/index.ts

import {UniversalWebSocket} from '@nostrwatch/websocket'

const ws = new UniversalWebSocket('wss://relay.damus.io')
ws.on('open', () => console.log('connected'))
ws.on('message', (ev) => console.log('received:', ev.data))
await ws.connect()
ws.send(JSON.stringify(['REQ', 'sub1', {kinds: [1], limit: 1}]))
```

---

## Library Inventory: Status and Writing Strategy

### Group 1 — Protocol/Validation Layer (Plan 03-01)

| Library | npm Package | Existing README | Strategy |
|---------|-------------|-----------------|----------|
| nostrings | `@nostrwatch/nostrings` 0.3.0 | 110 lines (wrong name, npm) | Rewrite structure, preserve API content |
| nip66 | No package (dir empty) | None | Protocol documentation — kinds 10166/30166/1066, tags, event model |
| schemata | `@nostrwatch/schemata` 0.1.0 | 52 lines (wrong format) | Rewrite, note migration to @nostrability/schemata |
| schemata-js-ajv | `@nostrwatch/schemata-js-ajv` 1.0.1 | 60 lines (wrong format) | Rewrite structure, preserve API content |
| auditor | `@nostrwatch/auditor` 0.0.1 | 98 lines (wrong format) | Rewrite, preserve suite test pattern, add Known Limitations for filter range TODO |

### Group 2 — nocap (Plan 03-02)

| Library | npm Package | Existing README | Strategy |
|---------|-------------|-----------------|----------|
| nocap | `@nostrwatch/nocap` 0.9.1 | None | Full write — gold standard adapter docs, 5 adapters, useAdapter/useAdapters API |

### Group 3 — route66 (Plan 03-03)

| Library | npm Package | Existing README | Strategy |
|---------|-------------|-----------------|----------|
| route66 | `@nostrwatch/route66` 0.0.1 | None | Full write — cache adapter pattern, StateManager, ChronicleService, Known Limitations (3 CONCERNS entries) |

### Group 4 — Infrastructure Layer (Plan 03-04)

| Library | npm Package | Existing README | Strategy |
|---------|-------------|-----------------|----------|
| db | `@nostrwatch/db` 0.1.0 | 97 lines (wrong format) | Rewrite structure, preserve API content |
| idb | no package.json (empty dir) | None | Deprecation stub |
| websocket | `@nostrwatch/websocket` | None | Full write — UniversalWebSocket class, cross-platform, large API surface |
| memory-relay | `@nostrwatch/memory-relay` 1.3.0 | None | Full write — AbstractMemoryRelay, Svelte integration, testing use case |
| worker-relay | `@nostrwatch/worker-relay` 1.3.0 | 45 lines (wrong format) | Rewrite — WorkerRelayInterface, sqlite-wasm, OPFS |
| negentropy | `@nostrwatch/negentropy-utils` | 150 lines (wrong format, yarn) | Rewrite — NIP-77 ClientHandler/ServerHandler, correct pnpm |

### Group 5 — Application Utilities (Plan 03-05)

| Library | npm Package | Existing README | Strategy |
|---------|-------------|-----------------|----------|
| nostrawl | `nostrawl` 0.1.9 | 95 lines (partial) | Rewrite structure, preserve adapter content (PQueue/BullMQ) |
| relay-charts | `@nostrwatch/relay-charts` 0.1.0 | 419 lines (rich but wrong) | Restructure to styleguide, extract accurate content, add Known Limitations |
| relay-chronicle | `@nostrwatch/relay-chronicle` 1.0.0 | 792 lines (rich but wrong) | Restructure to styleguide, extract accurate content, add Known Limitations |
| uptime-kuma-monitor | `@nostrwatch/kuma` 0.1.0 | 67 lines (partial) | Rewrite structure, preserve CLI and library API |

### Unlisted Libraries (add to appropriate plan or standalone)

| Library | Strategy | Rationale |
|---------|----------|-----------|
| kit | Deprecation stub | No source files, only empty adapter scaffold |
| nocap-route66 | Full README (add to plan 03-02 or 03-05) | Real source: Transform class, Kind30166/10166 builders |
| sanitize | Deprecation stub | Only node_modules |
| transform | Deprecation stub | Source files exist but all empty (0 bytes) |

---

## NIP-66 Protocol Reference (for LIB-12)

The `libraries/nip66/` directory has no source — its README must document the NIP-66 protocol itself. Source the following from the codebase's implementation in `internal/publisher/src/kinds/` and `libraries/nocap-route66/`:

### Event Kinds

| Kind | Type | Purpose | Address |
|------|------|---------|---------|
| 10166 | Replaceable | Monitor announcement — declares a monitor exists, its capabilities, and relays | `d` tag = monitor pubkey |
| 30166 | Parameterized replaceable | Relay status — one event per relay, updated on each check | `d` tag = relay URL |
| 1066 | Regular | Relay status delta — append-only history log for `relay-chronicle` | No `d` tag |

### Key Tags in Kind 30166

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `d` | `wss://relay.damus.io` | Relay URL (addressable identifier) |
| `r` | `wss://relay.damus.io` | Relay URL (queryable) |
| `n` | `clearnet` | Network type (clearnet/tor/i2p) |
| `R` | `open` | Check key indicating relay is open |
| `rtt-open` | `120` | Round-trip time for open check in ms |
| `nip11` | `{"supported_nips":[1,11]}` | NIP-11 info document JSON |
| `l` | `wss` | Protocol |
| `ssl` | `valid` | SSL validity |
| `dns` | `1.2.3.4` | Resolved IP |

### Key Tags in Kind 10166

| Tag | Value Example | Meaning |
|-----|---------------|---------|
| `frequency` | `3600` | Check interval in seconds |
| `n` | `clearnet` | Networks monitored |
| `checks` | `open,read,write,ssl,dns` | Checks performed |
| `timeout` | `open:5000` | Per-check timeout |
| `g` | `u4pruyd` | Monitor geohash |

---

## Known Limitations (CONCERNS.md Mapping)

| Package | CONCERNS.md Entry | README Section Text |
|---------|-------------------|---------------------|
| route66 | Hardcoded Filter Limits | "MAX_FILTERS hardcoded at 10 in MonitorService regardless of relay NIP-11..." |
| route66 | Default Relay Configuration | "Default relay URLs set in RelayService constructor, not loaded from config..." |
| route66 | Incomplete RTT Extraction | "RTT values not extracted from chronicle period metadata..." |
| auditor | Incomplete Filter Range Testing | "Filter range ambiguity resolution (TODO) in FilterRange.ts..." |
| publisher (INT) | Already documented in Phase 2 | n/a |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `apps/nocapd` (legacy daemon) | `apps/relaymon` | Before Phase 3 | nocap README should reference relaymon not nocapd |
| `@nostrwatch/relay-sanitizer` (old npm name) | `@nostrwatch/nostrings` | Before Phase 3 | nostrings README must use new package name |
| `@nostrwatch/schemata` (monorepo) | `@nostrability/schemata` (separate org) | In progress | schemata README must note migration |
| yarn install instructions | pnpm add | Throughout | All existing READMEs using yarn need correction |
| JavaScript examples | TypeScript examples | Styleguide established Phase 1 | All Quick Start examples must use TypeScript |

**Deprecated/outdated content to remove from existing READMEs:**
- negentropy README uses `yarn add` — replace with `pnpm add`
- nostrings README uses `@nostrwatch/relay-sanitizer` (old name) — correct to `@nostrwatch/nostrings`
- relay-chronicle/relay-charts READMEs use emoji bullet points — remove per styleguide tone guidelines
- auditor README begins with `> alpha af` — remove per styleguide tone guidelines
- worker-relay README begins with `##` not `#` — violates MD001

---

## Open Questions

1. **nip66 library: what is its intended scope?**
   - What we know: Directory exists as a requirement target (LIB-12), has only node_modules (likely was once a package installed from npm), NIP-66 implementation lives in `internal/publisher` and `libraries/nocap-route66`
   - What's unclear: Is this meant to be a stub that redirects to the spec + publisher? Or was it a placeholder for a dedicated NIP-66 types package?
   - Recommendation: Write it as protocol documentation — explain NIP-66 event kinds, the data model, and point to `internal/publisher` and `libraries/nocap-route66` as implementations. This satisfies the success criterion ("NIP-66 library README explains event kinds and data model clearly").

2. **nocap-route66: which plan should it appear in?**
   - What we know: Has real source, active but superseded by `internal/publisher`. Package name `@nostrwatch/nocap-route66`.
   - What's unclear: Should it get a deprecation stub (it IS superseded) or a full README (it HAS active source)?
   - Recommendation: Write a full README but note it is "superseded by @nostrwatch/publisher for new projects" in the Known Limitations section. This avoids treating active code as deprecated.

3. **idb library: is it truly empty?**
   - What we know: Directory contains only node_modules, no package.json, no source
   - What's unclear: Was it a placeholder for an IndexedDB wrapper that was never implemented, or was source removed?
   - Recommendation: Deprecation stub with note "this package was not implemented; use the browser's native IndexedDB API directly or the `@nostrwatch/route66` cache adapter layer."

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `libraries/nocap/src/classes/AbstractAdapter.ts` — adapter base class
- Direct source read: `libraries/nocap/src/classes/Base.ts` — useAdapter/useAdapters API, adapter type routing
- Direct source read: `libraries/nocap/src/interfaces/IAdapter.ts`, `IDnsAdapter.ts`, `IWebsocketAdapter.ts` — interface contracts
- Direct source read: `libraries/nocap/adapters/default/DnsAdapterDefault/src/index.ts` — concrete adapter example
- Direct source read: `libraries/route66/src/core/CacheAdapter.ts` — ICacheAdapter interface
- Direct source read: `libraries/route66/src/index.ts` — public exports
- Direct source read: `libraries/route66/src/managers/StateManager.ts` — StateManager API
- Direct source read: `libraries/websocket/src/index.ts` — complete UniversalWebSocket implementation
- Direct source read: `libraries/memory-relay/src/abstract.ts` — AbstractMemoryRelay class
- Direct source read: `libraries/auditor/src/base/Auditor.ts` — Auditor class
- Direct source read: `internal/publisher/README.md` — Phase 2 adapter documentation pattern (gold standard)
- Direct source read: `docs/styleguide/README.md` — complete styleguide
- Direct source read: `.markdownlint-cli2.jsonc` — MD043 exact heading requirements
- Direct source read: `.planning/codebase/CONCERNS.md` — Known Limitations content
- Direct source read: All `libraries/*/package.json` files — package names, versions

### Secondary (MEDIUM confidence)

- Existing library READMEs (auditor, schemata, nostrings, relay-chronicle, relay-charts, nostrawl, etc.) — content reference, not structure reference

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified from project files, styleguide read directly
- Architecture patterns: HIGH — adapter interfaces read from source, MD043 config verified, Phase 2 pattern established
- Pitfalls: HIGH — sourced from actual discrepancies found in existing READMEs and empty directories
- Library status: HIGH — direct filesystem audit of all 21 library directories

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable documentation phase; source code changes slowly)
