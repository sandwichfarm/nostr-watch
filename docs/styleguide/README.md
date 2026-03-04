# README Styleguide

This document is the authoritative guide for writing and formatting README files across all packages in the nostr-watch monorepo. Every package README — whether an app, library, or internal package — must follow this styleguide. The goal is consistency, discoverability, and usefulness for both human developers and AI agents working on the codebase.

**Who this is for:** Anyone writing or reviewing package documentation in this monorepo. This includes contributors adding a new package, maintainers updating existing docs, and AI agents generating or editing READMEs.

---

## Contents

- [Section Reference](#section-reference)
- [Badge Reference](#badge-reference)
- [Code Example Guidelines](#code-example-guidelines)
- [Tone and Voice Guidelines](#tone-and-voice-guidelines)
- [Known Limitations Template](#known-limitations-template)
- [Deprecation Stub Template](#deprecation-stub-template)
- [Package Type Matrix](#package-type-matrix)

---

## Section Reference

Every package README must contain its required sections in this exact order. Optional sections may appear between required ones, but the required sections must be present and in sequence. The markdownlint config at `.markdownlint-cli2.jsonc` enforces this order automatically.

### Required section order

1. **Header with badges** — H1 title + badge row
2. **Overview** — What the package is and what it does
3. **Prerequisites** — Runtime requirements, environment variables, or dependencies
4. **Installation** — How to install the package
5. **Quick Start** — Minimal working example
6. **API** — Exported functions, classes, types
7. **Configuration** — Options, config file format, environment variables
8. **Known Limitations** — Current constraints, tech debt, and workarounds
9. **Agent Skills** — Links to relevant Claude Code skills
10. **Related Packages** — Links to companion packages in the monorepo
11. **License** — License identifier and link

Optional sections (for example, "Contributing", "Changelog", "Architecture") may be inserted between required sections. Their presence does not violate the styleguide, but their position relative to required sections must not alter the required order.

---

### 1. Header with badges

**Purpose:** Identify the package and communicate status at a glance. The header is the first thing a reader sees. Badges convey build health, version, license, and runtime support without requiring the reader to dig into the package.

**Content expectations:**

- H1 heading with the package name (use the npm package name, e.g., `@nostrwatch/auditor`)
- A brief tagline (one sentence maximum) may appear between the H1 and the badge row
- The full badge set immediately follows (see [Badge Reference](#badge-reference))
- No prose paragraphs in this section — save description for Overview

**Example:**

```markdown
# @nostrwatch/auditor

Nostr relay auditor — runs NIP conformance tests against any relay.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/auditor?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/auditor)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
```

---

### 2. Overview

**Purpose:** Tell the reader what the package does, why it exists, and where it fits in the broader nostr-watch system. This is the section a developer scans to decide if a package is relevant to their task.

**Content expectations:**

- 2–5 sentences describing what the package does
- Explain what problem it solves or what role it plays in the system
- Mention key Nostr concepts the package interacts with (relay, NIP, event, filter) — define terms briefly on first use
- Do not repeat information from the badge row (version, license)
- Do not start with "This package..." — lead with the action or value

**Nostr glossary for first use in Overview (define inline):**

- **relay** — a WebSocket server that stores and forwards Nostr events
- **NIP** — Nostr Implementation Possibility, a specification for protocol behavior; NIPs are numbered (NIP-01, NIP-11, etc.)
- **filter** — a query object sent to a relay to request matching events
- **event** — a signed JSON object; the fundamental unit of the Nostr protocol

**Example:**

```markdown
## Overview

`@nostrwatch/auditor` tests Nostr relays (WebSocket servers that store and forward events) for protocol conformance. Given a relay URL, it runs a battery of NIP (Nostr Implementation Possibility) tests and returns a structured result indicating which NIPs the relay supports correctly. Use it to benchmark new relays, validate relay upgrades, or power relay-health dashboards.

Auditor is a library — it runs tests but does not store results. Pair it with `@nostrwatch/route66` for persistent relay monitoring.
```

---

### 3. Prerequisites

**Purpose:** Enumerate everything a developer needs before they can use this package. Unmet prerequisites are the most common source of "it doesn't work" frustration.

**Content expectations:**

- Node.js version range if constrained (e.g., `Node.js >=20`)
- pnpm version if constrained (most packages: `pnpm >=9`)
- For apps: list all required environment variables with description and example values
- For libraries: note any peer dependencies not auto-installed
- Omit obvious prerequisites (Git, an internet connection)
- If there are no prerequisites beyond Node.js and pnpm, write: "Node.js >=20 and pnpm >=9."

**Example (app):**

```markdown
## Prerequisites

- Node.js >=20
- pnpm >=9
- A running PostgreSQL instance (tested with 15+)

**Environment variables** (create `.env` from `.env.example`):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgres://user:pass@localhost:5432/relaymon` |
| `LOG_LEVEL` | No | Logging verbosity | `info` |
| `RELAY_TIMEOUT_MS` | No | Relay connection timeout in milliseconds | `5000` |
```

**Example (library):**

```markdown
## Prerequisites

Node.js >=20 and pnpm >=9.
```

---

### 4. Installation

**Purpose:** Get the package installed in as few steps as possible.

**Content expectations:**

- Show the pnpm install command (primary)
- Show npm as an alternative only for public-facing libraries (not internal packages)
- For internal monorepo packages, note that you add them via the pnpm workspace, not from npm
- Do not include setup steps here — those belong in Quick Start or Prerequisites

**Example (published library):**

```markdown
## Installation

```sh
pnpm add @nostrwatch/auditor
```

Or with npm:

```sh
npm install @nostrwatch/auditor
```
```

**Example (internal package):**

```markdown
## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/logger --filter @nostrwatch/your-package
```

It is not published to npm.
```

---

### 5. Quick Start

**Purpose:** Show a minimal, working example that produces a useful result. A developer should be able to copy this, run it, and see output within two minutes.

**Content expectations:**

- Exactly one code block (or two at most — setup + run)
- Uses real values: actual relay URLs, realistic event kinds, real import paths
- Produces visible output or a meaningful side effect
- No error handling boilerplate unless the package's primary purpose is error handling
- Must follow code example conventions (see [Code Example Guidelines](#code-example-guidelines))
- Annotate what the expected output is, either inline or in a comment

**Example:**

```markdown
## Quick Start

```ts
import {Auditor} from '@nostrwatch/auditor'

const auditor = new Auditor('wss://relay.damus.io')
const result = await auditor.run()

console.log(result.summary)
// { passed: 14, failed: 2, skipped: 1, score: 0.875 }
```
```

---

### 6. API

**Purpose:** Document every exported symbol a caller would use. This is the reference section — thorough, not tutorial.

**Content expectations:**

- Cover all public exports: functions, classes, types, constants
- For each function/method: signature, parameter descriptions, return type, and a brief usage note
- For each class: constructor signature, public methods, and relevant properties
- TypeScript types preferred in signatures (use the actual types from the source)
- If the API is large (10+ exports), organize into subsections by category
- Do not reproduce the Quick Start example here — link to it instead
- Include error conditions: what throws, what returns null/undefined, what rejects

**Example:**

```markdown
## API

### `Auditor`

```ts
class Auditor {
  constructor(relayUrl: string, options?: AuditorOptions)
  run(): Promise<AuditResult>
  runNip(nip: number): Promise<NipResult>
}
```

**`constructor(relayUrl, options?)`**

Creates a new auditor for the given relay URL. `options` is optional.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Per-test timeout in milliseconds |
| `nips` | `number[]` | all supported | Which NIPs to test |

**`run()`**

Runs all configured NIP tests against the relay. Resolves with an `AuditResult`. Rejects if the relay URL is unreachable.

**`runNip(nip)`**

Runs tests for a single NIP. Returns `NipResult` with individual test outcomes.
```

---

### 7. Configuration

**Purpose:** Document all configuration points: constructor options, config files, environment variables, and any tuneable constants.

**Content expectations:**

- If configuration is simple (one or two options), a table is sufficient
- If configuration is complex (many options with interdependencies), use subsections
- Show example config file content in a fenced code block with the correct language tag
- List all environment variables with type, default, and description
- Note which config values are validated at startup and which fail silently

**Example:**

```markdown
## Configuration

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Relay connection timeout in milliseconds |
| `retries` | `number` | `3` | Number of reconnect attempts before giving up |
| `nips` | `number[]` | `[1, 11, 42]` | NIPs to test |

### Config file

If a `auditor.config.json` file is present in the working directory, it is loaded automatically:

```json
{
  "timeout": 10000,
  "nips": [1, 11, 42, 50]
}
```

Options passed to the constructor override the config file.
```

---

### 8. Known Limitations

**Purpose:** Be honest about current constraints, tech debt, and rough edges. This section saves developers time that would otherwise be spent debugging known issues.

See [Known Limitations Template](#known-limitations-template) for the required format.

**Content expectations:**

- Bulleted list; each item covers one limitation
- Each item includes: what the limitation is, why it matters, and any workaround or planned fix
- Link to the relevant CONCERNS.md entry or GitHub issue when available
- Honest but constructive — acknowledge tech debt without being alarming
- If there are no known limitations: "No known limitations at this time."

---

### 9. Agent Skills

**Purpose:** Help AI agents (Claude Code, etc.) find the specific skills they need to work effectively on this package. This section is for agent discoverability, not for human developers.

**Content expectations:**

- Bulleted list of relevant skill files with a one-line description of each skill's purpose
- Skill paths are relative to the repo root (e.g., `.claude/skills/auditor/SKILL.md`)
- If no skills exist yet for this package, write: "No agent skills defined yet for this package."
- Do not explain what Claude Code is — agents reading this already know

**Example:**

```markdown
## Agent Skills

- [`.claude/skills/auditor/SKILL.md`](.claude/skills/auditor/SKILL.md) — How to add a new NIP test to the auditor
- [`.claude/skills/nocap/SKILL.md`](.claude/skills/nocap/SKILL.md) — How to write a nocap adapter (auditor uses nocap adapters internally)
```

---

### 10. Related Packages

**Purpose:** Surface companion packages that a developer would naturally want to use alongside this one.

**Content expectations:**

- Bulleted list; each item is a linked package name with a one-line description of the relationship
- Focus on functional relationships: "pairs with", "required by", "replaces", "extends"
- Do not list every package in the monorepo — only the directly relevant ones (typically 2–5)

**Example:**

```markdown
## Related Packages

- [`@nostrwatch/route66`](../../libraries/route66/README.md) — persistent relay monitoring; auditor is used internally by route66 for health checks
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — low-level relay connection primitives that auditor builds on
- [`@nostrwatch/nip66`](../../libraries/nip66/README.md) — NIP-66 event types; audit results are published as NIP-66 events
```

---

### 11. License

**Purpose:** Legal requirement. Always present, always last.

**Content expectations:**

- Single line: "MIT" or the applicable license identifier
- Link to the root `LICENSE` file

**Example:**

```markdown
## License

[MIT](../../LICENSE)
```

---

## Badge Reference

Every package README must include the full badge set immediately after the H1 heading. Badges use shields.io URLs. Copy the template below and replace `PACKAGE-NAME` with the actual npm package name (e.g., `auditor`, `route66`, `nocap`).

### Full badge template

```markdown
[![npm version](https://img.shields.io/npm/v/@nostrwatch/PACKAGE-NAME?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/PACKAGE-NAME)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-STATUS-COLOR?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-RUNTIMES-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
```

### Status badge values

Replace `STATUS` and `COLOR` with one of:

| Status | Color | When to use |
|--------|-------|-------------|
| `alpha` | `orange` | Breaking changes expected; API is not stable |
| `beta` | `yellow` | API is mostly stable; some rough edges remain |
| `stable` | `brightgreen` | API is stable; production-ready |
| `deprecated` | `red` | Package is deprecated; see deprecation stub |

### Runtime badge values

Replace `RUNTIMES` with the appropriate combination. Encode spaces as `%20` and pipe characters as `%7C`:

| Runtimes | Badge value |
|----------|-------------|
| Node.js only | `node` |
| Browser only | `browser` |
| Node.js + browser | `node%20%7C%20browser` |
| Node.js + Deno | `node%20%7C%20deno` |
| CLI | `cli` |
| Universal | `node%20%7C%20browser%20%7C%20deno` |

### Badge for internal packages (not on npm)

For packages not published to npm, omit the npm version badge and use a scope badge instead:

```markdown
[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
```

---

## Code Example Guidelines

Code examples are one of the most valuable parts of a README. Follow these rules to ensure examples are useful, consistent, and maintainable.

### Style conventions

These match the `.prettierrc.yaml` at the repo root:

- **No semicolons** — `const x = 1` not `const x = 1;`
- **Single quotes** — `'wss://relay.damus.io'` not `"wss://relay.damus.io"`
- **ESM imports** — `import {Auditor} from '@nostrwatch/auditor'` not `require()`
- **No trailing commas** — last item in a list or object has no comma
- **No bracket spacing** — `{Auditor}` not `{ Auditor }`

### Language tags (required)

Every fenced code block must have a language tag. The markdownlint config enforces this (MD040). Use:

| Tag | When |
|-----|------|
| `ts` | TypeScript examples (preferred) |
| `js` | JavaScript-only examples |
| `sh` | Shell commands |
| `json` | JSON config or data |
| `jsonc` | JSON with comments |
| `yaml` | YAML config |
| `markdown` | Markdown examples |

Never use a bare ` ``` ` without a tag.

### Import style

Always use the full package name:

```ts
import {Auditor} from '@nostrwatch/auditor'
import {Logger} from '@nostrwatch/logger'
```

Never use relative imports in examples (those are implementation details, not the public API).

### Relay URLs in examples

Use real, publicly known relay URLs. Do not invent fake relay URLs. Preferred options:

- `wss://relay.damus.io` — well-known, generally available
- `wss://nos.lol` — stable alternative
- `wss://relay.nostr.band` — stable alternative

Do not use `wss://example.com` or `wss://localhost` unless the example is specifically about local testing.

### Realism and minimalism

Examples must be both realistic (uses actual package behavior) and minimal (shortest path to a useful result):

- Do: show the 5 most important lines that produce visible output
- Do not: build a complete application in the Quick Start
- Do not: wrap everything in boilerplate try/catch unless error handling is the point
- Do: annotate expected output with a comment (`// { passed: 14, failed: 2 }`)

### TypeScript types in examples

Prefer typed examples in Quick Start and API sections:

```ts
import {Auditor, type AuditResult} from '@nostrwatch/auditor'

const auditor = new Auditor('wss://relay.damus.io')
const result: AuditResult = await auditor.run()
```

The reader can see what types are involved without reading the source.

---

## Tone and Voice Guidelines

### Audience assumptions

**Do assume:**
- TypeScript familiarity (types, generics, async/await)
- npm/pnpm familiarity (install, run, workspaces)
- Basic Nostr protocol awareness (not deep expertise)
- Developer context (command line, IDE, Git)

**Do not assume:**
- Prior nostr-watch codebase knowledge
- Deep Nostr protocol expertise (NIPs, event structure, relay behavior)
- Familiarity with this package's internal architecture
- That the reader has read other READMEs in the monorepo

### Define Nostr terms on first use

When a Nostr concept appears for the first time in a README, define it inline in parentheses:

- "...tests your relay (a WebSocket server that stores and forwards Nostr events)..."
- "...NIP-01 (the foundational Nostr protocol specification)..."
- "...publishes a kind 30166 event (a NIP-66 relay status event)..."

Do not define the same term twice in the same README. If the term appears later, use it without explanation.

Link to the relevant NIP spec when mentioning a NIP:

```markdown
This package implements [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) relay monitoring events.
```

### Writing style

- **Professional but approachable** — write as if explaining to a capable colleague, not as if writing a marketing document
- **Active voice** — "The auditor connects to the relay" not "The relay is connected to by the auditor"
- **Imperative in instructions** — "Run the tests" not "You should run the tests"
- **Specific over vague** — "resolves within 5 seconds" not "resolves quickly"
- **Honest about limitations** — do not oversell; the Known Limitations section exists for a reason

### Avoid these patterns

- Marketing language: "blazing fast", "battle-tested", "production-ready" (unless actually true and verifiable)
- Hedging: "might", "should", "usually" (when the behavior is deterministic)
- Defensive phrasing: "Please note that..." (just say it directly)
- Informal colloquialisms: "alpha af", "this bad boy", "super simple"
- Passive voice in instructions: "the configuration can be set" → "set the configuration"

---

## Known Limitations Template

The Known Limitations section uses a bulleted list. Each bullet covers exactly one limitation. Follow the structure below.

### Template

```markdown
## Known Limitations

- **[Limitation name]:** [One sentence describing the limitation.] [One sentence explaining why it matters or what behavior it causes.] [Workaround or planned fix, if any.] See [CONCERNS.md — Section Name](.planning/codebase/CONCERNS.md#section) or [issue #N](https://github.com/sandwichfarm/nostr-watch/issues/N).
```

### Tone guidance

- State the limitation factually — do not apologize or alarm
- If there is a workaround, state it clearly
- If a fix is planned, say so ("planned for v2.0" or "tracked in issue #N")
- If there is no workaround and no fix planned, say so ("no workaround available at this time")

### Concrete example

The following example is drawn from a real concern in `.planning/codebase/CONCERNS.md`:

```markdown
## Known Limitations

- **Hardcoded filter limit:** `MonitorService` caps subscriptions at 10 filters (`MAX_FILTERS = 10`) regardless of what the relay actually supports. Relays that allow more filters will not be fully utilized; relays that allow fewer may reject subscriptions silently. To work around this, split your subscription across multiple `MonitorService` instances. The fix — reading `MAX_FILTERS` from the relay's NIP-11 info document at initialization — is tracked in [CONCERNS.md — Hardcoded Filter Limits](.planning/codebase/CONCERNS.md#hardcoded-filter-limits).

- **Default relays hardcoded in source:** Default relay URLs in `RelayService` are set in the constructor rather than loaded from configuration. Changing the default relay list requires a code change. Pass an explicit relay list to the constructor as a workaround. See [CONCERNS.md — Default Relay Configuration](.planning/codebase/CONCERNS.md#default-relay-configuration).
```

---

## Deprecation Stub Template

Deprecated packages use a minimal stub README rather than a full README. The stub tells the reader what replaced the package and where to go. Do not write full API docs for deprecated packages.

### Template structure

1. **H1** with package name
2. **Deprecation banner** (blockquote) immediately after H1 — no badges
3. **Why deprecated** — one paragraph
4. **Where to go** — links to the replacement
5. **License** — always present, even in stubs

### Template

```markdown
# @nostrwatch/PACKAGE-NAME

> **DEPRECATED** — This package has been replaced by [@nostrwatch/REPLACEMENT](../../PATH/TO/REPLACEMENT/README.md). No further updates will be made here.

## Why deprecated

[One paragraph explaining what changed and why this package was deprecated. Be specific about what capability was lost, what was improved, or what architectural decision led to the deprecation.]

## Migrating

Use [@nostrwatch/REPLACEMENT](../../PATH/TO/REPLACEMENT/README.md) instead. [One sentence on what, if anything, needs to change in the caller.]

## License

[MIT](../../LICENSE)
```

### Concrete example: apps/nocapd

`apps/nocapd` has been superseded by `apps/relaymon`. Its stub README should read:

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

### Other deprecated packages

- **`internal/nwcache`** — deprecated internal caching layer; note it is no longer in use and has no replacement (functionality was inlined).
- **`libraries/schemata`** — moved to the `@nostrability/schemata` package; stub should direct readers to the new package on npm.

---

## Package Type Matrix

Different package types have different documentation requirements. Use this matrix to determine which sections are required, optional, or not applicable for a given package.

| Section | Library | App | Internal |
|---------|---------|-----|----------|
| Header with badges | Required | Required | Required (scope badge, not npm) |
| Overview | Required | Required | Required |
| Prerequisites | Optional (peer deps only) | Required | Optional |
| Installation | Required | Required | Required (workspace install only) |
| Quick Start | Required | Required | Optional |
| API | Required | Not applicable | Optional (if exported) |
| Configuration | Required if options exist | Required if env vars exist | Optional |
| Known Limitations | Required | Required | Optional |
| Agent Skills | Required | Required | Optional |
| Related Packages | Required | Optional | Optional |
| License | Required | Required | Required |

### Section guidance by type

**Libraries** (`libraries/`): Full documentation is required. These are the primary public surface of the monorepo. Emphasis on API and code examples — developers integrating a library need to understand exactly what they get.

**Apps** (`apps/`): Emphasis on Prerequisites (env vars, runtime dependencies) and Quick Start (how to run). API section is not applicable for apps unless the app exposes a REST API or SDK — document those separately within the API section. Configuration is typically the most important section for apps.

**Internal packages** (`internal/`): Lighter documentation. Overview + Installation + API (if exported) are the minimum. Many internal packages are utilities consumed by other monorepo packages and do not need extensive documentation. Use the scope badge instead of the npm badge.

### Deprecated packages (any type)

Deprecated packages of any type use the [Deprecation Stub Template](#deprecation-stub-template) regardless of their original package type. Do not write a full README for a deprecated package.

---

*Maintained by the nostr-watch documentation team.*
*Last updated: 2026-03-04*
*Enforced by: `.markdownlint-cli2.jsonc` (MD043 section order)*
