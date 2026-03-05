# Technology Stack

**Analysis Date:** 2026-03-04

## Languages

**Primary:**
- TypeScript 5.7.2 - Core language across all apps and libraries
- JavaScript (ESM) - Runtime execution in Node.js and browsers

**Secondary:**
- TypeScript in Deno - `apps/relaymon` and `apps/trawler` use Deno with TypeScript
- Svelte 5.x - UI framework for `apps/gui`

## Runtime

**Environment:**
- Node.js >= 20 (pnpm workspaces)
- Volta managed: Node 22.15.0 (see `package.json`)
- Deno - Used for `apps/relaymon` (relaymon/deno.json) and `apps/trawler` (trawler/deno.json)

**Package Manager:**
- pnpm >= 8
- Lockfile: pnpm-lock.yaml (present)
- Workspace configuration: pnpm-workspace.yaml manages monorepo

## Frameworks

**Core:**
- SvelteKit 2.52.2 - Web framework for `apps/gui` (full-stack web app)
- Fastify 5.7.3 - HTTP framework in `apps/rstate` (relay state machine with REST endpoints)
- Svelte 5.53.5 - Component framework in `apps/gui`

**Testing:**
- Vitest 2.x - Test runner (configured in vitest.config.js)
- Jest - Browser extension testing in `apps/umon`

**Build/Dev:**
- Vite 5.4.21 - Build tool for `apps/gui`
- TypeScript 5.7.2 - Type checking
- Rollup 4.59.0 - Module bundling
- esbuild 0.25.0 - JavaScript bundler
- Webpack 5.104.1 - Alternative bundler
- Deno compile - Binary compilation for Deno apps

**Formatting & Linting:**
- Prettier 3.4.2 - Code formatter (configured in .prettierrc.yaml)
- ESLint - Linting (configured in .eslintrc.yml)

## Key Dependencies

**Critical:**
- nostr-tools 2.10.4 - Nostr protocol implementation (used across all apps)
- @contextvm/sdk 0.6.2 - Context VM for relay state machine (`apps/rstate`)
- applesauce-relay 4.0.0 - Relay implementation
- fastify 5.7.3 - HTTP server framework
- pino 9.5.0 - Structured logging in `apps/rstate`

**Nostr-specific Libraries:**
- nostr-fetch 0.14.1-0.17.0 - Nostr event fetching
- nostr-geotags - Geolocation tagging for relays
- nostr-zap 1.2.0 - Zap (lightning) support
- bolt11 1.4.1 - Lightning invoice decoder
- light-bolt11-decoder 3.2.0 - Alternative lightning decoder

**UI/Visualization:**
- chart.js 4.4.0 - Charting library for `apps/gui`
- d3-geo 3.1.1 - Geospatial visualization
- leaflet 1.9.4 - Map library
- @unovis/svelte 1.4.5 & @unovis/ts 1.4.5 - Data visualization
- Tailwind CSS 3.4.4 - Utility CSS framework
- bits-ui 0.21.16 - Component library
- radix-svelte 0.9.0 - Accessible component primitives

**State & Storage:**
- Dexie 4.0.8 - IndexedDB wrapper for browser-side caching
- SurrealDB 1.0.6 - Client library for `apps/gui`
- LMDB (lmdb@latest) - Embedded key-value store via Deno

**Data Processing:**
- AJV 8.17.1 - JSON Schema validator
- marked 15.0.3 - Markdown parser
- DOMPurify 3.2.3 - HTML sanitizer
- brotli 1.3.3 - Compression
- compress-json 3.1.0 - JSON compression

**Utilities:**
- lodash 4.17.23 - Utility library
- chalk 5.4.1 - Terminal color output
- date-fns 4.1.0 - Date manipulation
- minisearch 7.1.0 - In-memory search
- p-queue 8.0.1 - Async queue manager
- ws 8.18.0 - WebSocket implementation
- cross-fetch 3.x - Isomorphic fetch
- promise-deferred - Promise utilities
- murmurhash - Hash function

**Internal Workspace Packages:**
All linked via workspace protocol (`workspace:^`):
- `@nostrwatch/nocap` - Relay capability checker
- `@nostrwatch/route66` - NIP-66 aggregation
- `@nostrwatch/auditor` - Relay validation
- `@nostrwatch/websocket` - Isomorphic WebSocket wrapper
- `@nostrwatch/utils` - Shared utilities
- `@nostrwatch/publisher` - Event publishing
- `@nostrwatch/logger` - Logging library
- `@nostrwatch/announce` - Event announcements
- `@nostrwatch/db` - Database for agents
- `@nostrwatch/controlflow` - Backoff and queue management
- `@nostrwatch/seed` - Relay seeding
- `@nostrwatch/relay-charts` - Chart components
- `@nostrwatch/relay-chronicle` - Relay history
- `@nostrwatch/schemata-js-ajv` - JSON schema validation
- `@nostrwatch/memory-relay` - In-memory relay
- `@nostrwatch/worker-relay` - Worker-based relay

## Configuration

**Environment:**
- .env files supported (see deploy scripts in `apps/gui/scripts/deploy-bunny.mjs`)
- Environment variables used for Bunny CDN deployment:
  - `BUNNY_STORAGE_ENDPOINT`
  - `BUNNY_STORAGE_ZONE_NAME`
  - `BUNNY_STORAGE_ZONE_PASSWORD`
  - `BUNNY_API_KEY` (optional)
  - `BUNNY_PULL_ZONE_ID` (optional)

**Build:**
- vite.production.js - Vite production config for `apps/gui`
- vitest.config.js - Vitest test runner config
- tsconfig.json files per package
- _tsconfig.json - Root TypeScript base config

**Formatting:**
- .prettierrc.yaml - Prettier configuration with:
  - No semicolons
  - Arrow function parens: avoid
  - Single quotes
  - 80 character line width
  - Trailing commas: off
  - Use spaces (not tabs)

**Code Style:**
- .eslintrc.yml - ESLint configuration (extends eslint:recommended)

## Platform Requirements

**Development:**
- Node.js >= 20
- pnpm >= 8
- Git (for repository operations)
- Deno (for `apps/relaymon` and `apps/trawler`)

**Production:**
- Node.js runtime for web apps (`apps/gui`, `apps/rstate`)
- Deno runtime for agents (`apps/relaymon`, `apps/trawler`)
- Docker support (Docker Compose files in `.docker` directories)

## Docker Support

- Dockerfile configurations in `apps/relaymon/.docker/` and `apps/trawler/.docker/`
- Docker Compose files for build orchestration:
  - docker-compose.build.yml
  - docker-compose.build-multinet.yml
  - docker-compose.build-clearnet-suite.yml
  - docker-compose.build-multinet-suite.yml

## CI/CD

- GitHub Actions workflows in `.github/workflows/`:
  - docker-relaymon.yml - Docker build for relaymon
  - docker-trawler.yml - Docker build for trawler
  - daily-seeded-gui-deploy.yml - Daily deployment of seeded GUI
  - publish-package.yml - Package publishing via changesets

---

*Stack analysis: 2026-03-04*
