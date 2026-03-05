# External Integrations

**Analysis Date:** 2026-03-04

## APIs & External Services

**Bunny CDN:**
- Service: Bunny.net Content Delivery Network
- What it's used for: Static file storage and CDN caching for `apps/gui` deployments
- SDK/Client: Custom fetch-based implementation
- Auth: Environment variables:
  - `BUNNY_STORAGE_ENDPOINT` - Storage API endpoint
  - `BUNNY_STORAGE_ZONE_NAME` - Storage zone identifier
  - `BUNNY_STORAGE_ZONE_PASSWORD` - Zone authentication password
  - `BUNNY_API_KEY` - Account-level API key (for purge operations)
  - `BUNNY_PULL_ZONE_ID` - Pull zone ID for cache purging
- Implementation: `apps/gui/scripts/deploy-bunny.mjs` - Direct HTTP PUT uploads with optional purge

**GitHub:**
- Service: GitHub repository hosting and Actions CI/CD
- What it's used for: Source control, deployment automation, package publishing
- Implementation: `.github/workflows/` contains GitHub Actions workflows

**Nostr Protocol (Network):**
- Service: Nostr relay network (decentralized)
- What it's used for: Primary data source - monitoring relay health, NIP-11 queries, event publishing
- SDK/Client: `nostr-tools` (2.10.4+), `nostr-fetch` (0.14.1-0.17.0)
- Implementation: WebSocket connections to Nostr relays across the entire network
- Key integrations:
  - `@nostrwatch/nocap` - Relay liveness checks via WebSocket
  - `@nostrwatch/auditor` - Relay NIP compliance validation
  - `@nostrwatch/announce` - NIP-10166 event announcements
  - `apps/relaymon` - Persistent relay monitoring agent (Deno)
  - `apps/trawler` - Relay discovery and scraping (Deno)

**Geolocation Services:**
- Service: GeoIP lookup for relay location data
- What it's used for: Determining relay geographic location for monitoring and visualization
- SDK/Client: `@nostrwatch/nocap-geo-adapter-default` adapter
- Implementation: Via `@nostrwatch/nocap` library adapters

## Data Storage

**Databases:**
- SQLite (embedded)
  - Connection: Local file-based via Deno/Node.js
  - Client: `@nostrwatch/route66-cacheadapter-nostrsqlite` for caching
  - Purpose: In-app caching layer for `apps/gui`
  - Type: Browser-based via Dexie wrapper

- SurrealDB 1.0.6
  - Connection: Client library usage in `apps/gui`
  - Purpose: Likely local or remote state management
  - Implementation: Browser-based integration

- LMDB (Lightning Memory-Mapped Database)
  - Type: Embedded key-value store
  - Used in: Deno apps (`apps/trawler`)
  - Purpose: High-performance local data storage

**Local Storage:**
- Browser localStorage API
  - Used in: `apps/gui`
  - Purpose: Preferences, UI state, dimension caches
  - Implementation: Direct browser storage with lifecycle management

**File Storage:**
- Local filesystem only - No cloud file storage (S3, Google Cloud Storage, etc.)
- Docker volumes for containerized deployments

**Caching:**
- IndexedDB (via Dexie wrapper)
  - Used in: `apps/gui` browser app
  - Purpose: Client-side data persistence and caching
- LMDB
  - Used in: Deno applications
  - Purpose: Fast local caching for agent data
- In-memory relay: `@nostrwatch/memory-relay` package

## Authentication & Identity

**Auth Provider:**
- Custom/None - No centralized auth provider detected
- Implementation:
  - Nostr keypair-based signing via `nostr-tools`
  - Event publishing via `@nostrwatch/publisher`
  - WebSocket connections to relays are public (no auth required)
  - Internal services use workspace-local authentication only

**API Authentication:**
- REST endpoints in `apps/rstate` - Fastify-based, no authentication detected in base config
- Bunny CDN requires zone password and API key (environment-based)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar service integration

**Logs:**
- Approach: Structured logging via Pino 9.5.0 in `apps/rstate`
- pino-pretty - Pretty-printed logs for development
- Debug module support (`debug` package)
- Winston logger available but marked for replacement

**Health Checks:**
- NIP-11 server info endpoint checks
- Custom health validation in `apps/relaymon` (health-config.example.yaml)
- `apps/rstate` - Health endpoint available (see src/cli.ts with `health` command)

## CI/CD & Deployment

**Hosting:**
- Bunny CDN - Static asset hosting for `apps/gui`
- Netlify - Adapter available (@sveltejs/adapter-netlify) for SvelteKit
- Static adapter - Self-hosted deployment option (@sveltejs/adapter-static)
- GitHub Pages - Available via gh-pages tool

**CI Pipeline:**
- GitHub Actions (see `.github/workflows/`)
  - docker-relaymon.yml - Container builds
  - docker-trawler.yml - Container builds
  - daily-seeded-gui-deploy.yml - Scheduled deployments
  - publish-package.yml - Package publishing via changesets

**Deployment Tools:**
- Ansible - Multi-location relay monitoring deployment
  - Playbooks: `.ansible/nocapd/deploy.yaml`, `.ansible/nocapd/nuke-cache.yaml`
  - Inventory locations: `.ansible/inventories/` (johannesburg, amsterdam, mumbai, newyork, saopaulo, seoul, siliconvalley, sydney)
- Docker Compose - Local and containerized deployments
- Deno compile - Binary compilation for agents

## Environment Configuration

**Required env vars:**
- Bunny CDN deployment:
  - `BUNNY_STORAGE_ENDPOINT`
  - `BUNNY_STORAGE_ZONE_NAME`
  - `BUNNY_STORAGE_ZONE_PASSWORD`
- Optional for cache purge:
  - `BUNNY_API_KEY`
  - `BUNNY_PULL_ZONE_ID`
  - `BUNNY_CONCURRENCY` (default 50)
  - `BUNNY_REPLICATION_TIMEOUT_MS` (default 15000)

**Secrets location:**
- Environment variables only - Not version controlled
- No `.env` files visible in repository
- Production deployment likely uses CI/CD secrets management

## Webhooks & Callbacks

**Incoming:**
- REST endpoints in `apps/rstate` via Fastify
- WebSocket connections from browser clients
- Nostr relay connections (WebSocket)

**Outgoing:**
- Event publishing to Nostr relays via `@nostrwatch/publisher`
- NIP-10166 announcements via `@nostrwatch/announce`
- Bunny CDN purge callbacks via API

## External Data Sources

**Relay Discovery:**
- `apps/trawler` - Scrapes known Nostr relays from the network
- Relay seeding sources via `@nostrwatch/seed`
- Blocklists: `apps/relaymon/blocklists/` directory

**NIP-11 Server Information:**
- Fetched from relays during health checks
- Cached locally (SQLite for browser, LMDB for agents)
- Validated against JSON schemas

---

*Integration audit: 2026-03-04*
