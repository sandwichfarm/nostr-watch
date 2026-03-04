# Project Research Summary

**Project:** nostr-watch developer documentation site
**Domain:** Developer documentation SPA for a TypeScript/Nostr monorepo (30+ packages)
**Researched:** 2026-03-04
**Confidence:** HIGH (core stack and architecture), MEDIUM (Claude Code skills patterns)

## Executive Summary

This project is a greenfield developer documentation system built on top of a brownfield codebase. The deliverables are four interlinked artifacts: per-package README.md files, Claude Code skill files, a unified documentation SPA deployed to `developers.nostr.watch`, and an enforced README styleguide. The primary audiences are human contributors to nostr-watch and AI agents (Claude Code) working in the codebase — not end users of the relay monitoring product itself. Research strongly recommends VitePress 1.6.4 as the documentation site generator over mkdocs-material (maintenance mode since November 2025) or Zensical (alpha status), with the existing Bunny CDN deploy script reused for deployment.

The recommended architecture follows a layered pattern: source content lives co-located with each package (README.md + optional docs/ subdirectory), aggregated via VitePress rewrites config into a unified build, deployed as a static SPA to Bunny CDN. Claude Code skills live in `.claude/skills/` at both monorepo and package levels, auto-discovered by the agent without any extra configuration. The most critical architectural decision is using VitePress's built-in rewrites config for monorepo routing rather than any external plugin, keeping the toolchain purely Node-based with no Python dependency.

The primary risks are documentation consistency without enforcement (styleguide exists on paper only), docs staleness due to no CI ownership model, and Claude Code skills that never trigger because descriptions use internal vocabulary rather than the natural language of task-oriented queries. All three risks have clear mitigations: a CI-enforced README validator before any package docs are written, a link-freshness check in CI, and evaluation-driven skill description writing with 3+ trigger phrase tests per skill.

## Key Findings

### Recommended Stack

VitePress 1.6.4 is the clear choice for this TypeScript monorepo. It lives in the same Node/pnpm ecosystem as the codebase, requires no Python, and has native `rewrites` config for mapping package docs to clean URLs. mkdocs-material entered maintenance mode in November 2025 (critical fixes only through November 2026); mkdocs itself has been unmaintained since August 2024 and the mkdocs-material team calls it a supply chain risk. Zensical, the mkdocs successor, is PyPI Dev Status 3 (Alpha) at v0.0.24 with no feature parity yet. Docusaurus adds React/MDX overhead for zero benefit — all docs here are plain Markdown.

**Core technologies:**
- **VitePress 1.6.4**: Documentation site generator — native monorepo rewrites, same toolchain as codebase, no Python dependency, sub-second HMR
- **VitePress rewrites config** (built-in): Monorepo routing — maps `packages/*/docs/*.md` to clean URLs, no external plugin required
- **markdownlint-cli2 0.21.0**: README linting — configuration-file-driven, faster than predecessor, actively maintained by core library author
- **lychee** (latest Rust binary): Dead link checking — dramatically faster than Node-based alternatives for CI on large repos
- **Existing `apps/gui/scripts/deploy-bunny.mjs`**: CDN deployment — already production-tested, native Node fetch, no SDK dependencies
- **Claude Code Agent Skills standard**: AI agent guidance — `.claude/skills/<name>/SKILL.md` at project and package levels, auto-discovered

### Expected Features

The dual audience (humans + AI agents) shapes the feature set. Documentation for 30+ packages where many are alpha, deprecated, or being rewritten requires strong status signaling and depth tiering — internal utilities should not get the same treatment as public-facing adapter libraries.

**Must have (table stakes):**
- README styleguide with CI enforcement before any package README is written
- README.md for every package (apps, libraries, internal) — consistent format, stubs for deprecated, full docs for active
- VitePress configuration with monorepo rewrites, Material theme equivalent, search enabled
- Package discovery index — all packages listed with type, status, one-line description, link
- Docs build pipeline — VitePress build producing deployable static output
- Bunny CDN deployment resolving to `developers.nostr.watch`
- Core monorepo operation skills — adding packages, running tests, publishing, deploying
- Site-wide search (VitePress built-in)
- Status and deprecation notices inline in READMEs

**Should have (competitive differentiators):**
- Adapter creation skills (nocap, route66, publisher) — the primary extension mechanism for this codebase
- NIP-66 protocol skill — custom-built protocol with no external reference, high agent value
- Debugging skills for common failure modes — relay connection, state sync, OPFS, pnpm workspace errors
- Dependency graph section in package READMEs (textual, human-maintained)
- Progressive disclosure in skills — SKILL.md under 500 lines, with `reference/` and `examples/` supporting files
- "Known Limitations" sections cross-referenced against CONCERNS.md for brownfield packages
- Agent Skills auto-discovery via package-level `.claude/skills/` directories

**Defer (v2+):**
- "When to use X vs Y" comparison pages — requires real contributor feedback first
- Automated README freshness checks — CI job that flags docs-code drift; only justified once docs are in active use
- Per-package build/test status badges — requires CI integration, not blocking
- Auto-generated API reference from TypeScript (TypeDoc) — creates maintenance burden, second source of truth

**Anti-features (deliberately excluded):**
- Auto-generated TypeDoc API reference
- Versioned documentation
- User-facing end-user guides (wrong audience)
- Interactive API playgrounds
- Internationalization

### Architecture Approach

The architecture is a four-layer pipeline: Source (co-located package READMEs + optional docs/) → Aggregation (VitePress rewrites config merging all packages) → Build (VitePress static output) → Delivery (existing deploy-bunny.mjs to Bunny CDN). Package README.md files serve double duty: they render on GitHub and become the index page for each package in the VitePress SPA. Claude Code skills live in `.claude/skills/` outside the docs tree and are not part of the VitePress build — READMEs link to them, and a human-authored `docs/skills/index.md` describes them for SPA visitors.

**Major components:**
1. **Package README.md** — Primary human-facing docs and VitePress index page for each package; serves GitHub and SPA simultaneously
2. **VitePress rewrites config** — Aggregates 30+ packages into unified nav via glob patterns; new packages auto-appear when their doc files are created
3. **`docs/` (root-level)** — Landing page, styleguide, glossary with auto-tooltips, skills inventory page
4. **`.claude/skills/`** — Claude Code runtime artifacts for agent task execution; separate from VitePress build
5. **deploy-bunny.mjs** — Adapted from existing GUI deploy script; walks VitePress build output, uploads to Bunny Storage, purges CDN cache
6. **CI pipeline (GitHub Actions)** — markdownlint-cli2 + lychee on PR; VitePress build + Bunny deploy on merge to main

**Key patterns:**
- README as single source of truth (README-first, add `docs/` only when content exceeds ~500 lines or covers genuinely distinct topics)
- Glob-based routing in VitePress rewrites (no hand-maintained package lists)
- Agent Skills section as the last README section (always findable, never clutters human content)
- Centralized glossary with auto-tooltips for Nostr domain terms (NIP-66, nocap, route66, OPFS, LMDB)
- Progressive disclosure in skills (SKILL.md overview + `reference/` files loaded on demand)

### Critical Pitfalls

1. **Styleguide without enforcement** — Write a README validator script that checks required section headings in order and add it to CI before any package README is written. Styleguide sections must be expressed as machine-checkable predicates ("README MUST contain `## Agent Skills` heading") not vague prose.

2. **Docs go stale immediately** — Never copy-paste type signatures or implementation details into READMEs; link to source instead. Add a CHANGELOG hook in CI that warns (soft block) when a PR modifies `src/` in a package without touching its README. Run lychee link checker on every PR.

3. **Manual mkdocs/VitePress nav for 30+ packages** — Use VitePress `rewrites` with glob patterns from day one. Never maintain a hand-written list of packages in the config. With 30+ packages, manual nav maintenance fails immediately.

4. **Claude Code skills with vague descriptions that never trigger** — Write descriptions in third person with both the task description and explicit trigger phrases using common alternative vocabulary ("transport", "plugin", "backend"). Test each skill with 5+ natural language phrasings before shipping. Descriptions under 50 characters are a warning sign.

5. **Brownfield documented as aspirational, not actual** — Cross-reference every package README against `CONCERNS.md`. Packages with known tech debt (SDK stubs, `@ts-nocheck`, incomplete validation) need a "Known Limitations" section. Skills for fragile areas must include explicit caveats before code examples.

## Implications for Roadmap

The architecture research produces a clear build order with hard dependencies between phases. The styleguide and VitePress config are blockers for everything else. Claude Code skills are best written after READMEs are stable. Deployment infrastructure can be set up early but only validated after the build pipeline works.

### Phase 1: Foundation — Styleguide and Infrastructure

**Rationale:** Everything else depends on this. The README styleguide must exist and be enforced before any package README is written. The VitePress configuration must prove the monorepo routing works with zero packages before adding 30+. The README validator CI step must be passing before authors start writing. Building this foundation first eliminates the largest category of pitfalls.

**Delivers:** README styleguide (machine-enforceable), VitePress config with glob rewrites for monorepo, root docs (index, glossary with domain terms), README CI validator, markdownlint-cli2 + lychee configured in GitHub Actions, `docs/skills/index.md` placeholder

**Addresses:** README styleguide (P1), mkdocs configuration (P1), docs build pipeline (P1)

**Avoids:** Styleguide-without-enforcement (Pitfall 1), manual nav maintenance (Pitfall 3), asset path breakage (Pitfall 7)

### Phase 2: Internal Package READMEs

**Rationale:** Internal packages (publisher, kinds, logger, utils, etc.) are the simplest — no adapter complexity, smaller consumer surface. Documenting them first proves the per-package pattern end-to-end with lower stakes. These packages should get shorter READMEs by design (depth tiered by consumer surface). Establishes the vocabulary and cross-references used by later, more complex packages.

**Delivers:** README.md for all `internal/` packages following styleguide; per-package VitePress routes verified; "Known Limitations" sections for packages with CONCERNS.md entries; deprecation notices for deprecated internal packages

**Addresses:** READMEs for every package (P1), deprecation notices (P1)

**Avoids:** Over-documenting internals (Pitfall 5), brownfield-as-aspirational (Pitfall 11)

### Phase 3: Library Package READMEs

**Rationale:** Libraries are more complex than internal packages — several (nocap, route66, publisher) have adapter patterns that are the primary extension mechanism for the entire codebase. These packages need `docs/` subdirectories. They also have more cross-package references, which can only be written correctly once the internal package docs from Phase 2 exist. Adapter-bearing libraries are the highest-value documentation target.

**Delivers:** README.md for all `libraries/` packages; `docs/adapters.md` for nocap; `docs/state-management.md` for route66; cross-package dependency graphs (textual); "When to use X vs Y" positioning for packages with overlapping scope (db vs idb)

**Addresses:** READMEs for every package (P1), dependency graph sections (P2), docs/ for complex packages (P2)

**Avoids:** Under-documenting integration points (Pitfall 5), brownfield-as-aspirational (Pitfall 11)

### Phase 4: App Package READMEs

**Rationale:** Apps (gui, rstate, trawler, relaymon) reference both libraries and internal packages and are the most complex to document correctly. They should be written last because they reference the package docs established in Phases 2 and 3. Apps also tend to have the most tech debt and the most CONCERNS.md entries — documenting them last ensures Known Limitations are informed by the full picture.

**Delivers:** README.md for all `apps/` packages; cross-reference links to library docs now written; Known Limitations sections with CONCERNS.md references for each app

**Addresses:** READMEs for every package (P1), brownfield concerns surfaced (correctness requirement)

**Avoids:** Brownfield-as-aspirational (Pitfall 11)

### Phase 5: Claude Code Skills

**Rationale:** Skills should be written after READMEs are stable because skills reference specific patterns, function names, and file paths that are established during the README phases. Writing skills before READMEs risks vocabulary mismatch and rework. Adapter creation skills (nocap, route66, publisher) are the highest-value skills — they encode the primary extension mechanism. NIP-66 and debugging skills follow.

**Delivers:** Core monorepo operation skills (add-package, run-tests, publish, deploy); adapter creation skills (nocap, route66, publisher) with progressive disclosure structure; NIP-66 protocol skill; debugging skills for common failure modes; package-level `.claude/skills/` for packages with complex patterns; updated docs/skills/index.md

**Addresses:** Monorepo operation skills (P1), adapter creation skills (P2), NIP-66 skill (P2), debugging skills (P2)

**Avoids:** Vague skill descriptions (Pitfall 4), skill files too long (Pitfall 9), CLAUDE.md/skills divergence (Pitfall 6)

### Phase 6: Deployment and CI Pipeline

**Rationale:** Deployment infrastructure can be scaffolded early but fully validated only once the build pipeline is stable. The Bunny CDN deploy script (adapted from `apps/gui/scripts/deploy-bunny.mjs`) is straightforward — the risk is in CDN cache behavior, not the script itself. The CI pipeline should enforce the full chain: lint → build → deploy.

**Delivers:** `scripts/deploy-docs-bunny.mjs` adapted for VitePress output; GitHub Actions workflow for PR (lint + build) and main (build + deploy); post-deploy smoke test verifying CDN content; `developers.nostr.watch` live

**Addresses:** Bunny CDN deployment (P1), CI pipeline (foundation)

**Avoids:** CDN cache serving stale docs (Pitfall 8)

### Phase Ordering Rationale

- **Styleguide before all READMEs:** The single hardest-to-recover-from pitfall is writing 30 READMEs without a styleguide and then discovering inconsistency. Recovery cost is HIGH (rewrite phase). Prevention cost is LOW (one validator script).
- **VitePress config before content:** Proving the monorepo routing works with zero packages catches structural errors before any content is invested. Adding packages to a broken config is harder to debug than adding config to a working structure.
- **Internal before libraries before apps:** Follows the dependency graph — apps reference libraries which reference internal packages. Writing in dependency order means cross-reference links are never stubs.
- **Skills after READMEs:** Skills reference specific function names, config keys, and file paths. Writing them against stable READMEs avoids rework. Adapter skills for nocap, route66, and publisher require deep understanding that the README-writing phase builds.
- **Deployment last:** Low complexity (script adaptation is trivial), high dependency on everything else being stable. CDN configuration should not be in flux during content phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Skills):** Claude Code skills description writing and trigger evaluation is a newer standard with less settled community practice. Skill descriptions that fail to trigger are invisible failures. Research into evaluation-driven skill authoring patterns recommended before this phase.
- **Phase 3 (Library READMEs):** nocap adapter pattern, route66 state management, and publisher lifecycle each need deeper codebase analysis before docs can be written correctly. The CONCERNS.md analysis for these packages should precede the planning step.

Phases with standard patterns (skip additional research):
- **Phase 1 (Foundation):** VitePress configuration is well-documented with official guides. Monorepo rewrites config is a first-class VitePress feature. markdownlint-cli2 and lychee have clear documentation.
- **Phase 6 (Deployment):** The existing deploy-bunny.mjs script is the implementation reference. Pattern is fully established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | VitePress, markdownlint-cli2, lychee all verified against official docs. mkdocs deprecation confirmed from official announcement. Zensical alpha status confirmed from PyPI. |
| Features | HIGH (table stakes), MEDIUM (agent skills) | README and docs site features are well-established patterns. Claude Code skills format is a newer standard (2025) with less community history. |
| Architecture | HIGH | Four-layer pipeline pattern verified against official VitePress and monorepo docs. Existing deploy-bunny.mjs confirmed from codebase. |
| Pitfalls | HIGH (critical), MEDIUM (moderate) | Critical pitfalls verified from official Anthropic skills docs and mkdocs-monorepo-plugin docs. Moderate pitfalls from community sources and codebase analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **Skill description evaluation methodology:** Official Anthropic docs are clear that description quality is critical and recommend testing with multiple phrasings, but specific evaluation tooling for this is not documented. Handle by writing evaluation tests manually and verifying trigger behavior with Claude Code directly during the skills phase.
- **VitePress rewrites and image asset handling:** It is not confirmed from research whether VitePress rewrites config correctly resolves relative image paths in package READMEs (the `libraries/auditor/README.md` uses `.assets/` relative paths). Validate early in Phase 1 with a real example before migrating all content.
- **mkdocs-monorepo-plugin `*include` glob version requirement:** Research cites v0.5.2+ for glob syntax. Since STACK.md recommends VitePress instead of mkdocs, this is moot — but any residual mkdocs tooling used for comparison must use v0.5.2+.
- **Bunny replication delay:** The 15-second wait before purge is MEDIUM confidence (community guides, not official Bunny docs). Validate empirically during Phase 6 by monitoring CDN propagation timing.

## Sources

### Primary (HIGH confidence)
- VitePress routing/rewrites — https://vitepress.dev/guide/routing (verified 2026-03-04)
- VitePress getting started — https://vitepress.dev/guide/getting-started
- Claude Code Skills official docs — https://code.claude.com/docs/en/skills
- Anthropic Skills authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- mkdocs-material maintenance mode announcement — https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/
- Zensical PyPI status — https://pypi.org/project/zensical/
- markdownlint-cli2 — https://github.com/DavidAnson/markdownlint-cli2
- lychee link checker — https://github.com/lycheeverse/lychee
- mkdocs-monorepo-plugin GitHub (glob `*include` syntax) — https://github.com/backstage/mkdocs-monorepo-plugin
- mkdocs-monorepo-plugin limitations — https://backstage.github.io/mkdocs-monorepo-plugin/limitations/
- Material for MkDocs tooltips/snippets — https://squidfunk.github.io/mkdocs-material/reference/tooltips/
- Existing deploy script — `apps/gui/scripts/deploy-bunny.mjs` (codebase, direct read)
- Codebase analysis files — `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md`

### Secondary (MEDIUM confidence)
- Claude Code skills community deep-dive — https://mikhail.io/2025/10/claude-code-skills/
- Bunny CDN static site deployment (replication delay) — https://european-alternatives.eu/blog/how-to-host-a-static-site-on-bunny-net-cdn-with-automatic-deployment
- AI coding agent context file maintenance — https://packmind.com/evaluate-context-ai-coding-agent/
- Docs linting CI integration — https://buildwithfern.com/post/docs-linting-guide
- Codified context scaling limits — https://arxiv.org/html/2602.20478v1

### Tertiary (LOW confidence / not relied upon)
- Zensical feature parity with mkdocs-material — not fully documented; treat as unknown until beta

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
