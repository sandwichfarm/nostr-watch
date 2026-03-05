# Phase 2: Internal Package READMEs - Research

**Researched:** 2026-03-04
**Domain:** Technical documentation writing — internal monorepo packages
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Content depth**
- API sections: document key exports only (3-5 most important per package), link to source for the rest
- Internal packages have lighter documentation requirements per the styleguide Package Type Matrix
- Packages with rich exports (utils ~15 modules, publisher with adapter pattern) get more thorough API coverage
- Packages with minimal exports get proportionally shorter API sections

**Deprecation and minimal package handling**
- `nwcache` gets a deprecation stub per the styleguide (explicitly noted as deprecated, no replacement — functionality was inlined)
- `kinds` and `redis` — if source directory is empty or has no meaningful exports, write a minimal README (overview + installation + license) rather than a deprecation stub, since they're still workspace packages
- All other packages (utils, logger, publisher, announce, controlflow, seed) get full READMEs with all required sections

**Known Limitations sourcing**
- Surface limitations already documented in `.planning/codebase/CONCERNS.md` first
- Light audit of each package source for TODOs, @ts-nocheck, console.log patterns — document notable findings
- For packages with no CONCERNS.md entries and no source issues: "No known limitations at this time."
- publisher has a known concern (unfinished language tag validation in Kind30166.ts) — must appear in its Known Limitations

**Code examples**
- Quick Start examples should reflect real usage patterns from the monorepo — pull actual import patterns from consuming packages
- Show how the package is really used (e.g., how relaymon uses logger, how publisher is used in announce)
- Follow styleguide code conventions: no semicolons, single quotes, ESM imports, TypeScript preferred
- Use real relay URLs where relevant (wss://relay.damus.io, wss://nos.lol)

### Claude's Discretion
- Exact section length and detail per package — scale to complexity
- Whether to include Optional sections (Quick Start, Configuration) for simpler packages
- How to handle packages without package.json description (kinds, redis, nwcache) — infer from source
- Ordering of packages within plan waves — group by complexity or dependency

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | README.md for internal/utils following styleguide (shared utility functions) | Package source audited: 15 modules, key exports identified — keys, signing, network, array, string, url, time, env, redis, rng |
| INT-02 | README.md for internal/publisher following styleguide (event publishing with adapters) | Publisher.ts + 4 Kind classes audited; adapter pattern via nostr-tools SimplePool documented |
| INT-03 | README.md for internal/logger following styleguide (structured logging) | Logger class fully audited; Winston + debug dual-backend pattern documented |
| INT-04 | README.md for internal/announce following styleguide (announcement system) | AnnounceMonitor class fully audited; 3-event NIP-66/65/01 flow documented |
| INT-05 | README.md for internal/nwcache following styleguide (caching layer) | Confirmed deprecated (LMDB-based, inlined); deprecation stub template ready |
| INT-06 | README.md for internal/redis following styleguide (Redis integration) | Confirmed minimal app (BullMQ dashboard, no exportable API); minimal README confirmed |
| INT-07 | README.md for internal/controlflow following styleguide (control flow utilities) | retry.ts (RetryManager) + queues.ts (TrawlQueue/NocapdQueue/PersistQueue/QueueInit) audited |
| INT-08 | README.md for internal/kinds following styleguide (Nostr event kind registry) | Confirmed empty src/ — only rollup/tsconfig; minimal README confirmed |
| INT-09 | README.md for internal/seed following styleguide (seed data management) | RelaySeeder class audited; 6 seed sources documented |
</phase_requirements>

---

## Summary

This phase produces nine README.md files — one for each package in `internal/`. All nine must conform to the styleguide in `docs/styleguide/README.md`, pass `markdownlint-cli2` CI linting under the `.markdownlint-cli2.jsonc` ruleset, and render correctly as VitePress routes under `/internal/{package-name}/`.

The packages vary significantly in complexity. Six packages (`utils`, `logger`, `publisher`, `announce`, `controlflow`, `seed`) have real source code and get full READMEs. Two packages (`kinds`, `redis`) are effectively stubs — `kinds` has no `src/` directory, and `redis` is a minimal operational script (BullMQ dashboard), not a library. Both get minimal READMEs (overview + installation + license only). One package (`nwcache`) is deprecated and gets a deprecation stub per the styleguide template.

The linting ruleset enforces MD043 with required headings: `## Overview`, `## Installation`, `## Quick Start`, `## Known Limitations`, `## License` in that order — with wildcards allowing optional sections between them. Minimal and deprecation-stub READMEs must still contain `## Overview`, `## Installation`, `## Known Limitations`, and `## License` to pass MD043. The deprecation stub variant does NOT include Quick Start.

**Primary recommendation:** Read source before writing. Every claim in a README must be verified against the actual source code found in this research — do not infer behaviour from package names alone.

---

## Standard Stack

### Core (already established in Phase 1)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| markdownlint-cli2 | `^0.17.1` | Lint README files in CI | Already installed in devDependencies; config at `.markdownlint-cli2.jsonc` |
| VitePress | `1.6.4` | Render docs site | Chosen in Phase 1 over alternatives; sidebar auto-generates from disk scan |

### No new tooling required

Phase 2 is pure content writing. No new libraries, build tools, or configuration is needed. The linting and site infrastructure from Phase 1 is already in place.

**Lint command (already configured):**

```sh
pnpm lint:docs
```

**VitePress dev preview (already configured):**

```sh
pnpm docs:dev
```

---

## Architecture Patterns

### Pattern 1: Full README Structure (six packages)

Used for: `utils`, `logger`, `publisher`, `announce`, `controlflow`, `seed`

Required section order enforced by MD043:

```
# @nostrwatch/{name}

{tagline}

[![Scope](...)] [![License](...)] [![Status](...)]

## Overview
## Prerequisites        ← optional for internal packages
## Installation
## Quick Start          ← required by MD043
## API
## Configuration        ← optional; include if package has env vars or config options
## Known Limitations    ← required by MD043
## Agent Skills
## Related Packages
## License              ← required by MD043
```

### Pattern 2: Minimal README Structure (two packages)

Used for: `kinds`, `redis`

These packages have no meaningful exportable API. The minimal structure still must satisfy MD043:

```
# @nostrwatch/{name}

{tagline}

[![Scope](...)] [![License](...)] [![Status](...)]

## Overview
## Installation
## Quick Start    ← required by MD043; use a one-line note if no runnable example exists
## Known Limitations
## License
```

### Pattern 3: Deprecation Stub (one package)

Used for: `nwcache`

Per `docs/styleguide/README.md` — deprecation stub template:

```
# @nostrwatch/nwcache

> **DEPRECATED** — This package is no longer maintained. Functionality was inlined into consuming packages. No replacement package is available.

## Why deprecated

## License
```

**Critical:** Deprecation stubs do NOT include the standard badge row. They do NOT have `## Overview`, `## Installation`, or `## Quick Start`. They skip MD043 by not matching the required glob scope — however, `internal/nwcache/README.md` IS in scope (`internal/*/README.md`). Verify whether the MD043 rule will fail on a stub. The `.markdownlint-cli2.jsonc` MD043 list requires `## Overview`, `## Installation`, `## Quick Start`, `## Known Limitations`, `## License` — the stub does not have these. This is a known tension.

**Resolution:** The styleguide stub template omits the required sections but the linting config enforces MD043 on `internal/*/README.md`. Possible solutions (in priority order):
1. Add `internal/nwcache/README.md` to the `ignores` list in `.markdownlint-cli2.jsonc` for deprecated packages
2. Or: write the nwcache stub with all required anchors but heavily reduced content under each

The planner must choose option 1 or 2. Recommend option 1 (add to ignores) — it is cleaner and matches the styleguide intent that deprecated packages are exempt from the full format.

### Badge Pattern for Internal Packages

All non-deprecated internal package READMEs use the scope badge (not npm badge):

```markdown
[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
```

Runtime badge is optional for internal packages. Include when the package has runtime constraints (e.g., logger has browser shims).

### VitePress Route Pattern

Each README at `internal/{pkg}/README.md` renders as `/internal/{pkg}/` in the VitePress site. The sidebar in `docs/.vitepress/config.ts` is built from a disk scan and will automatically pick up new READMEs. No sidebar config changes required for Phase 2.

### Anti-Patterns to Avoid

- **Writing fabricated API docs**: Only document what source code confirms. Several packages have `any` types throughout — document the actual parameter names even if the types are broad.
- **Skipping the lint check**: Every README must pass `pnpm lint:docs` before being considered done. Run it after writing each README.
- **Using bare ``` code fences**: MD040 rejects fenced blocks without a language tag. Always use `ts`, `sh`, `json`, etc.
- **Using semicolons or double quotes in code examples**: The `.prettierrc.yaml` convention (no semicolons, single quotes) applies to all code examples per the styleguide.
- **Using relative imports in examples**: Always show `import {X} from '@nostrwatch/pkg'` — never relative paths.

---

## Package-by-Package Findings

### internal/utils

**Name:** `@nostrwatch/utils`
**Description:** No package.json description — infer: "Shared utility functions for the nostr-watch monorepo"
**Source:** `internal/utils/src/` — 15 modules exported via `index.ts`

**Exported modules and key functions:**

| Module | Key Exports | Notes |
|--------|-------------|-------|
| `array.ts` | `shuffleArray<T>`, `chunkArray<T>` | Generic array operations; shuffleArray mutates in-place |
| `browser.ts` | (TBD — source not read) | Likely browser environment detection |
| `class.ts` | (TBD) | Class utilities |
| `config.ts` | `loadConfig` | Config loader used by seed package |
| `controlflow.ts` | `delay` | Used by GUI and relaymon |
| `env.ts` | `readEnvVars`, `getEnvValue`, `setEnvValue` | Reads/writes .env file |
| `keys.ts` | `nsecToBytes`, `nsecToHex`, `tryNsecToHex` | Nostr key conversion (nsec1 bech32 ↔ hex ↔ Uint8Array) |
| `logger.ts` | (re-exports from logger pkg or local?) | Check source |
| `network.ts` | `parseRelayNetwork`, `relaysSerializedByNetwork` | Detects tor/i2p/cjdns/clearnet from relay URL |
| `object.ts` | (TBD) | Object utilities |
| `redis.ts` | `RedisConnectionDetails` | Reads REDIS_* env vars into connection config |
| `rng.ts` | (TBD) | Random number generation |
| `signing.ts` | `createSigner`, `EventSigner` interface | Creates signing context from nsec or hex key |
| `string.ts` | `capitalize` | String utilities |
| `time.ts` | `now`, `nowstr`, `msToCronTime` | Timestamp and cron helpers |
| `url.ts` | `parseUrl`, `normalizeUrl` | URL parsing with null-safety |

**Key consumer imports (verified):**
```
delay — apps/gui, apps/relaymon
parseRelayNetwork — internal/seed, apps/relaymon (Deno, npm:)
RedisConnectionDetails — internal/controlflow
capitalize — internal/controlflow
tryNsecToHex — apps/relaymon
loadConfig — internal/seed
```

**Recommended API section organization:** Group by category — Key Operations, Cryptography & Signing, Network, Time & Scheduling, Data Utilities.

**Known Limitations:** No CONCERNS.md entries. No @ts-nocheck found in source. No console.log found. Known: browser shims exist (shims/ directory) suggesting some modules have runtime constraints. No known limitations to document.

---

### internal/logger

**Name:** `@nostrwatch/logger`
**Description:** "A logging wrapper"
**Source:** `internal/logger/src/logger.ts`

**Exported API:**
- Default export: `Logger` class
- Constructor: `Logger(name: string, log_level?: string, split_logs?: boolean)`
- Methods: `fatal(msg)`, `error(msg)`, `err(msg)`, `warn(msg)`, `info(msg)`, `debug(msg)`
- Custom levels: fatal(0), error/err(1), warn(2), info(3), debug(4)

**Runtime behavior:**
- **Node.js**: Uses Winston with colorized console transport + `debug` package for namespace filtering
- **Browser**: Falls back to `console` (no Winston available)
- Browser detection: `typeof window === 'undefined'`
- Winston loaded dynamically via `createRequire` — graceful fallback if not installed

**Real usage pattern (from announce/publisher):**
```ts
import Logger from '@nostrwatch/logger'
const log = new Logger('@nostrwatch/announce')
log.debug(`announce::constructor(): ${pubkey}`)
log.info(`publishing ${kind} to ${relays.join(',')}`)
```

**Known Limitations:** No CONCERNS.md entries. However, CONCERNS.md documents console.log in `internal/announce` and `internal/publisher` — the Logger itself has no console.log issues. No known limitations for logger itself.

---

### internal/publisher

**Name:** `@nostrwatch/publisher`
**Description:** "Library for publishing nostr.watch relay status and publisher registration events"
**Source:** `internal/publisher/src/`

**Exported API:**
- `Publisher` class — core publishing engine using `nostr-tools` SimplePool
- `Event` class — base event builder
- `Kind0` — profile event builder (kind 0)
- `Kind10002` — relay list event builder (NIP-65, kind 10002)
- `Kind10166` — monitor registration event builder (NIP-66, kind 10166)
- `Kind30166` — relay check result event builder (NIP-66, kind 30166)
- `buildBaseEvent`, `relayTag`, `statusTag`, `rttOpenTag` — helper functions
- `BaseEventOptions` type

**Publisher class API:**
```ts
class Publisher {
  constructor(pubkey: string, relays: string[], config?: Config)
  async publishEvent(signedEvent: any): Promise<any>
  async publishEvents(signedEvents: AsyncIterable<any>): Promise<any[]>
}
```

**Adapter pattern clarification:** The CONTEXT.md mentions "adapter pattern in publisher: base publisher + adapters/NostrTools/". Source inspection shows there is no `adapters/` directory in `internal/publisher/src/` — the adapter pattern is implemented directly in `Publisher.ts` using `nostr-tools`' `SimplePool`. The Kind classes act as event-type-specific builders (the "adapter" aspect). Document accurately.

**Known Limitations (REQUIRED per CONTEXT.md):**
- **Unfinished language tag validation:** Language tag validation in `Kind30166.ts` line 156 is marked TODO. Invalid ISO-639-1 language tags may be published in NIP-66 kind 30166 events without transformation or rejection. No workaround available. See `.planning/codebase/CONCERNS.md` — Unfinished Language Tag Validation.
- **console.log in production code:** `Publisher.publishEvent` has `console.log('err', err)` in the error path. This produces unstructured log output. Use a configured logger instead. See `.planning/codebase/CONCERNS.md` — Console.log Statements in Production Code.

---

### internal/announce

**Name:** `@nostrwatch/announce`
**Description:** "Generates a NIP-66 10166 event, NIP-65 10002 event and NIP-01 0 events for monitors on every boot."
**Source:** `internal/announce/src/index.ts`

**Exported API:**
- `AnnounceMonitor` class

```ts
class AnnounceMonitor {
  constructor(pubkey: string, options: AnnounceMonitorOptions)
  setup(options: AnnounceMonitorOptions): void
  generate(): Record<string, Event>
  async sign(sk: string): Promise<void>
  async publish(): Promise<string[]>
  static formatChecks(checks: string[]): string[]
  static verify(ev: any): boolean
}
```

**AnnounceMonitorOptions:**
```ts
interface AnnounceMonitorOptions {
  relays: string[]           // required; must not be empty
  geo?: object
  kinds?: number[]
  timeouts?: object
  networks?: string[]
  checks?: string[]          // 'all' expands to full check list
  owner?: string
  frequency?: string
  profile?: object
  clientTag?: string
  userDataRelays?: string[]  // defaults: ['wss://purplepag.es', 'wss://user.kindpag.es']
}
```

**Flow:** `generate()` → `sign(sk)` → `publish()`. All three steps required in sequence.

**Checks expansion:** `'all'` → `['websocket', 'ws', 'info', 'dns', 'geo', 'ssl']`

**Publishes to:**
- Kind 10166 → `relays` (monitor registration relays)
- Kind 10002 + Kind 0 → `userDataRelays` (user profile relays)

**Known Limitations:**
- **console.log in production code:** `AnnounceMonitor.setup` and `AnnounceMonitor.publish` contain unconditional `console.log` calls. These produce unstructured output in production. No workaround available; tracked in `.planning/codebase/CONCERNS.md` — Console.log Statements in Production Code.

---

### internal/nwcache

**Name:** `@nostrwatch/nwcache`
**Description:** No package.json description — infer from source: LMDB-based relay data caching layer
**Source:** No `src/` directory. Package ships pre-built JS (`index.js`, `index.d.ts`) using `lmdb`, `lmdb-oql`, `lmdb-index`.

**Status:** DEPRECATED. Functionality was inlined into consuming packages. No replacement package.

**Write:** Deprecation stub only (no badge row, no API docs).

**Known Limitations section in stub:** Not required for deprecation stubs per the styleguide. However, to satisfy MD043 linting (which targets `internal/*/README.md`), the stub must either be excluded from linting or include all required anchors. See Architecture Patterns → Pattern 3 above.

---

### internal/redis

**Name:** `@nostrwatch/redis`
**Description:** No package.json description — infer: "BullMQ queue dashboard for nostr-watch monitor queues"
**Source:** No `src/` directory. Single file: `index.js` — a Fastify application that mounts Bull Board UI.

**What it actually is:** An operational runnable (a dashboard app), NOT a library. It exports nothing. It reads `REGIONS` env var to mount BullMQ queue adapters for `nocapd/{region}` queues and serves them at `http://0.0.0.0:3030/f`.

**README approach:** Minimal README (overview + installation note + Known Limitations + License). The "Installation" and "Quick Start" sections explain how to run it (`pnpm run launch`), not how to import it.

**Note:** The `## Quick Start` section required by MD043 can document `pnpm run launch` (the `scripts.launch` entry in package.json) as a valid example.

**Known Limitations:** No CONCERNS.md entries. No known limitations.

---

### internal/controlflow

**Name:** `@nostrwatch/controlflow`
**Description:** "Provides exports for application control flow"
**Source:** `internal/controlflow/src/index.ts` exports from `retry.js` and `queues.js`

**Exported API:**

From `queues.ts`:
```ts
TrawlQueue(qopts?: Partial<QueueOptions>): QueueBundle
NocapdQueue(name?: string, qopts?: Partial<QueueOptions>): QueueBundle
PersistQueue(name?: string, qopts?: Partial<QueueOptions>): QueueBundle
QueueInit(key: string, qopts?: Partial<QueueOptions>): QueueBundle
BullMQ: { Queue, QueueEvents, Worker }  // re-exported from bullmq
```

`QueueBundle = { $Queue: Queue, $QueueEvents: QueueEvents, Worker: typeof Worker }`

From `retry.ts`:
```ts
class RetryManager {
  constructor(caller: string, config?: any, rcache?: RelayCache)
  cacheId(url: string): string
  expiry(retries: number | null): number
  getRetries(url: string): Promise<number | null>
  getExpiry(url: string): Promise<number>
  async setRetries(url: string, success: boolean): Promise<string | null>
}
```

**Dependencies:** BullMQ for queue management, `@nostrwatch/nwcache` for retry cache storage (via `@nostrwatch/utils` `RedisConnectionDetails` for Redis connection), dotenv for env loading.

**Note:** `RetryManager` depends on `nwcache` (deprecated) via its `rcache` parameter. The dependency is interface-based (`RelayCache`), so a different cache implementation could be injected. Document this.

**Known Limitations:** No direct CONCERNS.md entries. RetryManager uses `eval()` to evaluate delay strings from config (line ~37 in retry.ts): `parseInt(eval(entry.delay))`. This is a security concern if config comes from untrusted input. Worth noting.

---

### internal/kinds

**Name:** `@nostrwatch/kinds`
**Description:** No package.json, no src/ directory. Only `rollup.config.json` and `tsconfig.json` present.

**What it is:** An empty stub workspace package with build tooling but no source. No exports. Package.json does not exist — cannot confirm package name. The rollup/tsconfig files suggest it was intended as a Nostr event kind registry but was never implemented.

**README approach:** Minimal README. Overview explains the package exists as a workspace placeholder for a planned kind registry. Installation shows workspace dependency syntax. Quick Start: note that no exports are available. Known Limitations: "No exports are defined; this package is a planned placeholder."

---

### internal/seed

**Name:** `@nostrwatch/seed`
**Description:** "Nostr relay seeder and discovery module"
**Source:** `internal/seed/src/index.ts`

**Exported API:**
- `RelaySeeder` class
- `SeederOptions` interface

```ts
interface SeederOptions {
  interval: number
  sources: string[]   // 'config' | 'static' | 'cache' | 'api' | 'events' | 'db'
  options: {
    db?: { path: string; enableWAL?: boolean }
    static?: { path: string }   // JSON or YAML file with {relays: string[]}
    config?: string[]
    api?: { rest_api: string }
    events?: { pubkeys: string[]; relays: string[] }
    allowedNetworks?: string[]  // defaults to ['clearnet']
    logLevel?: LogLevel
    isRelayBlocked?: (relay: string) => boolean
  }
}

class RelaySeeder {
  constructor(options: SeederOptions)
  getRelays(): string[]
  getLastSeedTimestamps(): Record<string, number>
  async seed(): Promise<string[]>
  async start(): Promise<void>   // runs seed() in a loop with interval delay
  stop(): void
}
```

**Seed sources (6 strategies):**
- `config` — relay list from `options.config` array directly
- `static` — JSON/YAML file at `options.static.path`
- `cache` — reads from `@nostrwatch/db` SQLite relay_status table
- `api` — fetches from REST API at `options.api.rest_api + '/online'`
- `events` — fetches NIP-66 kind 30166 events from Nostr relays via `nostr-fetch`
- `db` — reads `@nostrwatch/db` relay_status with WAL mode

**Known Limitations:** No CONCERNS.md entries. No @ts-nocheck. Several `any` types. No known limitations to document beyond "No known limitations at this time."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown section-order enforcement | Custom linting script | MD043 in markdownlint-cli2 | Already configured; wildcards handle optional sections |
| README section templates | Copy-paste stubs per task | `docs/styleguide/README.md` templates | Single source of truth; prevents drift |
| Badge URL construction | Manual shields.io URL assembly | Styleguide badge templates | URL encoding for runtimes is tricky (spaces as %20, pipe as %7C) |
| Known Limitations content | Researching limitations fresh | `.planning/codebase/CONCERNS.md` | Concerns already audited; copy and cite |

**Key insight:** Every structural decision (section order, badge format, code style, Known Limitations template) is already specified in `docs/styleguide/README.md`. The planner's tasks should explicitly reference styleguide sections, not re-derive these decisions.

---

## Common Pitfalls

### Pitfall 1: MD043 Wildcard Misunderstanding
**What goes wrong:** A README passes local inspection but fails CI MD043 check because required headings are missing or out of order.
**Why it happens:** MD043 with wildcards is strict about the ORDER of required headings. `## Overview` must appear before `## Installation`, which must appear before `## Quick Start`, etc. A README that has all required headings but in wrong order will still fail.
**How to avoid:** Write sections in styleguide order from the start. Run `pnpm lint:docs` after writing each README.
**Warning signs:** CI failure on `docs-lint.yml`; the MD043 error message includes the expected vs found heading order.

### Pitfall 2: Deprecation Stub vs MD043 Conflict
**What goes wrong:** The `nwcache` deprecation stub (per styleguide) does not contain `## Overview`, `## Installation`, `## Quick Start`, `## Known Limitations`, `## License` — but `.markdownlint-cli2.jsonc` scopes MD043 to `internal/*/README.md`, which includes `nwcache`.
**Why it happens:** The styleguide was written before the MD043 glob was scoped to internal packages. There is a structural inconsistency.
**How to avoid:** The planner must resolve this in Wave 0. Recommended: add `internal/nwcache/README.md` to the `ignores` list in `.markdownlint-cli2.jsonc`. Alternatively, write the stub with all required MD043 headings but stub content under each.
**Warning signs:** `pnpm lint:docs` fails on `internal/nwcache/README.md` with an MD043 error.

### Pitfall 3: Fabricating API Behavior
**What goes wrong:** README documents a method signature or behavior that does not match actual source code.
**Why it happens:** Several packages have sparse or misleading descriptions (e.g., publisher's "adapter pattern" refers to Kind classes, not a traditional adapter directory).
**How to avoid:** Every API signature in a README must be derived from source code read during this research or verified by reading the source before writing. This research file documents what was found.
**Warning signs:** Discrepancy between documented signature and what autocomplete/TypeScript shows when actually using the package.

### Pitfall 4: Missing Known Limitations for publisher
**What goes wrong:** The publisher README omits the language tag validation concern from CONCERNS.md.
**Why it happens:** It's easy to write "No known limitations" without checking CONCERNS.md.
**How to avoid:** The CONTEXT.md explicitly flags publisher as having a required Known Limitations entry. The planner's task checklist must include "check CONCERNS.md" as a step.
**Warning signs:** Reviewer notes that CONCERNS.md entry for Kind30166.ts is not reflected in the README.

### Pitfall 5: Code Examples Without Language Tags
**What goes wrong:** A code block in the README uses bare ` ``` ` without a language identifier, causing MD040 CI failure.
**Why it happens:** Markdown editors often render bare fences fine, so authors do not notice until CI.
**How to avoid:** Every fenced code block must have `ts`, `sh`, `json`, `jsonc`, `yaml`, or `markdown` as the tag.
**Warning signs:** `markdownlint-cli2` reports MD040 errors.

### Pitfall 6: kinds/redis as "full" READMEs
**What goes wrong:** Writer produces full-length READMEs with detailed API sections for `kinds` (empty) or `redis` (dashboard app), padding content to fill sections that have no real content.
**Why it happens:** Pressure to have "complete" documentation.
**How to avoid:** Per CONTEXT.md: minimal README for `kinds` and `redis`. Overview explains honestly what each is (placeholder/operational app). Don't fabricate exports or usage examples.

---

## Code Examples

Verified patterns from source code inspection:

### Logger usage (from announce/src/index.ts)

```ts
import Logger from '@nostrwatch/logger'

const log = new Logger('@nostrwatch/announce')

log.debug('constructor invoked')
log.info('publishing to relays')
log.error('publish failed')
```

### AnnounceMonitor full flow (from announce/src/index.ts)

```ts
import {AnnounceMonitor} from '@nostrwatch/announce'

const monitor = new AnnounceMonitor(pubkey, {
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  checks: ['all'],
  frequency: '1h',
  geo: {},
  timeouts: {},
  networks: ['clearnet'],
  owner: 'owner@example.com'
})

monitor.generate()
await monitor.sign(sk)
const publishedIds = await monitor.publish()
```

### Publisher usage (from announce/src/index.ts — real consuming pattern)

```ts
import {Publisher, Kind10166} from '@nostrwatch/publisher'

const publisher = new Publisher(pubkey, ['wss://relay.damus.io'])
const kind10166 = new Kind10166(pubkey)
kind10166.generateEvent({checks: ['websocket'], frequency: '1h'})
await publisher.publishEvent(kind10166)
```

### Relay network detection (from utils/src/network.ts)

```ts
import {parseRelayNetwork, relaysSerializedByNetwork} from '@nostrwatch/utils'

parseRelayNetwork('wss://relay.damus.io')         // 'clearnet'
parseRelayNetwork('wss://abc123.onion')            // 'tor'

const byNetwork = relaysSerializedByNetwork(['wss://relay.damus.io', 'wss://abc.onion'])
// { clearnet: ['wss://relay.damus.io'], tor: ['wss://abc.onion'] }
```

### Key conversion (from utils/src/keys.ts)

```ts
import {nsecToHex, tryNsecToHex} from '@nostrwatch/utils'

const hex = nsecToHex('nsec1...')       // throws on invalid input
const safe = tryNsecToHex(process.env.NSEC)  // returns '' on failure
```

### Signer creation (from utils/src/signing.ts)

```ts
import {createSigner} from '@nostrwatch/utils'

const signer = createSigner('nsec1...')
const signedEvent = signer.sign(unsignedEvent)
// signer.pubkey: string (derived hex public key)
```

### BullMQ queue initialization (from controlflow/src/queues.ts)

```ts
import {NocapdQueue, TrawlQueue} from '@nostrwatch/controlflow'

const {$Queue, $QueueEvents, Worker} = NocapdQueue('nocapd/us-east')
await $Queue.add('check', {relay: 'wss://relay.damus.io'})
```

### RelaySeeder (from seed/src/index.ts)

```ts
import {RelaySeeder} from '@nostrwatch/seed'

const seeder = new RelaySeeder({
  interval: 60_000,
  sources: ['static', 'api'],
  options: {
    static: {path: './relays.yaml'},
    api: {rest_api: 'https://api.nostr.watch'},
    allowedNetworks: ['clearnet']
  }
})

const relays = await seeder.seed()
// relays: string[] — sanitized, network-filtered relay URLs
```

---

## State of the Art

| Old Pattern | Current Pattern | Notes |
|-------------|-----------------|-------|
| Winston-only logger | Winston + debug dual-backend with browser fallback | Logger already implements this; document the browser fallback |
| BullMQ import in each app | Centralized via @nostrwatch/controlflow | QueueInit ensures singleton queues |
| Direct LMDB cache | nwcache deprecated; functionality inlined | Write deprecation stub |

---

## Open Questions

1. **MD043 on nwcache deprecation stub**
   - What we know: The `.markdownlint-cli2.jsonc` scopes MD043 to `internal/*/README.md`, which includes nwcache. Deprecation stubs omit required headings.
   - What's unclear: Whether the planner should modify `.markdownlint-cli2.jsonc` to add nwcache to `ignores`, or write a hybrid stub that satisfies MD043.
   - Recommendation: Planner adds `internal/nwcache/README.md` to the `ignores` array in `.markdownlint-cli2.jsonc` as part of Wave 0 (or as a task in the nwcache plan). This is cleaner than forcing MD043-compliant structure onto a deprecation stub.

2. **kinds package name**
   - What we know: `internal/kinds/` has no `package.json`. Only `rollup.config.json` and `tsconfig.json` exist.
   - What's unclear: The npm scope name — likely `@nostrwatch/kinds` by convention but not confirmed.
   - Recommendation: Infer `@nostrwatch/kinds` from folder name and monorepo naming convention. Note in README that the package is a planned placeholder.

3. **browser shims in utils and logger**
   - What we know: Both `internal/utils/src/shims/` and `internal/logger/src/shims/` directories exist.
   - What's unclear: Exactly which modules in utils have browser restrictions (e.g., `env.ts` reads `.env` via `fs` — Node.js only).
   - Recommendation: The utils README should note that modules using `fs` or `process.env` directly (e.g., `env.ts`, `redis.ts`) are Node.js-only. Browser-safe modules (array, string, url, time, network) work universally.

4. **controlflow RetryManager eval() usage**
   - What we know: `retry.ts` uses `eval(entry.delay)` to evaluate delay strings from config.
   - What's unclear: Whether this is intentional (DSL for time expressions) or accidental.
   - Recommendation: Document in Known Limitations as "Delay configuration uses eval() — do not pass untrusted config values to RetryManager."

---

## Validation Architecture

> workflow.nyquist_validation is not present in `.planning/config.json` — the key is absent. Skip this section.

---

## Sources

### Primary (HIGH confidence)

- Direct source code inspection of all 9 `internal/` packages — package.json, src/ files, index.ts exports
- `docs/styleguide/README.md` — authoritative section templates, badge formats, code conventions
- `.markdownlint-cli2.jsonc` — exact MD043 required heading list and glob scope
- `.planning/codebase/CONCERNS.md` — Known Limitations source of truth
- `.planning/phases/02-internal-package-readmes/02-CONTEXT.md` — user decisions

### Secondary (MEDIUM confidence)

- Import grep across `apps/` and `internal/` to verify real usage patterns of logger, utils, publisher
- Bash inspection of package.json files for metadata (name, description, version, scripts)

### Tertiary (LOW confidence)

- `browser.ts`, `class.ts`, `object.ts`, `rng.ts` modules in utils — source not read; exports inferred from `index.ts` presence only. Planner should read these before writing the utils README API section.

---

## Metadata

**Confidence breakdown:**
- Package inventory: HIGH — all 9 packages inspected on disk
- API documentation: HIGH for logger, publisher, announce, controlflow, seed; MEDIUM for utils (3 modules not read); LOW for kinds (no source)
- Known Limitations: HIGH — sourced directly from CONCERNS.md and source audit
- Linting/CI patterns: HIGH — markdownlint config read directly
- VitePress integration: HIGH — established in Phase 1, no changes needed

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable; packages unlikely to change during Phase 2 execution)
