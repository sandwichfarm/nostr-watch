# Architecture

**Analysis Date:** 2026-03-04

## Pattern Overview

**Overall:** Layered monorepo with modular app/library separation and adapter-based patterns.

**Key Characteristics:**
- Monorepo structure using pnpm workspaces with 10+ apps and 20+ libraries
- Three-tier separation: apps (products), libraries (reusable components), internal (infrastructure)
- Adapter pattern for pluggable integrations (websocket, cache, DNS, SSL, etc.)
- Event-driven Nostr protocol implementation with validation and aggregation
- Store-based state management in frontend (Svelte stores) and state machines in backend (ContextVM)

## Layers

**Applications Layer:**
- Purpose: End-user facing products and services
- Location: `apps/`
- Contains: GUI (Svelte/SvelteKit), rstate (ContextVM relay server), trawler (Deno crawler), relaymon (relay monitoring), purist (data utilities)
- Depends on: Libraries, internal utilities, external frameworks
- Used by: End users, other services

**Libraries Layer:**
- Purpose: Reusable components and business logic
- Location: `libraries/`
- Contains: Core Nostr abstractions (nocap, route66, auditor), relay aggregation (relay-charts, relay-chronicle), websocket clients, validators (schemata), data stores (db, idb)
- Depends on: Internal utilities, external Nostr/crypto packages
- Used by: Multiple apps, other libraries, external consumers

**Internal Infrastructure Layer:**
- Purpose: Shared utilities and cross-cutting services
- Location: `internal/`
- Contains: Logger, publisher, event kinds registry, caching layer (nwcache), announcement system, seed data, Redis integration, control flow
- Depends on: External packages only
- Used by: All apps and libraries

**Frontend Components (GUI):**
- Purpose: Reactive UI and state visualization
- Location: `apps/gui/src/lib/`
- Contains: Svelte components (14+ dirs), stores, services, derivations, managers
- Pattern: Svelte/SvelteKit with file-based routing in `routes/`
- State: Centralized in stores (checks, events, softwares, isps, geocodes)

**Backend Services (rstate):**
- Purpose: Relay state machine and REST API
- Location: `apps/rstate/src/`
- Contains: ContextVM integration, REST endpoints, core state logic (cache, metrics, scoring)
- Pattern: Fastify HTTP server with OpenAPI documentation
- State: ContextVM-based with CLI support

## Data Flow

**Data Ingestion (trawler/relaymon):**

1. Source: Nostr relays (via WebSocket or HTTP)
2. Validation: Schema validation against NIP standards
3. Enrichment: Geo-coding, SSL checks, DNS lookups, metadata extraction
4. Storage: SQLite or LMDB caches
5. Publishing: Events published back to Nostr for aggregation

**Frontend Data Pipeline:**

1. Initial load: Route-specific data fetching in SvelteKit load functions
2. Aggregation: Route66.StateManager handles replay and derivations
3. Caching: Dexie (IndexedDB) for browser-side persistence
4. Store Updates: Reactive stores trigger component updates
5. Derivation: Computed stores (decentralization scores, stats aggregations)

**Backend State Machine (rstate):**

1. Intake: Incoming Nostr events or HTTP requests
2. Core Processing: State transformations in `core/` modules
3. Caching Layer: In-memory cache with invalidation
4. REST Response: Shaped by request parameters (compact, performance levels)
5. Telemetry: Metrics and monitoring via publisher

**State Management:**
- Frontend: Svelte stores with derived stores for computed values
- Backend: ContextVM state machine with context variables
- Sharing: JSON serialization for state transfer via HTTP

## Key Abstractions

**Nocap (Capability-based relay discovery):**
- Purpose: Adapter-based relay capability querying
- Examples: `libraries/nocap/`, `libraries/nocap/adapters/default/`
- Pattern: Factory pattern with pluggable adapters for DNS, Info, SSL, Websocket, Geo endpoints
- Each adapter implements a common interface for fetching relay capabilities

**Route66 (Relay state aggregation and routing):**
- Purpose: Multi-relay data aggregation with deterministic state management
- Examples: `libraries/route66/src/core/`, `libraries/route66/src/services/`
- Pattern: StateManager handles event replay and derived state
- Manages relay metadata, metrics, and decentralization scoring

**Auditor (Event validation):**
- Purpose: Nostr protocol compliance checking
- Examples: `libraries/auditor/src/base/`, `libraries/auditor/src/utils/`
- Pattern: Schema-based validation using AJV
- Validates NIPs (NIP-01 events, NIP-11 relay metadata, NIP-66 checks)

**Schemata (Schema definitions):**
- Purpose: Shared data model definitions
- Examples: `libraries/schemata/`, `libraries/schemata-js-ajv/`
- Pattern: JSON Schema definitions with TypeScript interfaces
- Used by: All data validation and type checking

**Publisher (Event publishing):**
- Purpose: Publish events to Nostr relays
- Examples: `internal/publisher/src/`, `internal/publisher/adapters/NostrTools/`
- Pattern: Adapter pattern with library-specific implementations
- Handles signing, relay selection, retry logic

**Nostrawl (Web crawling for Nostr data):**
- Purpose: Queue-based web crawling and data extraction
- Examples: `libraries/nostrawl/src/classes/`
- Pattern: Queue abstraction with pluggable adapters (p-queue, BullMQ)
- Used by: trawler app for distributed crawling

## Entry Points

**GUI (Svelte App):**
- Location: `apps/gui/src/routes/+page.svelte`
- Triggers: Browser navigation to https://nostr-watch.vercel.app or local dev
- Responsibilities: Render relay dashboard with tables, maps, stats; fetch and display relay data
- Main store initialization via `lib/stores/app.ts`

**rstate REST API:**
- Location: `apps/rstate/src/server.ts`
- Triggers: HTTP requests on configurable port (default :3000)
- Responsibilities: Serve relay state over REST with OpenAPI docs; handle ContextVM MCP integration
- Entry command: `npm start` or `node dist/index.js`

**trawler Crawler:**
- Location: `apps/trawler/src/main.ts`
- Triggers: Manual execution or scheduled via Docker
- Responsibilities: Crawl Nostr relays, fetch metadata, publish check events
- Entry command: `deno run --allow-net ... src/main.ts`

**relaymon Monitoring:**
- Location: `apps/relaymon/` (Deno app)
- Triggers: Configured schedule or manual
- Responsibilities: Monitor relay health, detect changes, publish updates to Nostr
- Entry command: Compiled binary or Docker container

**CLI (rstate):**
- Location: `apps/rstate/src/cli.ts`
- Triggers: Command line with args like `config:validate`, `health`, `cache:stats`
- Responsibilities: System diagnostics and configuration validation
- Entry command: `npx relayvm [command]` or `tsx src/cli.ts [command]`

## Error Handling

**Strategy:** Hierarchical try-catch with logging and graceful degradation

**Patterns:**

1. **Validation Errors:** Caught at schema validation layer, returned with detailed AJV errors
   - Example: `libraries/auditor/src/base/SchemaValidator.test.ts` validates events
   - Logged via logger service with context

2. **Network Errors:** Retried with exponential backoff in nostrawl queue
   - Example: `libraries/nostrawl/src/adapters/PQueueAdapter.test.ts` handles retries
   - Fallback to cached data when available

3. **Relay Connection Errors:** Handled by websocket adapter layer
   - Example: `libraries/websocket/src/` provides connection pooling
   - Graceful reconnection with health checks

4. **Database Errors:** Wrapped in transaction rollback logic
   - Example: `apps/relaymon/tests/unit/database.test.ts`
   - Logged with migration context

5. **Publishing Errors:** Handled by publisher with relay fallback
   - Example: `internal/publisher/src/Publisher.ts`
   - Retry to secondary relays on failure

6. **Server Shutdown:** Graceful with signal handlers
   - Example: `apps/rstate/src/server.ts` handles SIGTERM/SIGINT
   - Closes connections, flushes cache before exit

## Cross-Cutting Concerns

**Logging:**

- Framework: Custom logger in `internal/logger/src/logger.ts`
- Implementation: Pino-based structured logging with child contexts
- Usage: `getLogger().child({ module: 'name' })` pattern
- Levels: info, warn, error, debug (configured via env)

**Validation:**

- Framework: AJV for JSON Schema validation
- Usage: `libraries/auditor/` provides SchemaValidator class
- Pattern: Pre-validation of Nostr events before processing
- Reusable in: All apps via schemata-js-ajv library

**Authentication:**

- Approach: Nostr event signature verification using noble/secp256k1
- Example: `internal/utils/src/signing.ts` for key operations
- Used for: Publisher identity, event authenticity
- Pattern: Detached from business logic, applied at ingestion

**Caching:**

- In-memory: `internal/nwcache/src/` provides cache layer
- Browser: Dexie (IndexedDB) in GUI for relay data
- Database: SQLite (trawler) or LMDB (relaymon) for persistence
- Strategy: TTL-based invalidation with manual refresh triggers

**Configuration:**

- Files: YAML-based in `apps/rstate/src/config.ts`
- Environment: Dotenv-based with env var overrides
- Runtime: CLI tools for validation (`config:validate` command)
- Pattern: Immutable after startup, accessed via module

**Metrics & Observability:**

- Publishing: Events published to Nostr with structured kind numbers
- Aggregation: Route66 provides metric computation and storage
- API: REST endpoints expose metrics in response objects
- Example: Decentralization scoring in `apps/gui/src/lib/stores/score-relays-decentralization.ts`

