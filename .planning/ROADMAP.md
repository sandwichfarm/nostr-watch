# Roadmap: nostr-watch Documentation

## Overview

Six phases build the complete nostr-watch developer documentation system. Foundation comes first — the README styleguide and VitePress configuration must exist and be enforced before any package README is written. Package READMEs follow in dependency order: internal packages (simplest, lowest consumer surface) → libraries (adapter patterns, cross-references to internals) → apps (most complex, reference everything). Claude Code skills are written after READMEs stabilize so they reference accurate function names and file paths. Deployment closes the loop with the CI pipeline and Bunny CDN delivery to developers.nostr.watch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - README styleguide, CI enforcement, VitePress config, and documentation standards that all later phases depend on (completed 2026-03-04)
- [x] **Phase 2: Internal Package READMEs** - README.md for all 9 internal/ packages following styleguide (completed 2026-03-04)
- [ ] **Phase 3: Library Package READMEs** - README.md for all 17 libraries/ packages including adapter-pattern documentation
- [ ] **Phase 4: App Package READMEs** - README.md for all 8 apps/ packages with deprecation stubs where applicable
- [ ] **Phase 5: Claude Code Skills** - Monorepo operation, adapter creation, NIP-66, and debugging skills written against stable READMEs
- [ ] **Phase 6: Deployment and CI Pipeline** - VitePress build pipeline, Bunny CDN deploy script, and GitHub Actions workflow

## Phase Details

### Phase 1: Foundation
**Goal**: The README styleguide exists, is machine-enforced in CI, and the VitePress configuration aggregates all package docs into a working unified site structure — making it safe to write any package README
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, LIMIT-01, LIMIT-02
**Success Criteria** (what must be TRUE):
  1. A developer can read the styleguide and know exactly what sections to include, in what order, with what badge and code example format, for any package type
  2. Running `pnpm lint:docs` on a non-conforming README produces a clear error naming the missing or misordered section
  3. A PR with a broken Markdown link fails CI with lychee reporting the broken URL
  4. The VitePress dev server starts and renders a package discovery index listing all 30+ packages with type, status, description, and link
  5. The styleguide explicitly defines what a "Known Limitations" section and a deprecation stub look like, so any package author can produce a conforming example
**Plans**: TBD

Plans:
- [ ] 01-01: Write README styleguide (sections, badges, code examples, tone, Known Limitations template, deprecation stub template)
- [ ] 01-02: Configure VitePress with monorepo rewrites, search, navigation, and package discovery index page
- [ ] 01-03: Set up CI enforcement (markdownlint-cli2 + lychee GitHub Actions jobs)

### Phase 2: Internal Package READMEs
**Goal**: Every internal/ package has a conforming README.md that a developer or AI agent can read to understand what the package does, how to use it, and where it fits in the monorepo
**Depends on**: Phase 1
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08, INT-09
**Success Criteria** (what must be TRUE):
  1. A developer unfamiliar with the codebase can open any internal/ package README and understand what it does, what it exports, and when to use it within 2 minutes
  2. Every internal/ README passes the markdownlint-cli2 CI check without modification
  3. The VitePress site renders a route for each internal/ package with its README as the index page
  4. Packages with entries in CONCERNS.md have a "Known Limitations" section that accurately describes those concerns
**Plans:** 3/3 plans complete

Plans:
- [ ] 02-01: Write READMEs for internal/utils, internal/logger, internal/kinds (simplest utilities)
- [ ] 02-02: Write READMEs for internal/publisher, internal/controlflow, internal/announce (behavioral packages)
- [ ] 02-03: Write READMEs for internal/nwcache, internal/redis, internal/seed (infrastructure packages)

### Phase 3: Library Package READMEs
**Goal**: Every libraries/ package has a conforming README.md; adapter-bearing libraries (nocap, route66, publisher) have sufficient depth that an agent can create a new adapter without reading source code
**Depends on**: Phase 2
**Requirements**: LIB-01, LIB-02, LIB-03, LIB-04, LIB-05, LIB-06, LIB-07, LIB-08, LIB-09, LIB-10, LIB-11, LIB-12, LIB-13, LIB-14, LIB-15, LIB-16, LIB-17
**Success Criteria** (what must be TRUE):
  1. Every libraries/ README passes the markdownlint-cli2 CI check without modification
  2. The VitePress site renders a route for each library package with its README as the index page
  3. A developer can read the nocap README and understand what an adapter is, what interface it must implement, and how to register it — without reading source
  4. The NIP-66 library README explains the protocol's event kinds and data model clearly enough that a developer unfamiliar with NIP-66 understands what the library validates
  5. Libraries with entries in CONCERNS.md have accurate "Known Limitations" sections
**Plans**: TBD

Plans:
- [ ] 03-01: Write READMEs for libraries/nostrings, libraries/nip66, libraries/schemata, libraries/schemata-js-ajv, libraries/auditor (protocol/validation layer)
- [ ] 03-02: Write READMEs for libraries/nocap (adapter pattern — primary extension mechanism)
- [ ] 03-03: Write READMEs for libraries/route66 (state management adapter pattern)
- [ ] 03-04: Write READMEs for libraries/db, libraries/idb, libraries/websocket, libraries/memory-relay, libraries/worker-relay, libraries/negentropy (infrastructure layer)
- [ ] 03-05: Write READMEs for libraries/nostrawl, libraries/relay-charts, libraries/relay-chronicle, libraries/uptime-kuma-monitor (application-layer utilities)

### Phase 4: App Package READMEs
**Goal**: Every apps/ package has a conforming README.md or deprecation stub; deprecated apps clearly direct users to the replacement; Known Limitations sections reflect actual codebase state
**Depends on**: Phase 3
**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-07, APP-08
**Success Criteria** (what must be TRUE):
  1. Every apps/ README or deprecation stub passes the markdownlint-cli2 CI check without modification
  2. The VitePress site renders a route for each app with its README as the index page
  3. A developer opening apps/nocapd README immediately sees a prominent deprecation notice with a link to the replacement
  4. A developer reading any active app README understands how to run it locally, what environment variables it requires, and what other packages it depends on
  5. Apps with CONCERNS.md entries have accurate "Known Limitations" sections that describe known tech debt
**Plans**: TBD

Plans:
- [ ] 04-01: Write READMEs for apps/gui, apps/rstate (most complex apps — SvelteKit dashboard and ContextVM state machine)
- [ ] 04-02: Write READMEs for apps/trawler, apps/relaymon (data pipeline apps)
- [ ] 04-03: Write READMEs for apps/purist, apps/docker-stacks (utilities and infra)
- [ ] 04-04: Write deprecation stub for apps/nocapd; write README or stub for apps/umon

### Phase 5: Claude Code Skills
**Goal**: Claude Code agents working in this codebase can find and execute skills for all common operations — monorepo management, adapter creation, NIP-66, and debugging — without reading source code; every README's Agent Skills section links to the relevant skills
**Depends on**: Phase 4
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07, SKILL-08, SKILL-09
**Success Criteria** (what must be TRUE):
  1. An agent asked to "add a new package to the monorepo" triggers and successfully follows the monorepo-operations skill
  2. An agent asked to "create a nocap adapter for DNS checking" triggers the nocap adapter creation skill and produces a structurally correct adapter stub
  3. An agent encountering a relay connection failure can find and apply the debugging skill for that failure mode
  4. Every README's "Agent Skills" section names and links at least one relevant .claude/skills/ path
  5. Each skill file is under 500 lines; complex skills have reference/ subdirectory files loaded on demand
**Plans**: TBD

Plans:
- [ ] 05-01: Write SKILL-01 monorepo operations skill (add-package, run-tests, publish, deploy)
- [ ] 05-02: Write SKILL-02 (nocap adapters), SKILL-03 (publisher adapters), SKILL-04 (route66 adapters)
- [ ] 05-03: Write SKILL-05 NIP-66 protocol skill
- [ ] 05-04: Write SKILL-06 (relay connection debugging), SKILL-07 (state sync debugging), SKILL-08 (pnpm workspace build debugging)
- [ ] 05-05: Add SKILL-09 Agent Skills sections to all READMEs and update docs/skills/index.md

### Phase 6: Deployment and CI Pipeline
**Goal**: The complete docs pipeline runs end-to-end — VitePress builds all package docs into a deployable static site, the deploy script publishes to Bunny CDN, and the GitHub Actions workflow runs automatically on merge to main
**Depends on**: Phase 5
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. Running `pnpm docs:build` produces a deployable dist/ directory containing all package READMEs as routed HTML pages
  2. Running the deploy script uploads the built output to Bunny CDN and developers.nostr.watch serves the updated content within 60 seconds
  3. A PR merged to main automatically triggers the GitHub Actions docs workflow and developers.nostr.watch updates without any manual intervention
**Plans**: TBD

Plans:
- [ ] 06-01: Adapt deploy-bunny.mjs for VitePress output and configure Bunny CDN target
- [ ] 06-02: Write GitHub Actions workflow (PR: lint + build; main: build + deploy) and verify end-to-end

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-04 |
| 2. Internal Package READMEs | 3/3 | Complete   | 2026-03-04 |
| 3. Library Package READMEs | 0/5 | Not started | - |
| 4. App Package READMEs | 0/4 | Not started | - |
| 5. Claude Code Skills | 0/5 | Not started | - |
| 6. Deployment and CI Pipeline | 0/2 | Not started | - |
