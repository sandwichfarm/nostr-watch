# Feature Research

**Domain:** Developer documentation site for a TypeScript/Nostr monorepo (30+ packages)
**Researched:** 2026-03-04
**Confidence:** HIGH (README/docs patterns), MEDIUM (agent skill patterns — newer standard, less settled)

---

## Context

This research covers features for a GREENFIELD documentation project built on top of a BROWNFIELD
codebase. The target output is:

1. **Per-package README.md files** — human and agent readable, consistent format
2. **Claude Code skills** — `.claude/skills/` YAML+markdown files for agent-specific guidance
3. **mkdocs SPA** — unified docs site at `developers.nostr.watch`, aggregating all package docs
4. **Styleguide** — enforces consistency across all 30+ packages

Primary audiences: human contributors to nostr-watch, and AI agents (Claude Code) working on the
codebase. NOT end-users of the relay monitoring product.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a developer docs system must have. Missing these = docs feel incomplete or unusable.

#### README Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Package overview / purpose statement | First thing any reader needs — what does this do? | LOW | One paragraph, problem-first framing |
| Installation instructions | Developers can't use the package without this | LOW | `pnpm add @nostrwatch/[pkg]` format; workspace vs. standalone |
| Basic usage example | Shows the API in practice before diving into docs | LOW | Minimal working example, not a tutorial |
| API surface summary | What functions/classes/types are exported | MEDIUM | Table or list; links to deeper docs for complex packages |
| Environment / runtime support table | nostr-watch targets web, Node, Deno — must be explicit | LOW | Already in root README as a table; replicate per package |
| Prerequisites / peer dependencies | Prevents "why doesn't this work" frustration | LOW | e.g., "requires Redis", "requires Deno 2.x" |
| Status badge (alpha/beta/stable/deprecated) | Sets expectations; many packages are alpha or deprecated | LOW | Already used in root README; standardize the format |
| Build / test commands | Contributors need this immediately | LOW | pnpm commands scoped to package |
| License section | Standard open source expectation | LOW | Apache-2.0 per existing repo LICENSE |
| Link to full docs / deeper reading | README is entry point, not the full story | LOW | Links to docs/ subdirectory or SPA URL |

#### Documentation Site Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Site-wide search | Developers search, they don't browse | MEDIUM | Material for MkDocs includes lunr.js search out of the box |
| Package index / discovery page | 30+ packages — developers need a map | LOW | Single page listing all packages with type, status, description |
| Consistent navigation structure | Every package page should feel the same | LOW | MkDocs nav config handles this |
| Code syntax highlighting | Developer docs with unstyled code is unacceptable | LOW | MkDocs Material handles this out of the box |
| Mobile-responsive layout | Standard web expectation in 2026 | LOW | Material theme is responsive by default |
| Stable, bookmarkable URLs | Links shared in issues, PRs, Slack must persist | LOW | MkDocs URL structure is stable |
| Cross-package links | Libraries reference each other; docs must too | MEDIUM | MkDocs relative links + monorepo-plugin handles this |

#### Agent Skill Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| YAML frontmatter with name + description | Required for Claude Code skill discovery | LOW | `name`, `description` fields; description is how Claude decides to use the skill |
| Slash-command invocability | Standard Claude Code skill pattern | LOW | `/skill-name` invocation requires correct `name` field |
| Package-specific context skills | Each adapter pattern (nocap, route66, publisher) needs a skill | MEDIUM | One skill per adapter type; loaded automatically when editing that adapter |
| Monorepo operation skills | Adding packages, publishing, running tests across workspace | MEDIUM | Cross-cutting skills at root `.claude/skills/` |
| Agent Skills section in each README | Links skill file from human-readable docs | LOW | Standard section at bottom of each README; links `.claude/skills/` paths |

---

### Differentiators (Competitive Advantage)

Features that would make `developers.nostr.watch` notably better than generic open source docs.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Adapter creation skills (nocap, route66, publisher) | Adapter pattern is the core extension mechanism — agents that can create correct adapters without manual guidance are a force multiplier | HIGH | Each adapter system has its own contract and lifecycle; skills need examples + reference files |
| NIP-66 protocol skill | NIP-66 is custom-built here; no external reference exists | MEDIUM | Covers event kind structure, aggregation rules, publisher flow, validation expectations |
| Debugging skills for common failure modes | Relay connection failures, state sync issues, OPFS contention, build errors in pnpm workspaces are all recurring | HIGH | Requires gathering real failure patterns from the codebase first |
| Dependency graph section in package READMEs | "What depends on this?" and "What does this depend on?" makes architectural reasoning faster | MEDIUM | Can be generated from pnpm workspace graph; keep human-maintained so it stays accurate |
| Status and deprecation notices inline | Several packages are deprecated or being rewritten (nocapd, nwcache, schemata, controlflow) — docs must surface this prominently | LOW | Warning callout at top of deprecated packages; links to replacement |
| "When to use this vs X" comparisons | e.g., db vs idb, route66 vs direct nostr publishing — helps developers pick the right tool | MEDIUM | Requires understanding the design intent of each package; manually authored |
| Progressive disclosure in skills (supporting files) | Keep SKILL.md under 500 lines; offload reference docs to `reference.md` and examples to `examples.md` | MEDIUM | Claude Code skills spec explicitly supports this pattern; HIGH value for complex adapter skills |
| Agent Skills auto-discovery for monorepo packages | Claude Code auto-discovers `.claude/skills/` in subdirectories when editing files in that subtree | LOW | Structure: `packages/[name]/.claude/skills/`; zero extra config required |
| Consistent "Agent Skills" section in README | Explicit link from human docs to machine-readable skills; bidirectional discoverability | LOW | Format: list of skill file paths with one-line descriptions |

---

### Anti-Features (Deliberately NOT Build)

Features that seem useful but would harm this project's scope, quality, or maintainability.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-generated API reference from TypeScript | Tempting; creates maintenance burden. TypeDoc output is verbose, often unreadable, and decouples docs from intent | Write concise, intent-focused API summaries manually in each README |
| Versioned documentation (multiple doc versions) | Already out of scope per PROJECT.md; adds infrastructure complexity for a codebase with inconsistent versioning | Single current version; use package status badges (alpha/beta) to communicate stability |
| User-facing end-user guides | Wrong audience; confuses scope | Keep all docs developer-oriented; link to nostr.watch for user product |
| Comprehensive tutorial sequences | Time-consuming to write, goes stale, and isn't what contributors need | Prefer short usage examples per package over multi-page tutorials |
| Internationalization | Not needed for a technical contributor audience | English only |
| Comment-based docs (JSDoc / TSDoc parsing) | Requires annotating all source code, which is a separate (larger) project | Separate concern; docs project writes prose docs, not code annotations |
| Interactive API playgrounds | High complexity, high maintenance, no clear audience benefit for a relay monitoring stack | Keep examples as copy-pasteable code blocks |
| Changelog aggregation in docs site | Changelogs belong with the code (CHANGELOG.md per package); duplicating in site creates drift | Link to CHANGELOG.md files from package pages |
| Monorepo dependency graph visualization | Generates interest but adds tooling complexity with low practical value for contributors | Include a static textual dependency list in key package READMEs |

---

## Feature Dependencies

```
README Styleguide
    └──required by──> All 30+ Package READMEs
                          └──feeds into──> mkdocs SPA (nav + content)

mkdocs Configuration
    └──required by──> SPA Build + Deployment
                          └──deploys to──> developers.nostr.watch (Bunny CDN)

mkdocs-monorepo-plugin
    └──required by──> Per-package docs/ dirs appearing in unified site
                          └──enables──> Cross-package linking

Package README (each)
    └──enhances──> Agent Skills section
                      └──links to──> .claude/skills/[package]/SKILL.md

Agent Skill (adapter)
    └──requires──> Reference docs (examples.md, reference.md in skill dir)
                      └──enables──> Progressive disclosure pattern

NIP-66 Skill
    └──requires──> Understanding of publisher + route66 packages
                      └──cross-references──> route66 README + publisher README
```

### Dependency Notes

- **README Styleguide required by all READMEs:** Styleguide must be first deliverable. All package READMEs written after it must conform to it. Writing READMEs before the styleguide means either rewriting or inconsistency.
- **mkdocs-monorepo-plugin required for per-package docs:** Without it, only root-level docs appear in the site. Package-level `docs/` directories need `!include` syntax in root `mkdocs.yml`.
- **Agent Skills section enhances README:** The section is table stakes for the agent audience, but it links to skills files. Skills files must exist before the links are meaningful. Stub links acceptable during initial README pass.
- **Adapter skills require progressive disclosure:** Complex adapter skills (nocap, route66, publisher) cannot fit in a single SKILL.md under 500 lines. Supporting files (`reference.md`, `examples.md`) must be part of the skill directory structure from day one.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what a developer hitting `developers.nostr.watch` needs on day one.

- [ ] **README styleguide** — The specification all other READMEs will follow. Must exist first. Covers: section order, badge format, code example standards, tone/voice.
- [ ] **README.md for every package (apps + libraries + internal)** — All 30+ packages. Consistent format. Stubs acceptable for deprecated packages; full docs required for active ones.
- [ ] **mkdocs configuration** — Root `mkdocs.yml` with monorepo-plugin, Material theme, nav structure, search enabled.
- [ ] **Package discovery index** — Single page listing all packages: name, type (app/library/internal), status, one-line description, link to package README.
- [ ] **Docs build pipeline** — `mkdocs build` produces deployable static output from package READMEs.
- [ ] **Docs deployment** — Bunny CDN deployment script, resolving to `developers.nostr.watch`.
- [ ] **Core monorepo operation skills** — Adding packages, running tests, publishing, deploying. These cross-cutting skills unblock agent contributors immediately.

### Add After Validation (v1.x)

Features to add once the core system is working and validated.

- [ ] **Adapter creation skills (nocap, route66, publisher)** — High-value skills but require deep per-package knowledge; parallelize with README writing but finalize after READMEs are stable.
- [ ] **NIP-66 protocol skill** — Specialized; can be written once route66 and publisher READMEs are complete.
- [ ] **Debugging skills** — Requires gathering real failure patterns; best written after contributors start using the docs and surface recurring questions.
- [ ] **docs/ subdirectory for complex packages** — rstate, nocap, route66 likely need deeper docs. Add after base READMEs validate what depth is needed.

### Future Consideration (v2+)

Features to defer until post-launch.

- [ ] **"When to use X vs Y" comparison pages** — Requires real contributor feedback on confusion points; premature to guess.
- [ ] **Automated README freshness checks** — CI job that flags READMEs whose packages have changed but docs haven't. High maintenance overhead; only justified once docs are in active use.
- [ ] **Per-package build/test status badges in site** — Requires CI integration; nice visual but not blocking.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| README styleguide | HIGH | LOW | P1 |
| README for every active package | HIGH | HIGH | P1 |
| mkdocs configuration | HIGH | LOW | P1 |
| Package discovery index | HIGH | LOW | P1 |
| Docs build pipeline | HIGH | LOW | P1 |
| Bunny CDN deployment | HIGH | LOW | P1 |
| Site-wide search | HIGH | LOW | P1 (Material MkDocs built-in) |
| Monorepo operation skills | HIGH | MEDIUM | P1 |
| Adapter creation skills | HIGH | HIGH | P2 |
| NIP-66 skill | MEDIUM | MEDIUM | P2 |
| Debugging skills | HIGH | HIGH | P2 |
| docs/ for complex packages | MEDIUM | MEDIUM | P2 |
| Deprecation notices | MEDIUM | LOW | P1 (inline in READMEs) |
| Dependency graph per README | MEDIUM | MEDIUM | P2 |
| "When to use X vs Y" pages | MEDIUM | HIGH | P3 |
| Automated freshness checks | LOW | HIGH | P3 |
| Per-package CI badges in site | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## README Section Order (Styleguide Recommendation)

Based on research into effective open source READMEs and the dual audience (humans + agents), the
following section order is recommended for each package README:

1. **Header** — Package name + one-line description (what problem does this solve?)
2. **Status badge row** — Build status, version, license, runtime support (web/node/deno)
3. **Overview** — 2-3 paragraphs: what it does, when to use it, what it does NOT do
4. **Prerequisites** — Runtime requirements, peer dependencies, environment expectations
5. **Installation** — `pnpm add` command; workspace vs. standalone usage
6. **Usage** — Minimal working example first; more examples below if needed
7. **API** — Exported functions/classes/types with brief descriptions; not exhaustive prose
8. **Configuration** — Config shape, env vars, adapter options (if applicable)
9. **Agent Skills** — List of `.claude/skills/` paths that apply to this package, with one-line descriptions
10. **Related Packages** — What this package depends on; what depends on this (within monorepo)
11. **Contributing** — Link to root CONTRIBUTING.md or package-specific notes
12. **License** — One-liner pointing to root LICENSE

---

## Competitor / Reference Analysis

| Site | Package Count | Key Feature | Approach |
|------|--------------|-------------|----------|
| [Turborepo docs](https://turbo.build/repo/docs) | N/A (tool docs) | Clear per-feature sections; excellent search | Nextra (Next.js-based) |
| [Radix UI docs](https://www.radix-ui.com/docs/primitives) | 50+ components | Package-level pages with consistent API tables | Custom Next.js |
| [Effect-TS docs](https://effect.website/docs) | 40+ modules | Module-level docs with cross-links | Nextra |
| [Backstage docs](https://backstage.io/docs) | 100+ plugins | mkdocs-monorepo-plugin (they built it) | MkDocs + monorepo-plugin |

**Takeaway:** The biggest multi-package TypeScript docs sites use either Next.js-based solutions or
MkDocs. Since PROJECT.md already commits to MkDocs (already decided), the reference to emulate is
Backstage's approach — they invented the mkdocs-monorepo-plugin for exactly this use case.

---

## Sources

- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) — Feature overview, search, navigation, versioning
- [mkdocs-monorepo-plugin (Backstage)](https://backstage.github.io/mkdocs-monorepo-plugin/) — Monorepo documentation patterns, `!include` syntax, cross-package navigation
- [Claude Code — Extend with skills](https://code.claude.com/docs/en/skills) — SKILL.md format, frontmatter reference, progressive disclosure, monorepo auto-discovery
- [AGENTS.md standard](https://agents.md/) — Open standard for agent-readable codebase docs; nested files in monorepos
- [GitHub — readme-best-practices](https://github.com/jehna/readme-best-practices) — README section patterns for open source projects
- [daily.dev — README Badges Best Practices](https://daily.dev/blog/readme-badges-github-best-practices) — Badge quantity, types, placement
- [Spotify Engineering — Solving documentation for monoliths and monorepos](https://engineering.atspotify.com/2019/10/solving-documentation-for-monoliths-and-monorepos) — Origin rationale for mkdocs-monorepo-plugin
- nostr-watch root `README.md` — Existing package table format; already establishes runtime support as a key signal
- `.planning/codebase/ARCHITECTURE.md` — Confirms adapter pattern prominence; informs which skills are highest value
- `.planning/codebase/CONVENTIONS.md` — Import conventions (`@nostrwatch/*` scoping) inform code example standards

---

*Feature research for: Developer documentation site — nostr-watch monorepo*
*Researched: 2026-03-04*
