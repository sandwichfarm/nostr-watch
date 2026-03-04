# Codebase Structure

**Analysis Date:** 2026-03-04

## Directory Layout

```
nostr-watch/
├── apps/                          # Product applications (10 apps)
│   ├── gui/                       # Svelte/SvelteKit dashboard frontend
│   ├── rstate/                    # ContextVM relay state machine & REST API
│   ├── trawler/                   # Deno-based relay data crawler
│   ├── relaymon/                  # Relay health monitoring service
│   ├── nocapd/                    # Legacy Node.js nocap daemon
│   ├── purist/                    # Data transformation utilities
│   ├── umon/                      # Experimental monitoring
│   ├── docker-stacks/             # Docker Compose definitions
│   └── ...
├── libraries/                     # Reusable shared libraries (20+ libs)
│   ├── nocap/                     # Relay capability discovery framework
│   ├── route66/                   # Relay aggregation & state management
│   ├── auditor/                   # Event validation & protocol compliance
│   ├── schemata/                  # JSON Schema definitions
│   ├── schemata-js-ajv/           # AJV-based schema validation
│   ├── relay-charts/              # Relay metric visualization data
│   ├── relay-chronicle/           # Relay event history & timeseries
│   ├── nostrawl/                  # Queue-based web crawler
│   ├── db/                        # Database client abstractions
│   ├── idb/                       # IndexedDB wrapper for browser
│   ├── websocket/                 # WebSocket connection management
│   ├── nip66/                     # NIP-66 relay check protocol
│   ├── nostrings/                 # Relay URL validation & normalization
│   ├── memory-relay/              # In-memory relay implementation
│   ├── negentropy/                # Negentropy (NIP-49) support
│   ├── worker-relay/              # Web Worker relay
│   ├── uptime-kuma-monitor/       # Uptime monitoring integration
│   └── ...
├── internal/                      # Internal shared infrastructure
│   ├── utils/                     # Utility functions (keys, arrays, env, etc.)
│   ├── publisher/                 # Event publishing with adapters
│   ├── logger/                    # Structured logging service
│   ├── announce/                  # Announcement system
│   ├── nwcache/                   # Caching layer
│   ├── redis/                     # Redis integration
│   ├── controlflow/               # Control flow utilities
│   ├── kinds/                     # Nostr event kind registry
│   └── seed/                      # Seed data management
├── .planning/                     # GSD planning documents
│   └── codebase/                  # This directory (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── tests/                         # Root-level integration tests
├── docs/                          # Documentation
├── scripts/                       # Build & deployment scripts
├── .github/                       # GitHub Actions CI/CD
├── .ansible/                      # Ansible deployment configs
├── package.json                   # Root monorepo manifest
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── vitest.config.js               # Root vitest configuration
└── _tsconfig.json                 # Base TypeScript config
```

## Directory Purposes

**apps/gui:**
- Purpose: Web dashboard for relay monitoring and exploration
- Contains: Svelte components, routes, stores, services, utilities
- Key files: `src/routes/+page.svelte` (main dashboard), `src/lib/stores/` (state)
- Tech: SvelteKit 2.5, Vite, TailwindCSS, Dexie

**apps/rstate:**
- Purpose: Relay state machine with REST API and MCP integration
- Contains: Fastify server, ContextVM setup, REST endpoints, core logic
- Key files: `src/server.ts` (entry point), `src/core/` (business logic), `src/config.ts`
- Tech: Node.js, Fastify 5.7, ContextVM SDK, OpenAPI

**apps/trawler:**
- Purpose: Crawl Nostr relays and publish metadata
- Contains: Deno TypeScript code, SQLite cache, config
- Key files: `src/main.ts`, `deno.json` (config), `config.yaml` (runtime)
- Tech: Deno 1.4+, TypeScript, SQLite

**apps/relaymon:**
- Purpose: Monitor relay health and detect changes
- Contains: TypeScript sources, tests, Docker setup
- Key files: `src/`, `tests/` (extensive test coverage)
- Tech: Node.js, npm, WebSocket

**libraries/nocap:**
- Purpose: Relay capability discovery with adapter pattern
- Contains: Base classes, interfaces, validators, data models
- Adapters: `adapters/default/` has DNS, Info, SSL, WebSocket, Geo adapters
- Key pattern: Each adapter implements common interface for extensibility

**libraries/route66:**
- Purpose: Relay aggregation and state management
- Contains: Core state logic, services, managers, models, transformers
- Key services: `StateManager` for replay, `managers/` for different data types
- Used by: GUI for relay data, metrics computation, decentralization scores

**libraries/auditor:**
- Purpose: Validate Nostr events against protocol specs
- Contains: Schema validators, WebSocket handling, utility functions
- Key classes: `SchemaValidator` for AJV-based validation
- Tests cover: NIP compliance, event validation, error handling

**libraries/schemata:**
- Purpose: Single source of truth for data models
- Contains: JSON Schema files organized by kind/purpose
- Usage: Referenced by schemata-js-ajv and validation throughout stack

**internal/utils:**
- Purpose: Shared utility functions across all apps
- Contains: Key management, array ops, config parsing, env detection, logging
- Key files: `keys.ts`, `signing.ts`, `logger.ts`, `env.ts`, `array.ts`
- Usage: Imported via `@nostrwatch/utils` in all packages

**internal/publisher:**
- Purpose: Publish Nostr events to relays
- Contains: Base publisher, adapter pattern for different libraries
- Adapters: `adapters/NostrTools/` provides nostr-tools integration
- Pattern: Abstract event building from library-specific publishing

**internal/logger:**
- Purpose: Structured logging across all services
- Contains: Logger configuration, child context creation
- Framework: Pino with pretty formatting in dev
- Usage: `getLogger().child({ module: 'name' })` throughout codebase

## Key File Locations

**Entry Points:**

| Location | Purpose | Trigger |
|----------|---------|---------|
| `apps/gui/src/routes/+page.svelte` | Main dashboard | Browser navigation |
| `apps/rstate/src/server.ts` | REST API server | `npm start` |
| `apps/rstate/src/cli.ts` | CLI commands | CLI invocation |
| `apps/trawler/src/main.ts` | Crawler entry | Deno execution |
| `apps/relaymon/src/index.ts` | Monitor entry | Node execution |

**Configuration:**

| Location | Purpose |
|----------|---------|
| `package.json` | Root workspace manifest |
| `pnpm-workspace.yaml` | Workspace path definitions |
| `_tsconfig.json` | Base TypeScript config |
| `apps/rstate/src/config.ts` | Relay VM config loading |
| `apps/rstate/tsconfig.json` | App-specific TS config |
| `apps/gui/vite.config.js` | Vite build config |
| `.eslintrc.yml` | ESLint rules |
| `.prettierrc.yaml` | Prettier formatting |

**Core Logic:**

| Location | Purpose |
|----------|---------|
| `apps/rstate/src/core/` | State machine core |
| `libraries/route66/src/core/` | Relay aggregation logic |
| `libraries/nocap/src/classes/` | Adapter implementations |
| `libraries/auditor/src/base/` | Validation logic |
| `internal/publisher/src/` | Event publishing |

**Testing:**

| Location | Type |
|----------|------|
| `apps/gui/src/index.test.ts` | GUI unit tests |
| `apps/rstate/test/` | Server integration tests |
| `apps/relaymon/tests/` | Relay monitor tests (extensive) |
| `libraries/*/src/*.test.ts` | Library unit tests |
| `libraries/*/tests/` | Library integration tests |
| `tests/` | Root integration tests |

## Naming Conventions

**Files:**

- Source files: `camelCase.ts` or `PascalCase.ts` for classes
- Example: `src/services/NocapService/`, `src/utils/keys.ts`

- Test files: `{filename}.test.ts` or `{filename}.spec.ts`
- Example: `array.test.ts`, `Publisher.test.ts`

- Config files: `{purpose}.config.{ext}` or `{purpose}.json`
- Example: `tsconfig.json`, `vite.config.js`, `deno.json`

- Routes (SvelteKit): `+page.svelte`, `+layout.svelte`, `[param]` for dynamic
- Example: `src/routes/relays/+page.svelte`, `src/routes/relays/[protocol]/+page.svelte`

**Directories:**

- Feature modules: PascalCase for service directories
- Example: `FeedService/`, `NocapService/`, `NIP05Service/`

- Utility folders: camelCase
- Example: `components/`, `stores/`, `managers/`, `utils/`

- Adapter modules: `adapters/{AdapterName}/src/index.ts`
- Example: `adapters/ZEveryAdapterDefault/`, `adapters/NostrTools/`

## Where to Add New Code

**New Feature in GUI:**
- Primary code: `apps/gui/src/lib/{category}/` (components, stores, services, utils)
- Routes: `apps/gui/src/routes/{path}/+page.svelte` (file-based routing)
- Tests: `apps/gui/src/{path}.test.ts` (co-located)
- Pattern: Create Svelte components in `components/`, add stores in `stores/`

**New Library:**
- Implementation: `libraries/{name}/src/`
- Package manifest: `libraries/{name}/package.json`
- Exports: Defined via `export *` in `src/index.ts`
- Workspace declaration: Automatic via pnpm if package.json exists

**New App:**
- Root: `apps/{appname}/`
- Entry point: `src/index.ts` or `src/main.ts`
- Package manifest: `apps/{appname}/package.json`
- Config: App-specific config file (e.g., `deno.json`, `vite.config.js`)

**New Adapter:**
- Location: `libraries/{parent}/adapters/{AdapterName}/src/index.ts`
- Pattern: Implement common interface defined in parent library
- Example: `libraries/nocap/adapters/default/DnsAdapterDefault/`

**Internal Utility:**
- Location: `internal/{category}/src/`
- Public API: Export from `src/index.ts`
- Usage: Import as `@nostrwatch/{category}` via workspace paths

**Tests:**
- Unit tests: Co-located with source files as `*.test.ts`
- Integration tests: In `tests/` subdirectory of app/library
- Test utilities: `test/` directory with helpers and fixtures
- Fixture pattern: Example in `apps/rstate/test/` for sample configs

## Special Directories

**node_modules:**
- Purpose: Installed dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No (gitignored)
- Note: Contains nested monorepo workspaces for each app

**dist/:**
- Purpose: Built output
- Generated: Yes (via build scripts)
- Committed: No (gitignored)
- Contents: Compiled JavaScript, type definitions (.d.ts), source maps

**.git/:**
- Purpose: Git repository metadata
- Generated: Yes (by git)
- Committed: No (internal git structure)

**.planning/:**
- Purpose: GSD planning documents
- Generated: No (manually created by gsd agents)
- Committed: Yes (part of codebase analysis)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, etc.

**vendor/ (apps/trawler only):**
- Purpose: Vendored Deno dependencies
- Generated: Yes (by Deno)
- Committed: Yes
- Note: Reduces external dependency on remote servers

**cache/ (apps/trawler only):**
- Purpose: Local SQLite database cache
- Generated: Yes (by trawler at runtime)
- Committed: No (data files)

## Package Workspace Configuration

**Root workspace:**
- `package.json`: Defines monorepo name `@nostrwatch/monorepo`
- `pnpm-workspace.yaml`: Lists all workspace paths

**Workspace paths (pnpm-workspace.yaml):**
```yaml
packages:
  - "apps/*"                                    # All apps become workspaces
  - "demos/*"                                   # Demo projects
  - "internal/*"                                # Internal utilities
  - "internal/publisher/adapters/**/*"          # Nested adapter workspaces
  - "libraries/*"                               # All libraries
  - "libraries/nocap/adapters/**/*"             # Nocap adapters
  - "libraries/kit/adapters/**/*"               # Kit adapters
  - "libraries/route66/adapters/**/*"           # Route66 adapters
```

**Cross-package imports:**
- Syntax: `@nostrwatch/{package-name}`
- Resolution: Configured in `_tsconfig.json` via path aliases
- Runtime: Resolved via pnpm symlinks in node_modules

## Type Definitions & Interfaces

**Location:** Types defined in multiple places:

1. **Schemata Library:** `libraries/schemata/` contains JSON Schema sources
2. **Type Files:** `src/types/` directories in each app/library
3. **Interfaces:** `src/interfaces/` or co-located with implementations
4. **Models:** `src/models/` for domain-specific types

**Sharing Mechanism:** Generated TypeScript from JSON Schema or exported from libraries

## Build & Output Structure

**App builds (frontend):**
- Source: `apps/gui/src/`
- Output: `apps/gui/dist/` (SvelteKit static export)
- Type defs: `apps/gui/dist/index.d.ts`

**App builds (backend):**
- Source: `apps/rstate/src/` (TypeScript)
- Output: `apps/rstate/dist/` (JavaScript)
- Executables: `apps/rstate/dist/cli.js`, `apps/rstate/dist/index.js`

**Library builds:**
- Source: `libraries/*/src/`
- Output: `libraries/*/dist/` or exported directly from package.json
- Type defs: `dist/index.d.ts` or inline in package.json exports

