# Architecture Research

**Domain:** Developer documentation SPA for a 30+ package TypeScript monorepo
**Researched:** 2026-03-04
**Confidence:** HIGH (mkdocs ecosystem verified against official docs and plugin repositories)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SOURCE LAYER                                     │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │  Package READMEs│  │  docs/ dirs    │  │  Claude Code Skills      │  │
│  │                 │  │  (complex pkgs)│  │  (.claude/skills/)       │  │
│  │  apps/*/README  │  │  apps/*/docs/  │  │  skills/*/SKILL.md       │  │
│  │  libraries/*    │  │  libraries/*   │  │  skills/*/scripts/       │  │
│  │  internal/*     │  │  internal/*    │  │  skills/*/templates/     │  │
│  └────────┬───────┘  └────────┬───────┘  └──────────────────────────┘  │
└───────────┼──────────────────-┼──────────────────────────────────────────┘
            │                   │
            ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGGREGATION LAYER                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Root mkdocs.yml                               │   │
│  │                                                                  │   │
│  │   nav:                                                           │   │
│  │     - Overview: docs/index.md                                    │   │
│  │     - Apps: '*include ./apps/*/mkdocs.yml'                       │   │
│  │     - Libraries: '*include ./libraries/*/mkdocs.yml'             │   │
│  │     - Internal: '*include ./internal/*/mkdocs.yml'               │   │
│  │     - Agent Skills: docs/skills/index.md                         │   │
│  │                                                                  │   │
│  │   plugins: [monorepo, search, literate-nav]                      │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                              │                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │           Per-Package mkdocs.yml (owns its own nav)               │  │
│  │                                                                    │  │
│  │   site_name: apps/gui       (determines URL path)                 │  │
│  │   nav:                                                             │  │
│  │     - Overview: README.md                                          │  │
│  │     - Architecture: docs/architecture.md                           │  │
│  │     - Agent Skills: docs/skills.md                                 │  │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUILD LAYER                                      │
│                                                                          │
│   mkdocs build                                                           │
│     → resolves !include / *include directives                            │
│     → copies & merges all docs/ content into unified site/               │
│     → applies Material for MkDocs theme                                  │
│     → generates full-text search index                                   │
│     → outputs static HTML + assets → site/                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       DELIVERY LAYER                                     │
│                                                                          │
│   deploy-bunny.mjs (adapted from apps/gui/scripts/deploy-bunny.mjs)     │
│     → walks site/ directory                                              │
│     → PUTs each file to Bunny Storage Zone (PUT /zoneName/targetDir/rel)│
│     → purges Bunny Pull Zone CDN cache                                   │
│     → result: developers.nostr.watch (static SPA served from CDN)       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Package README.md | Primary human-facing docs; mkdocs index for that package | Per-package mkdocs.yml (included as nav entry), Agent Skills section |
| Per-package docs/ | Extended docs for complex packages (architecture, API, adapters) | Per-package mkdocs.yml |
| Per-package mkdocs.yml | Declares site_name (= URL path segment) and nav for that package | Root mkdocs.yml via `!include` |
| Root mkdocs.yml | Aggregates all packages using `*include` glob; declares plugins and theme | All per-package mkdocs.yml files |
| docs/ (root) | Top-level pages: index, styleguide, glossary, cross-cutting guides | Root mkdocs.yml nav |
| .claude/skills/ | Claude Code skill files for agent task execution | Referenced from README "Agent Skills" sections |
| docs/skills/ | Human-readable skill index page in the SPA | Root mkdocs.yml, links from package READMEs |
| site/ | mkdocs build output (static HTML) | deploy-bunny.mjs reads this |
| Bunny CDN | Hosts and serves the static SPA | deploy-bunny.mjs writes to it |

---

## Recommended Project Structure

```
nostr-watch/
├── mkdocs.yml                        # Root aggregator — the single build entry point
├── docs/                             # Root-level docs (not tied to any package)
│   ├── index.md                      # Site landing page
│   ├── styleguide.md                 # README authoring styleguide
│   ├── glossary.md                   # Shared abbreviations (auto-tooltip via pymdownx.snippets)
│   ├── contributing.md               # How to add/update docs
│   └── skills/
│       └── index.md                  # Agent Skills directory page
│
├── apps/
│   ├── gui/
│   │   ├── README.md                 # Package docs (mkdocs index page for this package)
│   │   ├── mkdocs.yml                # site_name: apps/gui; nav over README + docs/
│   │   └── docs/                     # Only for complex packages that need more than README
│   │       ├── architecture.md
│   │       └── deployment.md
│   ├── rstate/
│   │   ├── README.md
│   │   └── mkdocs.yml                # site_name: apps/rstate
│   ├── trawler/
│   │   ├── README.md
│   │   └── mkdocs.yml
│   └── ...                           # All other apps follow the same pattern
│
├── libraries/
│   ├── nocap/
│   │   ├── README.md
│   │   ├── mkdocs.yml                # site_name: libraries/nocap
│   │   └── docs/
│   │       └── adapters.md           # Adapter creation guide (complex enough to warrant it)
│   ├── route66/
│   │   ├── README.md
│   │   ├── mkdocs.yml
│   │   └── docs/
│   │       └── state-management.md
│   └── ...
│
├── internal/
│   ├── publisher/
│   │   ├── README.md
│   │   └── mkdocs.yml                # site_name: internal/publisher
│   └── ...
│
└── .claude/
    └── skills/                       # Claude Code skills (not part of mkdocs build)
        ├── add-package/
        │   └── SKILL.md
        ├── create-adapter/
        │   └── SKILL.md
        ├── debug-relay-connection/
        │   └── SKILL.md
        ├── nip66-protocol/
        │   └── SKILL.md
        └── run-tests/
            └── SKILL.md
```

### Structure Rationale

- **README.md at package root:** mkdocs treats `README.md` as the index page for a directory. This means the file simultaneously serves GitHub rendering and the mkdocs SPA — no duplication. The mkdocs-monorepo-plugin correctly resolves these as index pages when included.

- **Per-package mkdocs.yml:** Required by mkdocs-monorepo-plugin. The `site_name` field determines the URL path in the built site (e.g. `site_name: apps/gui` → `developers.nostr.watch/apps/gui/`). Each package owns its own navigation, enabling independent updates without touching the root config.

- **docs/ only for complex packages:** Most packages document well in a single README. The rule: create `docs/` only when a package has genuinely separate concerns that would make one README unwieldy (nocap adapters, gui architecture, route66 state management). Premature `docs/` directories add navigation complexity without benefit.

- **.claude/skills/ separate from mkdocs:** Skills are Claude Code runtime artifacts, not website pages. They live in `.claude/skills/` (the convention for Claude Code skill discovery). READMEs link to them by path; the SPA has a `docs/skills/index.md` that documents what skills exist and how to invoke them.

- **Root docs/glossary.md:** Shared terminology defined once using pymdownx.snippets + abbr extension. Every page in the site automatically gets hover tooltips for defined terms (e.g. "NIP-66", "nocap", "route66") without per-page duplication.

---

## Architectural Patterns

### Pattern 1: Glob Include for Package Discovery

**What:** The root mkdocs.yml uses `*include` glob syntax (mkdocs-monorepo-plugin v0.5.2+) to auto-discover all package mkdocs.yml files without manually listing each one.

**When to use:** Always. With 30+ packages, manually maintaining a list of `!include` directives is a maintenance burden. Glob discovery means new packages are automatically included once their `mkdocs.yml` is created.

**Trade-offs:** Glob ordering is alphabetical; packages cannot be arbitrarily reordered in nav without explicit listing. Accept alphabetical ordering within each section (apps, libraries, internal) — it is predictable and requires zero maintenance.

**Example root mkdocs.yml:**
```yaml
site_name: nostr-watch Developer Docs
site_url: https://developers.nostr.watch/
docs_dir: docs

theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.indexes
    - content.tooltips
    - search.highlight

plugins:
  - search
  - monorepo

markdown_extensions:
  - abbr
  - attr_list
  - pymdownx.snippets:
      base_path: docs
      auto_append:
        - glossary.md
  - pymdownx.highlight
  - pymdownx.superfences

nav:
  - Home: index.md
  - Styleguide: styleguide.md
  - Apps: '*include ./apps/*/mkdocs.yml'
  - Libraries: '*include ./libraries/*/mkdocs.yml'
  - Internal: '*include ./internal/*/mkdocs.yml'
  - Agent Skills: skills/index.md
```

### Pattern 2: README as Single Source of Truth

**What:** Each package's `README.md` is the primary (and often sole) documentation file. The per-package `mkdocs.yml` lists `README.md` as its first nav entry. This makes README the mkdocs index page AND the GitHub-rendered overview — one file, two display contexts.

**When to use:** For all packages where the documentation fits in one page. Default assumption: start with README-only, add `docs/` only when content exceeds ~500 lines or covers genuinely distinct topics (e.g., separate adapter creation guide).

**Trade-offs:** mkdocs strips the H1 title from README when used as index (it becomes the nav label). Ensure README starts with a clean H1 that reads well as a page title.

**Example per-package mkdocs.yml (simple package):**
```yaml
site_name: libraries/nocap

nav:
  - Overview: README.md
```

**Example per-package mkdocs.yml (complex package with docs/):**
```yaml
site_name: libraries/nocap

nav:
  - Overview: README.md
  - Adapter Guide: docs/adapters.md
  - API Reference: docs/api.md
```

### Pattern 3: Structured README Sections with Agent Skills Block

**What:** Every README follows the same section order, ending with an "Agent Skills" section that links to relevant `.claude/skills/` files. This creates a discoverable contract for both human developers and AI agents.

**When to use:** All packages. The styleguide enforces this. Agent Skills section is always last — it does not clutter the human-focused content but is always findable.

**Trade-offs:** Skills links use relative paths that work on GitHub but not in the mkdocs SPA (skills live outside the docs tree). Mitigate by linking to the `docs/skills/index.md` page in the SPA, and to the `.claude/skills/` file path on GitHub. Use conditional formatting or a clear note.

**Example README tail section:**
```markdown
## Agent Skills

Skills for working with this package are available in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| [create-adapter](/.claude/skills/create-adapter/SKILL.md) | Scaffold a new nocap adapter |
| [debug-relay-connection](/.claude/skills/debug-relay-connection/SKILL.md) | Diagnose WebSocket issues |

See the [full skills index](https://developers.nostr.watch/skills/) on the developer site.
```

### Pattern 4: Centralized Glossary with Auto-Tooltips

**What:** A single `docs/glossary.md` defines domain-specific abbreviations using the pymdownx.snippets `auto_append` configuration. Every page in the built site automatically renders hover tooltips for defined terms.

**When to use:** Always. The Nostr ecosystem has many opaque terms (NIP-66, nocap, route66, LMDB, negentropy). Glossary tooltips prevent every author from needing to explain these terms inline.

**Trade-offs:** Abbreviation tooltips only render in the built mkdocs site, not on GitHub. This is acceptable — GitHub has hover context from file navigation; the SPA is the authoritative developer reference.

**Example glossary.md (partial):**
```markdown
*[NIP-66]: Nostr Implementation Possibility 66 — the relay check protocol implemented by nostr-watch
*[nocap]: Library for relay capability discovery using an adapter pattern
*[route66]: Library for multi-relay data aggregation and state management
*[LMDB]: Lightning Memory-Mapped Database, used by relaymon for persistence
*[OPFS]: Origin Private File System, used by gui worker-relay for in-browser SQLite
```

---

## Data Flow

### Markdown to Deployed SPA

```
Package READMEs (30+ files)
    +
Per-package docs/ directories (complex packages only)
    +
Root docs/ (index, styleguide, glossary, skills index)
    ↓
[mkdocs-monorepo-plugin resolves *include globs]
    ↓
[Root mkdocs.yml nav assembled from all packages]
    ↓
[mkdocs build]
    → pymdownx.snippets auto-appends glossary.md to every page
    → Material theme applies navigation tabs, search index
    → All markdown converted to HTML + JS + CSS
    → Output: site/ (static files, fully self-contained SPA)
    ↓
[deploy-bunny.mjs]
    → reads BUNNY_STORAGE_ENDPOINT, BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_ZONE_PASSWORD
    → walks site/ directory recursively
    → PUTs each file to Bunny Storage at /zoneName/[targetDir]/[relative-path]
    → waits BUNNY_REPLICATION_TIMEOUT_MS (default 15s)
    → POSTs purge to Bunny Pull Zone API
    ↓
[Bunny CDN Pull Zone]
    → serves developers.nostr.watch
```

### Cross-Package Linking

```
Package A README.md
    → standard markdown link: [route66](../../libraries/route66/README.md)
    → mkdocs resolves relative paths within the merged nav
    → built site renders as: /libraries/route66/

Package README "Agent Skills" section
    → links to /.claude/skills/create-adapter/SKILL.md (GitHub path)
    → links to /skills/ (built SPA skills index page)
    → two separate link targets for two separate audiences
```

### Skill Integration into Doc Tree

```
.claude/skills/create-adapter/SKILL.md  (Claude Code runtime)
    ↑ referenced by
Package READMEs → "Agent Skills" section → path link
    ↑ summarized by
docs/skills/index.md  (human-readable inventory)
    ↑ included in
Root mkdocs.yml nav → "Agent Skills" tab
    ↑ rendered in
SPA at developers.nostr.watch/skills/
```

---

## Component Boundaries

### What Talks to What

| From | To | Mechanism | Notes |
|------|----|-----------|-------|
| Root mkdocs.yml | Per-package mkdocs.yml | `*include` glob | Plugin resolves at build time |
| Per-package mkdocs.yml | Package README.md | nav entry | README becomes index page |
| Per-package mkdocs.yml | Package docs/*.md | nav entries | Only for complex packages |
| Any markdown page | Any other page | Relative markdown links | mkdocs validates at build |
| Any markdown page | Glossary terms | Auto via pymdownx.snippets | Tooltip rendered client-side |
| docs/skills/index.md | .claude/skills/ paths | Markdown links | Path links only; not a build dependency |
| Package README | docs/skills/index.md | Markdown link | Points to SPA skills page |
| Package README | .claude/skills/ | Markdown link | Points to raw skill file (GitHub) |
| deploy-bunny.mjs | site/ | fs.readdir walk | Reads every file in build output |
| deploy-bunny.mjs | Bunny Storage API | HTTP PUT | Uploads each static file |
| deploy-bunny.mjs | Bunny Pull Zone API | HTTP POST | Purges CDN cache after upload |

### Boundary Constraints

- **Skills are not part of the mkdocs build.** `.claude/skills/` is outside `docs_dir`. Skills files are Claude Code runtime artifacts. The SPA `docs/skills/index.md` is a human-written index that describes the skills — it does not `!include` or transclude skill files.

- **Per-package mkdocs.yml files are not served independently.** They only exist to give each package an owned nav definition. The build is always invoked from the root.

- **The Bunny deploy script is format-agnostic.** It walks any directory and uploads every file. The same script that deploys the GUI can deploy the docs with different env vars and `--dir site`.

---

## Suggested Build Order

Dependencies between documentation components determine the correct implementation sequence:

```
1. Styleguide (docs/styleguide.md)
   └── Must exist before writing any package README
       — defines the section order, tone, badge rules, code example format

2. Glossary (docs/glossary.md)
   └── Define all domain terms upfront
       — prevents inconsistent terminology in READMEs written later

3. Root mkdocs.yml + docs/index.md
   └── The scaffolding that will aggregate everything
       — verify the build succeeds with zero packages first

4. Internal package READMEs + mkdocs.yml stubs (internal/*)
   └── Simplest packages; no adapter complexity
       — proves the per-package pattern works end-to-end

5. Library READMEs + mkdocs.yml (libraries/*)
   └── More complex; some have adapters (nocap, route66, publisher)
       — adapter-bearing libraries get docs/ subdirectory

6. App READMEs + mkdocs.yml (apps/*)
   └── Most complex; reference both libraries and internal packages
       — written last because they reference the library docs just established

7. Claude Code Skills (.claude/skills/)
   └── Written after READMEs because skills reference specific patterns
       — one skill per common agent task; link from READMEs

8. docs/skills/index.md
   └── Inventory page written after all skills exist
       — references all skills; included in root nav

9. Bunny deploy pipeline (docs-specific deploy script + CI workflow)
   └── Built last; everything else must be stable first
```

---

## Anti-Patterns

### Anti-Pattern 1: Flat docs/ at Root for All Packages

**What people do:** Put everything in `docs/apps/gui/`, `docs/libraries/nocap/`, etc. at the root. No per-package docs directories.

**Why it's wrong:** Documentation lives far from the code it describes. Authors editing `libraries/nocap/src/` must navigate to a completely separate tree to update docs. GitHub Codeowners cannot scope docs ownership to the package team. The root `docs/` becomes a sprawling mess of 30+ directories.

**Do this instead:** Keep `README.md` and `docs/` co-located with the package. The mkdocs-monorepo-plugin exists precisely for this pattern.

### Anti-Pattern 2: Manually Listing Every Package in Root Nav

**What people do:** Explicitly list every `!include ./apps/gui/mkdocs.yml`, `!include ./apps/rstate/mkdocs.yml`, etc. in the root `mkdocs.yml`.

**Why it's wrong:** 30+ `!include` lines. Every new package requires a root config edit. Forgotten packages silently disappear from the SPA.

**Do this instead:** Use `*include` glob: `'*include ./apps/*/mkdocs.yml'`. New packages auto-appear when their `mkdocs.yml` is created.

### Anti-Pattern 3: Separate skills.md Per Package (Not in .claude/skills/)

**What people do:** Write Claude Code guidance as prose in a `docs/skills.md` within each package, outside the `.claude/skills/` convention.

**Why it's wrong:** Claude Code discovers skills from `.claude/skills/` (the Agent Skills open standard). Prose guidance files are not invocable — they are just documentation that the agent must manually read and interpret. Skills in the standard location are auto-discovered and invocable via `/skill-name`.

**Do this instead:** Skills go in `.claude/skills/{skill-name}/SKILL.md`. READMEs link to them. The SPA has a human-readable `docs/skills/index.md` that describes available skills.

### Anti-Pattern 4: Overusing docs/ Subdirectories

**What people do:** Create `docs/` in every package regardless of complexity, with stub files that just restate the README.

**Why it's wrong:** Navigation complexity with no information gain. A package with a 200-line README does not need a `docs/` directory that contains `docs/overview.md` (which duplicates the README) and `docs/api.md` (which has two paragraphs).

**Do this instead:** README-first. Add `docs/` only when a specific additional file is needed (e.g. an adapter creation guide for nocap, architecture deep-dive for gui). The rule: every file in `docs/` must cover a topic that genuinely cannot fit in README without making it unwieldy.

### Anti-Pattern 5: Absolute URLs for Cross-Package Links

**What people do:** Hard-code `https://developers.nostr.watch/libraries/nocap/` in package READMEs when linking to other packages.

**Why it's wrong:** Breaks in local `mkdocs serve`. Breaks on GitHub rendering. Makes links stale if the site URL changes.

**Do this instead:** Use relative markdown paths: `[nocap](../../libraries/nocap/README.md)`. mkdocs rewrites these correctly in the built site. GitHub renders them as GitHub file links. Both audiences win.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Bunny CDN Storage | HTTP PUT per file, parallel (concurrency 50) | Existing script at `apps/gui/scripts/deploy-bunny.mjs` can be reused directly with `--dir site` |
| Bunny CDN Pull Zone | HTTP POST purge after upload | Requires BUNNY_API_KEY + BUNNY_PULL_ZONE_ID env vars |
| GitHub | README.md renders natively | Relative links in READMEs work both on GitHub and in mkdocs SPA |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| mkdocs-monorepo-plugin ↔ per-package mkdocs.yml | `*include` glob resolved at build time | Each package mkdocs.yml must have `site_name` that matches desired URL path |
| pymdownx.snippets ↔ docs/glossary.md | `auto_append` in root mkdocs.yml | Glossary appended to every page; abbreviations render as tooltips via `content.tooltips` feature |
| READMEs ↔ Agent Skills | Markdown links to `.claude/skills/` paths | Not a build dependency; purely informational linking |
| docs/skills/index.md ↔ .claude/skills/ | Markdown links and prose description | Skills index is human-written; not auto-generated from skill files |
| CI pipeline ↔ deploy-bunny.mjs | Shell invocation with env vars | `mkdocs build && node scripts/deploy-docs-bunny.mjs --dir site --purge` |

---

## Scaling Considerations

This is a documentation project, not a user-facing application. "Scale" here means maintainability as the package count grows.

| Concern | Current (30 pkgs) | Future (50+ pkgs) |
|---------|-------------------|--------------------|
| Build time | Acceptable — mkdocs builds fast | Still fast; mkdocs-monorepo-plugin adds minimal overhead per package |
| Nav discoverability | `*include` glob auto-discovers all | Unchanged; glob scales to any package count |
| Root config maintenance | Single `mkdocs.yml` with 3 glob lines | Unchanged |
| Skills inventory | Manual `docs/skills/index.md` | May warrant auto-generation from SKILL.md frontmatter if >20 skills |
| CDN deploy time | ~250 files per chunk log | More files; concurrency=50 handles this; add retry logic if needed |

---

## Sources

- mkdocs-monorepo-plugin official docs: https://backstage.github.io/mkdocs-monorepo-plugin/ (MEDIUM confidence — official plugin docs)
- mkdocs-monorepo-plugin GitHub README (glob `*include` syntax, v0.5.2+): https://github.com/backstage/mkdocs-monorepo-plugin (HIGH confidence — official source)
- Material for MkDocs tooltips/snippets: https://squidfunk.github.io/mkdocs-material/reference/tooltips/ (HIGH confidence — official docs)
- Claude Code skills format: https://mikhail.io/2025/10/claude-code-skills/ (MEDIUM confidence — verified community deep-dive)
- Claude Code skills official docs: https://code.claude.com/docs/en/skills (HIGH confidence — official Anthropic docs)
- mkdocs-literate-nav (README-as-nav pattern): https://oprypin.github.io/mkdocs-literate-nav/ (MEDIUM confidence — official plugin docs)
- Existing Bunny deploy script (path confirmed): `apps/gui/scripts/deploy-bunny.mjs` (HIGH confidence — read directly from codebase)
- Monorepo structure (confirmed): `.planning/codebase/STRUCTURE.md`, `.planning/codebase/ARCHITECTURE.md` (HIGH confidence — codebase analysis files)

---

*Architecture research for: nostr-watch developer documentation SPA*
*Researched: 2026-03-04*
