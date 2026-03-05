# Phase 4: App Package READMEs - Research

**Researched:** 2026-03-05
**Domain:** Documentation authoring — app-tier README writing for a Nostr relay monitoring monorepo
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Content depth**
- Apps get FULL documentation per styleguide Package Type Matrix — emphasis on Prerequisites and Configuration
- Environment variables documented in tables with Required/Description/Example columns
- Quick Start shows how to run the app locally end-to-end
- API section only if app exposes REST API or SDK (rstate has REST API)

**Deprecation handling**
- nocapd gets deprecation stub pointing to relaymon (explicitly noted in styleguide)
- umon needs assessment during research — if experimental/inactive, deprecation stub; if active, full README
- docker-stacks needs assessment — may need different treatment since it's infra, not a runnable app

**Known Limitations sourcing**
- Same approach as Phases 2-3: CONCERNS.md first, then light source audit
- CONCERNS.md has entries for: rstate (outdated dev utilities, SDK stubs, mock signer, console.log in scoring), gui (table config separation, worker fallback, store race conditions), relaymon (relay URL filtering bug, incomplete DB inspection)
- These MUST appear in respective READMEs

**Code examples**
- Same conventions: TypeScript, no semicolons, single quotes, ESM imports
- For apps: show shell commands to start (`pnpm dev`, `pnpm start`, etc.)
- Environment variable examples use realistic placeholder values
- Deno apps (trawler) use Deno-specific commands

### Claude's Discretion

- How to handle docker-stacks (it's Docker Compose definitions, not a typical app)
- Exact section depth per app — scale to complexity
- Whether umon gets full README or deprecation stub (assess during research)
- How to document rstate's REST API (inline table vs dedicated subsection)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| APP-01 | README.md for apps/gui following styleguide (Svelte/SvelteKit relay dashboard) | gui tech stack confirmed: SvelteKit 2.5, Svelte 5, Vite, TailwindCSS, Dexie; existing README has content but fails MD043 |
| APP-02 | README.md for apps/rstate following styleguide (ContextVM relay state machine + REST API) | rstate existing README is comprehensive but non-conforming; REST endpoints fully documented in existing README; env var/YAML config documented in config.sample.yaml |
| APP-03 | README.md for apps/trawler following styleguide (Deno relay data crawler) | trawler existing README is stub-level (todo list only); deno.json tasks confirm `deno task start`; config.yaml has full example |
| APP-04 | README.md for apps/relaymon following styleguide (relay health monitoring) | relaymon existing README is near-complete but fails MD043; Deno-based; CONCERNS.md has two bug entries |
| APP-05 | README.md for apps/purist following styleguide (data transformation utilities) | purist has NO source files — dist only; index.html confirms it is a browser-based Nostr relay scanner; no package.json at all |
| APP-06 | Deprecation stub README for apps/nocapd (legacy daemon, link to replacement) | nocapd existing README has partial stub but uses wrong format; styleguide has concrete example ready to use |
| APP-07 | README.md for apps/docker-stacks following styleguide (Docker Compose definitions) | docker-stacks existing README is good but non-conforming; it's not a runnable app — needs adapted treatment |
| APP-08 | README.md or deprecation stub for apps/umon (experimental monitoring) | umon is a browser extension (Manifest V3), not a daemon; it has source files (background, popup, utils) but no existing README; Svelte 4 dev dep; version 0.1.0 — active development, not deprecated |
</phase_requirements>

---

## Summary

Phase 4 writes conforming README.md files for all 8 apps/ packages. The primary challenge is that every app has a radically different character: a full SvelteKit dashboard (gui), a ContextVM relay state machine with REST API (rstate), a Deno crawler (trawler), a Deno health monitor with extensive config (relaymon), a browser-only relay scanner with no source (purist), a deprecated daemon (nocapd), Docker Compose stacks (docker-stacks), and a browser extension in early development (umon).

Research confirms that most apps have existing READMEs with useful content, but all fail the MD043 required-heading constraint. The three most complex apps (gui, rstate, relaymon) have rich existing READMEs that need restructuring, not rewriting. The simpler apps (trawler, purist, docker-stacks, umon) need READMEs written closer to scratch. One app (nocapd) needs a proper deprecation stub to replace its ad-hoc partial stub.

Critical discoveries from source examination: purist has no source files at all — only a built dist/ and no package.json — making it a browser-hosted relay scanner with no installable form; umon is a Manifest V3 browser extension with Svelte 4 (not 4.x deprecated, it has actual source); docker-stacks is infra-only Docker Compose definitions, not a runnable app. These three require judgment calls per Claude's Discretion.

**Primary recommendation:** Restructure existing content for gui, rstate, and relaymon; write from scratch for trawler, docker-stacks, and umon; write a proper deprecation stub for nocapd; write a minimal README for purist noting it is a built browser app with no npm install path.

---

## App Inventory: Per-App Research

### apps/gui

**Tech stack (confirmed from package.json):**
- SvelteKit 2.5, Svelte 5.x, Vite 5, TailwindCSS 3.4, TypeScript 5.7
- Runtime: browser only (SSR disabled, static adapter)
- Key workspace deps: `@nostrwatch/route66`, `@nostrwatch/nocap`, `@nostrwatch/worker-relay`, `@nostrwatch/relay-charts`, `@nostrwatch/relay-chronicle`, `@nostrwatch/utils`
- npm package name: `@nostrwatch/gui`, version 0.6.77
- Build output: `apps/gui/dist/`

**Existing README status:** Non-conforming. Has good content under wrong section names (Installation, Usage, Features, Project Layout, Development Notes, License). Missing: Overview, Quick Start, Known Limitations, Prerequisites, Configuration, Agent Skills, Related Packages.

**Run commands (confirmed from package.json scripts):**
```sh
pnpm dev          # Vite dev server, port 5173
pnpm build        # Static production build
pnpm preview      # Preview built bundle
pnpm test         # vitest
pnpm check        # svelte-check
```

**Environment variables:** None confirmed from package.json (no .env pattern found); gui is client-only, runtime config comes from monitors via WebSocket/IndexedDB. No env vars documented in existing README.

**CONCERNS.md entries (MUST appear in Known Limitations):**
1. GUI Table Configuration Separation — user config not separated from built-in config in table/utils.ts (line 30); no clean override mechanism
2. Worker-based Computation Fallback Issues — dimensions-worker-manager.ts (lines 189, 200) falls back silently to legacy stores; no telemetry on fallback frequency
3. GUI Store Initialization Race Conditions — seed.ts and nip11s.ts multiple stores depend on StateManager initialization; timing issues possible

**VitePress route:** `/apps/gui/` — served from `apps/gui/README.md`

**Status badge:** alpha

---

### apps/rstate

**Tech stack (confirmed from package.json + source):**
- Node.js, Fastify 5.7, ContextVM SDK (MCP over Nostr), TypeScript 5.7, tsup
- Runtime: node
- npm package name: `@nostr-watch/rstate` (note: NOT `@nostrwatch/rstate` — the scope has a hyphen, confirmed from package.json)
- version: 0.1.0

**Existing README status:** Comprehensive but non-conforming. Has Overview, Quick Start, REST API, MCP Tools, Configuration Reference, Architecture, Performance, Security, Deployment, Development — but is missing MD043 anchors (Quick Start exists but embedded; Known Limitations absent; Installation present but not in MD043 order).

**Run commands (confirmed from package.json):**
```sh
npm run build    # tsup build
npm run dev      # watch mode
npm start        # production
npm test         # vitest
```

Note: rstate uses `npm` not `pnpm` in its existing README. Its package.json shows npm scripts. Installation from monorepo root still uses `pnpm install`.

**Config approach:** YAML primary, env var override. Config file path set via `CONFIG_FILE` env var or `--config` flag. Key env vars override YAML:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CVM_RELAYS` | Yes (if CVM enabled) | Comma-separated wss:// URLs for CVM transport | `wss://relay.damus.io,wss://relay.nostr.band` |
| `INGEST_RELAYS` | Yes | Comma-separated wss:// for NIP-66 ingestion | `wss://history.nostr.watch` |
| `CVM_SERVER_NSEC` | Yes (if CVM enabled) | Server private key | `nsec1...` |
| `REST_ENABLED` | No | Enable REST API | `true` |
| `REST_PORT` | No | REST API port | `3000` |
| `LOG_LEVEL` | No | Logging verbosity | `info` |

**REST API:** Full REST API with OpenAPI docs at `/docs`. Endpoints confirmed from existing README: health, relays (list, state, search, nearby, bbox, labels, by-software/network/nip/country, compare, online/offline/dead), monitors, policy, subscriptions. SSE for real-time.

**CONCERNS.md entries (MUST appear in Known Limitations):**
1. SDK Stub Dependencies — sdk-stubs.ts has MockRelayPool and MockSigner with fake signatures (security concern)
2. Outdated Development Utilities — dev-tools.ts uses @ts-nocheck with old RelayState structure
3. Console.log in Scoring — monitor-scoring.ts has unconditional console.log at lines 38, 47, 52

**VitePress route:** `/apps/rstate/`
**Status badge:** alpha

---

### apps/trawler

**Tech stack (confirmed from deno.json):**
- Deno 1.4+ (implied by std@0.218.2 usage), TypeScript
- Runtime: Deno (NOT Node.js)
- Version: 0.1.0 (from deno.json)
- Key deps: nostrawl library, @nostrwatch/nocap, @nostrwatch/logger, @nostrwatch/db, nostr-fetch, p-queue, lmdb, sqlite, winston, js-yaml
- No npm package (Deno app, not published to npm)

**Existing README status:** Essentially empty — just a package name line and a todo list. Entire README needs to be written from scratch.

**Run commands (confirmed from deno.json tasks):**
```sh
deno task start          # Run trawler
deno task compile        # Compile to binary in dist/
deno task test           # Run tests
deno task force-refresh  # Clear all caches and restart
```

Full deno run command (for manual invocation without deno.json):
```sh
deno run --allow-sys --allow-ffi --unstable-sloppy-imports --allow-net --allow-env --allow-read --allow-write --allow-run src/main.ts
```

**Configuration (from config.yaml):**
```yaml
logLevel: info
trawler:
  db:
    path: ./trawler.db
    enableWAL: true
  relaysPerBatch: 5
  concurrency: 2
  seed:
    interval: 60000
    sources: ["config"]
    options:
      allowedNetworks: ["clearnet"]
      config:
        - 'wss://relay.nostr.watch'
```

**Environment variables:** `TRAWLER_DB_PATH`, `TRAWLER_DB_WAL` (confirmed from main.ts; override config.yaml).

**CONCERNS.md entries:** None found for trawler specifically.

**Notable:** trawler vendors its dependencies (`vendor: true` in deno.json), so it can run offline after initial setup. The vendor/ directory is committed to the repo.

**VitePress route:** `/apps/trawler/`
**Status badge:** alpha

---

### apps/relaymon

**Tech stack (confirmed from deno.json):**
- Deno (version from deno.json: 0.1.0)
- Runtime: Deno (NOT Node.js)
- Config: YAML file (config.sample.yaml)
- Key deps: p-queue, @nostrwatch/nocap, @nostrwatch/db, @nostrwatch/logger, nostr-tools, SQLite

**Existing README status:** Near-complete but non-conforming. Has Features, Installation, Configuration (YAML example), Usage, Project Structure, Environment Variables, Development, Docker, Status Reporting, Database Migration, Database Check Utility. Missing: MD043 anchors in correct order (no H1 package name, no Overview, no Quick Start as H2, no Known Limitations, License present at bottom). The opening line is a disclaimer blockquote not a heading.

**Run commands (confirmed from deno.json tasks):**
```sh
deno task start      # Start monitoring loop
deno task interactive  # Interactive CLI
deno task status     # Status report
deno task dbcheck    # Database integrity check
deno task compile:linux-x64  # Compile binary for Linux
```

**Environment variables:**
```
RELAYMON_NSEC    # Private key for signing announcements and events
```

**Configuration:** Full YAML config via `config.yaml`. Key sections: monitor (profile), publisher (relay targets), relaymon (networks, retry backoff, seed sources, check config), queue.

**CONCERNS.md entries (MUST appear in Known Limitations):**
1. Relay URL Filtering with Pipe Character — daemon.ts lines 234-239; relays with `|` logged but not properly cleaned; hotfix workaround
2. Database Inspection Function Incomplete — interactive/index.ts lines 31-88; debugInspectDatabase logs start/end but actual inspection queries are missing/commented out

**Docker support:** clearnet and multinet variants; images on Docker Hub as `nostrwatch/relaymon:clearnet` and `nostrwatch/relaymon:multinet`.

**VitePress route:** `/apps/relaymon/`
**Status badge:** alpha

---

### apps/purist

**Assessment:** Purist has NO source files, NO package.json, and NO README — only a compiled `dist/` directory with a browser app. From `dist/index.html`: it is a browser-based Nostr relay scanner (title: "Nostr Relay Scanner - Purist"). The dist/assets include worker files (`nip11.worker`, `relay-check.worker`, `negentropy`). This is a front-end browser tool only.

**Recommendation (Claude's Discretion):** Write a minimal full README (not deprecation stub). It is not deprecated, it's just a pre-built browser app. The README should note: no npm install (browser app), direct browser usage, what it does, and where the dist/ lives. Since there's no source in the repo (perhaps extracted from elsewhere), Known Limitations should note the absence of source.

**Run commands:** None — it is a static web app. Users open the dist/index.html or host it.

**VitePress route:** `/apps/purist/`
**Status badge:** alpha (browser app, no source)

---

### apps/nocapd

**Assessment:** Confirmed deprecated. Existing README has a partial deprecation notice (`> ⚠️ @nostrwatch/nocapd is deprecated`) but it does not follow the styleguide Deprecation Stub Template. The current README has config YAML and env var docs, not a stub format.

**Deprecation target:** `apps/relaymon` (confirmed in styleguide concrete example, CONTEXT.md, and existing README)

**Styleguide provides a complete concrete example for nocapd** — the exact stub text is in docs/styleguide/README.md#concrete-example-appsnocapd. The planner should use that verbatim or adapt it.

**IMPORTANT:** The deprecation stub MUST still pass MD043. From Phase 2 learning (02-03): deprecation stubs include all MD043-required sections even though the styleguide template omits them. This means the stub needs ## Overview, ## Installation, ## Quick Start, ## Known Limitations, ## License even if some of them state "N/A — this package is deprecated."

**VitePress route:** `/apps/nocapd/`

---

### apps/docker-stacks

**Assessment:** docker-stacks is not a runnable application — it is a collection of pre-configured Docker Compose stacks. Confirmed structure:
- `relaymon-clearnet/` — RelayMon clearnet mode
- `relaymon-vpn/` — RelayMon behind Gluetun VPN
- `relaymon-multinet/` — RelayMon with Tor + I2P
- `trawler-relaymon-clearnet/` — Trawler + RelayMon clearnet
- `trawler-relaymon-multinet/` — Trawler + RelayMon multinet

Existing README is clean and brief. It is not conforming (missing MD043 anchors).

**Recommendation (Claude's Discretion):** Write a full README adapted for infra. The Package Type Matrix for apps says Prerequisites + Quick Start are Required. For docker-stacks: Prerequisites = Docker + Docker Compose; Quick Start = `docker compose up -d` from a chosen stack directory; API = N/A; Configuration = pointing to per-stack config files. "Installation" section = no npm install — just clone and configure.

**No env vars** for docker-stacks itself (each stack has its own .env). The README should describe the stacks table and direct users to per-stack READMEs.

**VitePress route:** `/apps/docker-stacks/`
**Status badge:** alpha (or stable since it's just Docker Compose)

---

### apps/umon

**Assessment:** umon is a Manifest V3 browser extension for monitoring Nostr activity. Confirmed from manifest.json and source structure:
- `src/background/index.ts` — service worker background script
- `src/popup/` — popup UI (Svelte 4, index.html + Popup.svelte)
- `src/utils/` — secureStorage.ts, storage.ts
- Version 0.1.0, description: "A browser extension for monitoring Nostr activity"

**Status determination (Claude's Discretion):** umon has actual source code and is NOT deprecated. It is early-stage (v0.1.0) with no existing README, which means it was never documented. Write a full README, not a deprecation stub.

**Run commands (from rollup.config.js + package.json scripts):**
```sh
pnpm build    # rollup build (produces dist/)
pnpm test     # jest
pnpm lint     # eslint
```

**Installation:** Browser extensions are not installed via npm. Users load dist/ as an unpacked extension in Chrome/Firefox developer mode, or install from a web store when published.

**Prerequisites:** No Node.js runtime requirement for end users; developers need Node.js + pnpm. Browser: Chrome/Chromium or Firefox (Manifest V3 support).

**VitePress route:** `/apps/umon/`
**Status badge:** alpha

---

## Standard Stack

### Core (tools in use)

| Tool | Version | Purpose | Confirmed From |
|------|---------|---------|----------------|
| markdownlint-cli2 | CI-enforced | Lint all app READMEs; MD043 required headings | `.markdownlint-cli2.jsonc` (HIGH) |
| VitePress | 1.x | Renders app READMEs as `/apps/{name}/` routes | `docs/.vitepress/config.ts` (HIGH) |
| shields.io | N/A | Badge generation for status/runtime/npm | styleguide (HIGH) |

### App Tech Stacks (read-only, not installed by this phase)

| App | Runtime | Key Tech | Badge Runtime |
|-----|---------|---------|---------------|
| gui | browser | SvelteKit 2.5, Svelte 5, Vite 5, TailwindCSS | `browser` |
| rstate | node | Fastify 5.7, ContextVM SDK, TypeScript | `node` |
| trawler | Deno | Deno 1.4+, nostrawl, SQLite | `node%20%7C%20deno` |
| relaymon | Deno | Deno, SQLite, p-queue | `node%20%7C%20deno` |
| purist | browser | Pre-built browser app (no source) | `browser` |
| nocapd | — | DEPRECATED (Node.js, Redis, BullMQ) | N/A (stub) |
| docker-stacks | Docker | Docker Compose, Docker | `cli` |
| umon | browser | Manifest V3 extension, Svelte 4 | `browser` |

---

## Architecture Patterns

### MD043 Required Section Order

All app READMEs must contain these headings in order (enforced by `.markdownlint-cli2.jsonc`):

```
H1 (package name)
## Overview        ← required
## Installation    ← required
## Quick Start     ← required
## Known Limitations  ← required
## License         ← required
```

Optional sections (Prerequisites, API, Configuration, Agent Skills, Related Packages) may appear between required anchors in any order.

**Critical:** The deprecation stub (nocapd) must ALSO contain these sections even though the styleguide template omits them — learned from Phase 2-03 decision. Stub content for Optional sections = "N/A — this package is deprecated."

### Pattern 1: App README Structure (for runnable apps)

```
H1: @nostrwatch/{package-name}

[tagline]

[badges: npm/scope, License, Status, Runtime]

## Overview
[2-5 sentences: what it does, where it fits, key Nostr concepts defined]

## Prerequisites
[Node.js/Deno version, any services, env var table]

## Installation
[pnpm install or workspace or no-install note]

## Quick Start
[shell commands to start the app]

## API (if app exposes REST API)
[endpoint table]

## Configuration
[YAML config example, env var override table]

## Known Limitations
[bullets from CONCERNS.md]

## Agent Skills
[No skills defined yet — placeholder]

## Related Packages
[workspace deps cross-linked]

## License
[MIT](../../LICENSE)
```

### Pattern 2: Deprecation Stub (for nocapd)

From styleguide (HIGH confidence — concrete example provided):

```
H1: @nostrwatch/nocapd

> **DEPRECATED** — This package has been replaced by...

## Overview
[placeholder or N/A]

## Installation
[placeholder or N/A]

## Quick Start
[N/A]

## Why deprecated
[paragraph]

## Migrating
[replacement link + migration note]

## Known Limitations
[N/A — deprecated]

## License
[MIT](../../LICENSE)
```

**Note:** Sections between required MD043 anchors may be inserted. "Why deprecated" and "Migrating" fit naturally between ## Quick Start and ## Known Limitations.

### Pattern 3: docker-stacks Adapted README

docker-stacks is infrastructure (Docker Compose), not a runnable Node app. Adapt the standard structure:

- **Prerequisites:** Docker Engine 24+, Docker Compose v2
- **Installation:** "No install — clone the monorepo and choose a stack directory"
- **Quick Start:** `docker compose up -d` from a stack directory
- **Configuration:** Points to per-stack .env + config.yaml patterns
- **API:** N/A

### Pattern 4: Env Var Table Format

From the styleguide (HIGH confidence):

```markdown
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VARNAME` | Yes | What it does | `realistic-value` |
```

### Anti-Patterns to Avoid

- **Wrong badge for apps:** Apps on npm use the npm version badge. Apps NOT on npm (docker-stacks, trawler, relaymon, umon) use scope or other badge instead.
- **Fabricated env vars:** Only document env vars confirmed from source (main.ts, config.ts, existing README). Do not invent undocumented variables.
- **`npm install` for Deno apps:** trawler and relaymon are Deno apps — no `npm install`. Installation = "Ensure Deno is installed; clone monorepo."
- **Semicolons in TypeScript examples:** Styleguide requires no semicolons.
- **Require() imports:** ESM only per styleguide.
- **Missing language tags:** Every fenced code block needs `ts`, `sh`, `yaml`, `json`, etc.
- **Missing blank lines around headings:** MD022 is enforced.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deprecation stub for nocapd | Custom format | Exact template from styleguide §Deprecation Stub Template | Styleguide has a concrete nocapd example verbatim |
| Badge URLs | Construct from scratch | Copy from styleguide Badge Reference with PACKAGE-NAME substituted | Encoding details (`%7C` for pipe) are error-prone |
| MD043 section ordering | Invent new structure | Follow `.markdownlint-cli2.jsonc` exact heading list | CI will fail if order is wrong |
| CONCERNS.md paraphrasing | Summarize from memory | Read CONCERNS.md directly for each app | Inaccurate paraphrasing is worse than quoting |

**Key insight:** The styleguide, CONCERNS.md, and existing READMEs together provide ~70% of the content for this phase. The planner's job is assembly, not invention.

---

## Common Pitfalls

### Pitfall 1: MD043 Heading Order Violation

**What goes wrong:** A README passes visual inspection but fails CI because a required heading is missing or out of order.
**Why it happens:** Existing READMEs have good content under different heading names (e.g., "Usage" instead of "Quick Start", "Config" instead of "Configuration").
**How to avoid:** After writing each README, mentally trace the heading list against the MD043 config: `## Overview → ## Installation → ## Quick Start → ## Known Limitations → ## License`. If any required heading is absent or precedes another required heading, fix it before committing.
**Warning signs:** Existing READMEs for gui, relaymon, and trawler all use non-standard headings.

### Pitfall 2: Wrong Badge for Non-npm Apps

**What goes wrong:** Using the npm version badge for apps that are not published to npm.
**Why it happens:** The badge template defaults to npm.
**How to avoid:** trawler, relaymon, docker-stacks, and umon are NOT npm packages. Use the scope badge (`[![Scope](https://img.shields.io/badge/scope-app-lightgrey...)]`) or a custom badge for these. gui and rstate are npm packages.
**Note:** rstate's npm package name is `@nostr-watch/rstate` (hyphen in scope), not `@nostrwatch/rstate`. Verify the npm badge URL uses the correct name.

### Pitfall 3: Deprecation Stub Missing MD043 Anchors

**What goes wrong:** Deprecation stub for nocapd fails MD043 because the styleguide template does not include all required headings.
**Why it happens:** The styleguide template uses "Why deprecated" and "Migrating" headings instead of the MD043-required set.
**How to avoid:** The stub must contain ## Overview, ## Installation, ## Quick Start, ## Known Limitations, ## License (even if content is "N/A — this package is deprecated"). Insert "## Why deprecated" and "## Migrating" as optional sections between required ones.
**Reference:** Phase 2-03 decision log confirms this pattern works.

### Pitfall 4: rstate Package Name Mismatch

**What goes wrong:** README and badges use `@nostrwatch/rstate` when the actual package name is `@nostr-watch/rstate` (hyphenated scope).
**Why it happens:** The monorepo uses `@nostrwatch/` consistently for all other packages; rstate is the exception.
**How to avoid:** Confirm from `apps/rstate/package.json` — name is `@nostr-watch/rstate`.

### Pitfall 5: Inventing Purist Source Details

**What goes wrong:** README describes TypeScript source structure or build commands that don't exist (purist has no source in the repo).
**Why it happens:** Pattern-matching to other apps.
**How to avoid:** Purist is a pre-built browser app (dist/ only). README should describe what the app does (relay scanner based on index.html title/description) and how to use it (host dist/ or open index.html). Do not document build steps that don't exist.

### Pitfall 6: deno task vs pnpm for Relaymon/Trawler

**What goes wrong:** Quick Start shows `pnpm dev` for relaymon or trawler.
**Why it happens:** Most monorepo apps use pnpm.
**How to avoid:** relaymon and trawler are Deno apps. Installation = Deno runtime. Run commands = `deno task start`. No pnpm commands needed.

---

## Code Examples

### gui Quick Start (shell — confirmed from package.json)

```sh
# From monorepo root
pnpm install

# Start development server (port 5173)
pnpm --filter @nostrwatch/gui dev

# Production build
pnpm --filter @nostrwatch/gui build
```

### rstate Quick Start (shell — confirmed from package.json)

```sh
# Install dependencies
npm install

# Configure
cp config.sample.yaml config.yaml
# Edit config.yaml with your relay URLs and keys

# Build and start
npm run build
npm start
```

### trawler Quick Start (shell — confirmed from deno.json)

```sh
# Ensure Deno is installed (https://deno.land)
# Clone monorepo and navigate to trawler
cd apps/trawler

# Configure
cp config.yaml config.local.yaml
# Edit config.local.yaml

# Start
deno task start
```

### relaymon Quick Start (shell — confirmed from deno.json)

```sh
# Ensure Deno is installed
cd apps/relaymon

# Configure
cp config.sample.yaml config.yaml
# Edit config.yaml — set monitor.slug, publisher.relays, RELAYMON_NSEC

# Start
RELAYMON_NSEC=nsec1... deno task start
```

### docker-stacks Quick Start (shell)

```sh
# Choose a stack
cd apps/docker-stacks/relaymon-clearnet

# Add your configuration files
cp .env.example .env       # edit with your keys
cp config.yaml.example config.yaml  # edit with monitor config

# Start
docker compose up -d
```

### nocapd Deprecation Stub (verbatim from styleguide)

From `docs/styleguide/README.md` — the concrete example is ready to use:

```markdown
# @nostrwatch/nocapd

> **DEPRECATED** — This package has been replaced by [@nostrwatch/relaymon](../../apps/relaymon/README.md). No further updates will be made here.

## Why deprecated

`nocapd` was an early relay monitoring daemon that checked relay health on a polling schedule. It has been replaced by `relaymon`, which provides a more robust and configurable monitoring loop, better database integration, and improved NIP-66 event publishing. `nocapd` is no longer maintained.

## Migrating

Use [`@nostrwatch/relaymon`](../../apps/relaymon/README.md) instead. Configuration format has changed — see the relaymon README for the new environment variable schema.

## License

[MIT](../../LICENSE)
```

**Note:** Planner MUST add ## Overview, ## Installation, ## Quick Start, ## Known Limitations between the stub sections to satisfy MD043.

---

## App-Specific Section Guidance

### gui

- **Prerequisites:** Node.js >=22 (Volta pins 22.15.0), pnpm >=8; no env vars for the app itself
- **Installation:** Clone monorepo + `pnpm install` (workspace deps must be linked)
- **Quick Start:** `pnpm --filter @nostrwatch/gui dev`
- **API:** N/A (pure frontend, no REST API)
- **Configuration:** No env vars; Preferences page in the UI for runtime config (cache wipe, monitor management)
- **Known Limitations:** 3 CONCERNS.md entries (table config separation, worker fallback, store race conditions)
- **Related Packages:** route66, nocap, worker-relay, relay-charts, relay-chronicle, utils

### rstate

- **Prerequisites:** Node.js >=20; config.yaml with CVM relays and server key required
- **Installation:** `npm install` (or `pnpm install` from monorepo root)
- **Quick Start:** Copy config.sample.yaml, edit, `npm run build && npm start`
- **API:** Full REST API — document key endpoint groups in a table (health, relays, monitors, policy, subscriptions)
- **Configuration:** YAML primary + env overrides; document in subsections (CVM, REST, Logging, Cache, Aggregation)
- **Known Limitations:** 3 CONCERNS.md entries (SDK stubs/MockSigner, dev-tools @ts-nocheck, console.log in scoring)
- **Related Packages:** Internal publisher, logger, utils; external ContextVM SDK

### trawler

- **Prerequisites:** Deno >=1.40 (implied from std@0.218.2); `TRAWLER_DB_PATH` and `TRAWLER_DB_WAL` env vars optional
- **Installation:** `cd apps/trawler; deno task start` (vendor/ directory committed, no deno install needed)
- **Quick Start:** `deno task start`
- **API:** N/A (no REST API)
- **Configuration:** `config.yaml` — logLevel, db path/WAL, relaysPerBatch, concurrency, seed sources/networks
- **Known Limitations:** No CONCERNS.md entries; note trawler is marked as alpha/in-progress (original README had todos about nostrawl integration)
- **Related Packages:** nostrawl, nocap, db, logger, publisher, announce

### relaymon

- **Prerequisites:** Deno >=1.40; `RELAYMON_NSEC` env var required; SQLite created automatically at db.path
- **Installation:** Deno runtime; clone monorepo; `cd apps/relaymon`
- **Quick Start:** `RELAYMON_NSEC=nsec1... deno task start`
- **API:** N/A (no REST API)
- **Configuration:** `config.yaml` — extensive; document monitor profile, publisher relays, relaymon.networks, retry backoff, seed sources, checks config, queue concurrency
- **Known Limitations:** 2 CONCERNS.md entries (pipe character URL filtering bug, incomplete DB inspection function)
- **Docker:** Document both clearnet and multinet variants; Docker Hub images
- **Related Packages:** nocap, db, logger, announce, publisher, docker-stacks

### purist

- **Assessment:** Browser-only relay scanner; no source in repo; only dist/ present
- **Prerequisites:** Modern browser (Chrome/Firefox); no Node.js/Deno required for users
- **Installation:** Host `dist/` as a static web app or open `dist/index.html` directly
- **Quick Start:** Open `dist/index.html` in browser
- **API:** N/A
- **Configuration:** None documented
- **Known Limitations:** Source code not present in this repository; app is distributed as pre-built assets only
- **Related Packages:** None apparent

### nocapd

- Use exact styleguide concrete example as the base
- Add MD043-required sections with "N/A — this package is deprecated" content
- Link to relaymon README with relative path `../../apps/relaymon/README.md`

### docker-stacks

- **Prerequisites:** Docker Engine >=24, Docker Compose v2 (`docker compose` not `docker-compose`)
- **Installation:** Clone monorepo; no npm/Deno install
- **Quick Start:** Choose a stack directory; add `.env` and `config.yaml`; `docker compose up -d`
- **API:** N/A
- **Configuration:** Per-stack configuration; reference each stack with the config it needs
- **Known Limitations:** None from CONCERNS.md; note multinet requires Tor/I2P routing
- **Related Packages:** relaymon, trawler (the apps these stacks deploy)

### umon

- **Prerequisites:** Developer: Node.js >=18, pnpm; End user: Chrome/Chromium or Firefox (Manifest V3)
- **Installation:** Developer: `pnpm install && pnpm build`; End user: load `dist/` as unpacked extension
- **Quick Start:** `pnpm build` then load dist/ in browser extensions page
- **API:** N/A (browser extension)
- **Configuration:** No documented configuration
- **Known Limitations:** Alpha/early stage; no tests beyond jest scaffolding; no web store listing; uses Svelte 4 (note: Svelte 5 is current in other packages)
- **Related Packages:** None confirmed

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Ad-hoc per-app README format | MD043-enforced required section order | CI will catch missing sections |
| Separate per-app documentation | VitePress unified site with `/apps/{name}/` routes | All READMEs automatically become site pages |
| nocapd partial deprecation notice (blockquote only) | Full deprecation stub with MD043 compliance | Passes linting and renders correctly in VitePress |

---

## Open Questions

1. **rstate npm package scope**
   - What we know: package.json confirms `@nostr-watch/rstate` (hyphenated)
   - What's unclear: Is this intentional differentiation or a typo? All other packages use `@nostrwatch/`
   - Recommendation: Document as-is (`@nostr-watch/rstate`) since it matches the actual package.json. Note the difference in the README header without editorializing.

2. **purist source location**
   - What we know: apps/purist has only dist/ and node_modules/ — no source files, no package.json
   - What's unclear: Where is the source? Was it extracted from another repo?
   - Recommendation: Write the README based on the observable facts (browser relay scanner, pre-built dist). Add Known Limitations note about missing source. Do not speculate about where source might be.

3. **docker-stacks per-stack READMEs**
   - What we know: Each stack subdirectory has its own README.md (e.g., relaymon-clearnet/README.md)
   - What's unclear: Are these subdirectory READMEs also subject to MD043 linting? The glob in `.markdownlint-cli2.jsonc` is `apps/*/README.md` — only the top-level apps/docker-stacks/README.md is linted, not subdirectory ones
   - Recommendation: Focus on `apps/docker-stacks/README.md` only. Subdirectory READMEs are out of scope for this phase.

4. **umon browser extension vs deprecated status**
   - What we know: v0.1.0, has source code, is a Manifest V3 extension, no README
   - What's unclear: Is development still active?
   - Recommendation: Write full README (not deprecation stub) since it has source and is not marked deprecated anywhere in the codebase.

---

## Sources

### Primary (HIGH confidence)

- `apps/*/package.json` — npm package names, versions, scripts (read directly)
- `apps/*/deno.json` — Deno task names, versions, import maps (read directly)
- `apps/*/README.md` — existing content (read directly)
- `docs/styleguide/README.md` — complete styleguide including concrete nocapd example (read directly)
- `.markdownlint-cli2.jsonc` — exact MD043 heading list enforced by CI (read directly)
- `docs/.vitepress/config.ts` — VitePress sidebar listing all app routes (read directly)
- `.planning/codebase/CONCERNS.md` — all Known Limitations (read directly)
- `.planning/codebase/STRUCTURE.md` — app tech stacks and entry points (read directly)
- `apps/rstate/src/config.ts` — env var names and types (read directly)
- `apps/trawler/src/main.ts` — env var usage (read directly)
- `apps/umon/src/manifest.json` — browser extension manifest v3 confirmation (read directly)
- `apps/purist/dist/index.html` — title/description confirming browser relay scanner (read directly)

### Secondary (MEDIUM confidence)

- `apps/*/CHANGELOG.md` — version history (skimmed, lower priority)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- App inventory and tech stacks: HIGH — confirmed from package.json/deno.json/source files directly
- MD043 requirements: HIGH — read directly from .markdownlint-cli2.jsonc
- Known Limitations: HIGH — read directly from CONCERNS.md
- Purist status: HIGH — dist/index.html confirms browser app; absence of source is confirmed by directory listing
- umon status: HIGH — has source files, manifest.json, not deprecated
- docker-stacks approach: MEDIUM — judgment call on adapted structure for infra; no prior phase precedent for infra packages

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — styleguide and source don't change without explicit PRs)
