# Requirements: nostr-watch Documentation

**Defined:** 2026-03-04
**Core Value:** Every package in the monorepo has clear, consistent, useful documentation that serves both human developers and AI agents.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: README styleguide defines consistent section order (header, badges, overview, prerequisites, install, usage, API, config, agent skills, related packages, contributing, license)
- [x] **FOUND-02**: README styleguide defines badge standards (build status, version, license, runtime support)
- [x] **FOUND-03**: README styleguide defines code example format (language tags, import style, realistic minimal examples)
- [x] **FOUND-04**: README styleguide defines tone/voice guide (audience assumptions, level of explanation, writing style)
- [x] **FOUND-05**: CI enforcement validates README format via markdownlint-cli2 in GitHub Actions
- [x] **FOUND-06**: CI enforcement validates links via lychee link checker in GitHub Actions
- [x] **FOUND-07**: VitePress configuration aggregates all package docs into unified site with search and navigation
- [x] **FOUND-08**: Package discovery index page lists all 30+ packages with type, status, one-line description, and link

### App READMEs

- [ ] **APP-01**: README.md for apps/gui following styleguide (Svelte/SvelteKit relay dashboard)
- [ ] **APP-02**: README.md for apps/rstate following styleguide (ContextVM relay state machine + REST API)
- [ ] **APP-03**: README.md for apps/trawler following styleguide (Deno relay data crawler)
- [ ] **APP-04**: README.md for apps/relaymon following styleguide (relay health monitoring)
- [ ] **APP-05**: README.md for apps/purist following styleguide (data transformation utilities)
- [ ] **APP-06**: Deprecation stub README for apps/nocapd (legacy daemon, link to replacement)
- [ ] **APP-07**: README.md for apps/docker-stacks following styleguide (Docker Compose definitions)
- [ ] **APP-08**: README.md or deprecation stub for apps/umon following styleguide (experimental monitoring)

### Library READMEs

- [x] **LIB-01**: README.md for libraries/nocap following styleguide (adapter-based relay capability discovery)
- [x] **LIB-02**: README.md for libraries/route66 following styleguide (relay aggregation + state management)
- [x] **LIB-03**: README.md for libraries/auditor following styleguide (Nostr event validation)
- [ ] **LIB-04**: README.md for libraries/schemata following styleguide (JSON Schema definitions)
- [ ] **LIB-05**: README.md for libraries/schemata-js-ajv following styleguide (AJV validation)
- [ ] **LIB-06**: README.md for libraries/relay-charts following styleguide (relay metric visualization)
- [ ] **LIB-07**: README.md for libraries/relay-chronicle following styleguide (relay event history)
- [ ] **LIB-08**: README.md for libraries/nostrawl following styleguide (queue-based web crawler)
- [ ] **LIB-09**: README.md for libraries/db following styleguide (database client abstractions)
- [ ] **LIB-10**: README.md for libraries/idb following styleguide (IndexedDB wrapper)
- [ ] **LIB-11**: README.md for libraries/websocket following styleguide (WebSocket connection management)
- [ ] **LIB-12**: README.md for libraries/nip66 following styleguide (NIP-66 relay check protocol)
- [ ] **LIB-13**: README.md for libraries/nostrings following styleguide (relay URL validation)
- [ ] **LIB-14**: README.md for libraries/memory-relay following styleguide (in-memory relay)
- [ ] **LIB-15**: README.md for libraries/negentropy following styleguide (NIP-49 support)
- [ ] **LIB-16**: README.md for libraries/worker-relay following styleguide (web worker relay)
- [ ] **LIB-17**: README.md for libraries/uptime-kuma-monitor following styleguide (uptime monitoring)

### Internal Package READMEs

- [x] **INT-01**: README.md for internal/utils following styleguide (shared utility functions)
- [x] **INT-02**: README.md for internal/publisher following styleguide (event publishing with adapters)
- [x] **INT-03**: README.md for internal/logger following styleguide (structured logging)
- [x] **INT-04**: README.md for internal/announce following styleguide (announcement system)
- [x] **INT-05**: README.md for internal/nwcache following styleguide (caching layer)
- [x] **INT-06**: README.md for internal/redis following styleguide (Redis integration)
- [x] **INT-07**: README.md for internal/controlflow following styleguide (control flow utilities)
- [x] **INT-08**: README.md for internal/kinds following styleguide (Nostr event kind registry)
- [x] **INT-09**: README.md for internal/seed following styleguide (seed data management)

### Known Limitations

- [x] **LIMIT-01**: Each README surfaces relevant issues from CONCERNS.md in a "Known Limitations" section
- [x] **LIMIT-02**: Deprecated packages have prominent deprecation notice with link to replacement

### Claude Code Skills

- [ ] **SKILL-01**: Monorepo operations skill covering adding packages, running tests, publishing, deploying
- [ ] **SKILL-02**: Adapter creation skill for nocap adapters (DNS, Info, SSL, WebSocket, Geo)
- [ ] **SKILL-03**: Adapter creation skill for publisher adapters (NostrTools pattern)
- [ ] **SKILL-04**: Adapter creation skill for route66 adapters
- [ ] **SKILL-05**: NIP-66 protocol skill covering event kinds, aggregation rules, publisher flow, validation
- [ ] **SKILL-06**: Debugging skill for relay connection failures
- [ ] **SKILL-07**: Debugging skill for state sync issues (route66/GUI stores)
- [ ] **SKILL-08**: Debugging skill for pnpm workspace build failures
- [ ] **SKILL-09**: Each README has "Agent Skills" section linking relevant .claude/skills/ paths

### Deployment

- [ ] **DEPLOY-01**: VitePress build command produces deployable static output from all package docs
- [ ] **DEPLOY-02**: Bunny CDN deploy script uploads built docs to developers.nostr.watch
- [ ] **DEPLOY-03**: GitHub Actions workflow builds and deploys docs on merge to main

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Content

- **ENH-01**: docs/ subdirectory with deeper docs for complex packages (rstate, nocap, route66)
- **ENH-02**: "When to use X vs Y" comparison pages for overlapping packages
- **ENH-03**: Dependency graph section in package READMEs showing upstream/downstream
- **ENH-04**: Automated README freshness checks flagging stale docs in CI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-generated API reference (TypeDoc/TSDoc) | Creates maintenance burden; manual prose summaries are more useful |
| Versioned documentation | Single current version; adds infrastructure complexity |
| User-facing end-user guides | Wrong audience; this is developer docs |
| Internationalization | Not needed for technical contributor audience |
| Interactive API playgrounds | High complexity, low value for relay monitoring stack |
| Comprehensive tutorial sequences | Goes stale quickly; prefer minimal usage examples |
| Changelog aggregation in site | Changelogs belong with code; duplicating creates drift |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| FOUND-07 | Phase 1 | Complete |
| FOUND-08 | Phase 1 | Complete |
| LIMIT-01 | Phase 1 | Complete |
| LIMIT-02 | Phase 1 | Complete |
| INT-01 | Phase 2 | Complete |
| INT-02 | Phase 2 | Complete |
| INT-03 | Phase 2 | Complete |
| INT-04 | Phase 2 | Complete |
| INT-05 | Phase 2 | Complete |
| INT-06 | Phase 2 | Complete |
| INT-07 | Phase 2 | Complete |
| INT-08 | Phase 2 | Complete |
| INT-09 | Phase 2 | Complete |
| LIB-01 | Phase 3 | Complete |
| LIB-02 | Phase 3 | Complete |
| LIB-03 | Phase 3 | Complete |
| LIB-04 | Phase 3 | Pending |
| LIB-05 | Phase 3 | Pending |
| LIB-06 | Phase 3 | Pending |
| LIB-07 | Phase 3 | Pending |
| LIB-08 | Phase 3 | Pending |
| LIB-09 | Phase 3 | Pending |
| LIB-10 | Phase 3 | Pending |
| LIB-11 | Phase 3 | Pending |
| LIB-12 | Phase 3 | Pending |
| LIB-13 | Phase 3 | Pending |
| LIB-14 | Phase 3 | Pending |
| LIB-15 | Phase 3 | Pending |
| LIB-16 | Phase 3 | Pending |
| LIB-17 | Phase 3 | Pending |
| APP-01 | Phase 4 | Pending |
| APP-02 | Phase 4 | Pending |
| APP-03 | Phase 4 | Pending |
| APP-04 | Phase 4 | Pending |
| APP-05 | Phase 4 | Pending |
| APP-06 | Phase 4 | Pending |
| APP-07 | Phase 4 | Pending |
| APP-08 | Phase 4 | Pending |
| SKILL-01 | Phase 5 | Pending |
| SKILL-02 | Phase 5 | Pending |
| SKILL-03 | Phase 5 | Pending |
| SKILL-04 | Phase 5 | Pending |
| SKILL-05 | Phase 5 | Pending |
| SKILL-06 | Phase 5 | Pending |
| SKILL-07 | Phase 5 | Pending |
| SKILL-08 | Phase 5 | Pending |
| SKILL-09 | Phase 5 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |
| DEPLOY-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
