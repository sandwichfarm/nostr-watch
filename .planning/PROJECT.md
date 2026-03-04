# nostr-watch Documentation

## What This Is

Systematic documentation of the nostr-watch monorepo — a Nostr relay monitoring platform with 10+ apps and 20+ libraries. Every package gets a consistently formatted README.md following a shared styleguide. Complex packages get deeper docs/ directories. Claude Code skills teach agents how to work within the codebase. The whole thing builds into a single SPA deployed to developers.nostr.watch via mkdocs.

## Core Value

Every package in the monorepo has clear, consistent, useful documentation that serves both human developers and AI agents working on the codebase.

## Requirements

### Validated

- ✓ Monorepo structure with pnpm workspaces (apps/, libraries/, internal/) — existing
- ✓ Codebase map in .planning/codebase/ (ARCHITECTURE, STACK, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) — existing
- ✓ GUI docs exist (docs/gui/ with proposal, HLDD, implementation plan) — existing, audit for reuse
- ✓ Some packages have README stubs — existing, audit for reuse
- ✓ Bunny CDN deployment pattern exists (apps/gui/scripts/deploy-bunny.mjs) — existing, evaluate for docs deploy

### Active

- [ ] README styleguide defining consistent format across all packages
- [ ] README.md for every app (gui, rstate, trawler, relaymon, nocapd, purist, umon, docker-stacks)
- [ ] README.md for every library (nocap, route66, auditor, schemata, schemata-js-ajv, relay-charts, relay-chronicle, nostrawl, db, idb, websocket, nip66, nostrings, memory-relay, negentropy, worker-relay, uptime-kuma-monitor)
- [ ] README.md for every internal package (utils, publisher, logger, announce, nwcache, redis, controlflow, kinds, seed)
- [ ] Claude Code skills for package-specific patterns
- [ ] Claude Code skills for cross-cutting monorepo operations (adding packages, running tests, publishing, deploying)
- [ ] Claude Code skills for adapter creation (nocap, publisher, route66)
- [ ] Claude Code skills for debugging common issues (relay connections, state sync, builds)
- [ ] Claude Code skill for NIP-66 protocol guidance
- [ ] Dedicated "Agent Skills" section in each README linking relevant skills
- [ ] mkdocs configuration aggregating all package docs into unified SPA
- [ ] Docs build pipeline (mkdocs build → static output)
- [ ] Docs deployment to Bunny CDN at developers.nostr.watch

### Out of Scope

- Rewriting or refactoring any application/library code — docs only
- API reference auto-generation from TypeScript (manual docs for now)
- Versioned documentation (single current version)
- User-facing guides for nostr-watch end users (this is developer docs)
- Internationalization of docs

## Context

- Monorepo has 30+ packages across apps/, libraries/, internal/ with inconsistent or missing docs
- Existing GUI docs (docs/gui/) contain valuable architectural context — audit and migrate
- Codebase uses adapter pattern extensively (nocap, publisher, route66) — adapter creation is a key skill
- NIP-66 is a custom Nostr protocol implemented by this project — needs dedicated guidance
- Bunny CDN is already used for GUI deployment — may reuse pattern for docs
- Target audience: developers contributing to nostr-watch and AI agents working on the codebase

## Styleguide Scope

The README styleguide must cover:
- **Consistent sections**: Every README follows the same section order (Overview, Install, Usage, API, Agent Skills, etc.)
- **Badge standards**: Consistent badges (build status, version, license, etc.)
- **Code example format**: Standards for code examples (language tags, imports, realistic vs minimal)
- **Tone/voice guide**: Writing style rules (audience assumptions, level of explanation)

## Constraints

- **Format**: All docs in Markdown — compatible with mkdocs
- **Location**: README.md at package root; docs/ subdirectory only for complex packages
- **Build tool**: mkdocs (or similar) for SPA generation
- **Deployment**: Bunny CDN, resolving to developers.nostr.watch
- **Skills format**: Claude Code skills (YAML frontmatter .md files)
- **Existing docs**: Audit and preserve valuable content, reformat to match styleguide

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single comprehensive README per package (not split overview/details) | Keeps docs discoverable; docs/ only for genuinely complex packages | — Pending |
| mkdocs for SPA build | Standard tool for markdown → site; good monorepo plugin ecosystem | — Pending |
| Claude Code skills over generic guides | Skills are directly actionable by agents; more specific than prose guides | — Pending |
| All packages documented (not just public) | Internal packages need docs too — agents work across the whole monorepo | — Pending |
| Dedicated "Agent Skills" section in READMEs | Clear discoverability without cluttering the human-focused docs | — Pending |

---
*Last updated: 2026-03-04 after initialization*
