# Stack Research

**Domain:** Developer documentation SPA for a TypeScript/Nostr monorepo
**Researched:** 2026-03-04
**Confidence:** HIGH (core tools), MEDIUM (Claude Code skills format), LOW (Zensical)

---

## Recommended Stack

### Core: Documentation Site Generator

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| VitePress | 1.6.4 (stable) | Markdown → static SPA | Lives in the JS/TypeScript ecosystem (same toolchain as the monorepo). Native `rewrites` config maps `packages/*/docs/*.md` to clean URLs. Built on Vite — sub-second HMR, fast builds. No Python dependency. 1.x is stable and production-proven. |

**Do not use mkdocs-material.** The mkdocs-material team announced maintenance mode in November 2025. They will only issue critical bug fixes through November 2026. All active development has moved to Zensical. MkDocs itself has been unmaintained since August 2024 with no releases in over a year — the mkdocs-material team calls it a supply chain risk. This is a documentation project that should outlast a 12-month maintenance window.

**Do not use Zensical yet.** Version 0.0.24 released February 26, 2026. PyPI classifies it as Development Status 3 — Alpha. It lacks full feature parity with mkdocs-material. Switching to it now means building on an alpha-stage tool. Revisit in 6-12 months when it reaches beta/stable.

**Do not use Docusaurus** unless you want React components in your docs. For this project, docs are plain Markdown with no interactive components needed. Docusaurus adds React build complexity for zero benefit here.

### Monorepo Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| VitePress `rewrites` config | built-in | Map `packages/pkg/docs/*.md` to `/pkg/*.html` | Native to VitePress 1.x — no extra plugin needed. Supports glob patterns like `'packages/:pkg/src/:slug*': ':pkg/:slug*'`. |

No external monorepo plugin is needed. VitePress handles this with its built-in `rewrites` configuration option. The mkdocs-monorepo-plugin (Backstage) is Python and ties you back to the MkDocs ecosystem.

### Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `apps/gui/scripts/deploy-bunny.mjs` | existing | Upload static files to Bunny CDN storage zone, purge pull zone | Already written, tested, and used in production for the GUI. Copy to `scripts/deploy-docs-bunny.mjs` and point `--dir` at VitePress build output (`docs/.vitepress/dist`). Uses native Node `fetch` — no SDK dependency. |

The existing Bunny deploy script is the right tool. It implements concurrent file uploads (configurable concurrency), dry-run mode, and pull zone cache purge. Required env vars: `BUNNY_STORAGE_ENDPOINT`, `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_ZONE_PASSWORD`. Optional for purge: `BUNNY_API_KEY`, `BUNNY_PULL_ZONE_ID`.

Do not use third-party Bunny CDN Node SDKs (`bunnycdn-storage`, `bunnycdn-storage-api-node-sdk`). They are low-maintenance community projects. The existing hand-rolled script is simpler, already works, and has no dependencies.

### Claude Code Skills

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Agent Skills open standard | current | Teach Claude how to work in this codebase | Official standard implemented by Claude Code. Skills live in `.claude/skills/<skill-name>/SKILL.md`. Project-scoped (committed to repo). Claude auto-discovers package-specific skills from nested `.claude/skills/` dirs. |

Claude Code supports two storage levels for project-committed skills:

- **Project-level**: `.claude/skills/<skill-name>/SKILL.md` — applies monorepo-wide
- **Package-level**: `packages/pkg-name/.claude/skills/<skill-name>/SKILL.md` — Claude auto-loads when editing files in that package

For nostr-watch, use **both** levels:
- Monorepo-wide skills for cross-cutting operations (adding packages, publishing, deploying)
- Package-level skills for adapter patterns, NIP-66 guidance, debugging specific packages

### README Linting

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| markdownlint-cli2 | 0.21.0 | Enforce consistent Markdown formatting across all READMEs | Configuration-file-driven (`.markdownlint.yaml`), faster than markdownlint-cli on large codebases, modern JS, actively maintained. Same underlying `markdownlint` library as the VSCode extension — consistent results in editor and CI. |
| lychee | latest | Dead link checking | Written in Rust — dramatically faster than `markdown-link-check` for 30+ packages. Available as GitHub Action (`lycheeverse/lychee-action`). Handles relative links, anchors, and mailto. |

Do not use `markdownlint-cli` (the older one by igorshubovych). markdownlint-cli2 by DavidAnson (same author as the core `markdownlint` library) is the actively developed successor with better performance and config file support.

Do not use `markdown-link-check` as the primary link checker. It is slow (Node.js, sequential by default), and while still maintained, lychee is faster for CI use on large repos.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitepress-plugin-search-preview` | community | Enhanced search results with content preview | Optional — VitePress built-in search is sufficient for this scope |
| Python 3.10+ | system | Required only if Zensical is adopted in future | Not needed now; VitePress is Node-based |

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager (already used) | Monorepo already requires pnpm >=8. VitePress installs via pnpm. |
| Node.js 20+ | Runtime (already required) | Monorepo already requires Node >=20. VitePress requires Node >=18. |
| GitHub Actions | CI for linting + build + deploy | Run `markdownlint-cli2` and `lychee` on PR. Run VitePress build + Bunny deploy on merge to main. |

---

## Installation

```bash
# Documentation site (add to a docs workspace package or root)
pnpm add -D vitepress

# README linting
pnpm add -D markdownlint-cli2

# Lychee is a Rust binary — install via GitHub Actions in CI
# Locally: cargo install lychee  OR  brew install lychee  OR  scoop install lychee
```

VitePress configuration lives in `docs/.vitepress/config.ts`. The `docs/` directory sits at the monorepo root, separate from `apps/` and `libraries/`.

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Doc site generator | VitePress 1.6.4 | mkdocs-material 9.7.4 | If the team is Python-first, prefers YAML config, or needs mkdocs plugin ecosystem. Note: entering maintenance mode. |
| Doc site generator | VitePress 1.6.4 | Zensical 0.0.24 | In 12-18 months when Zensical reaches beta. Already mkdocs.yml compatible so migration will be low-effort. |
| Doc site generator | VitePress 1.6.4 | Docusaurus 3.x | If you need MDX, React components in docs, or built-in versioned docs. Adds React build complexity. |
| Markdown linter | markdownlint-cli2 | markdownlint-cli | If your team already has markdownlint-cli configured and doesn't want to migrate. Both use the same library. |
| Link checker | lychee | markdown-link-check | For small repos where speed isn't a concern. markdown-link-check integrates more naturally with Node toolchains. |
| Bunny deploy | Existing deploy-bunny.mjs | bunnycdn-storage npm | Never — the existing script covers the full use case with no extra dependencies. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| mkdocs-material as long-term foundation | Maintenance mode since Nov 2025. No new features. MkDocs itself unmaintained since Aug 2024. 12-month critical-fixes window ends Nov 2026. | VitePress 1.6.4 (stable, active) |
| Zensical 0.0.24 | Alpha status (PyPI Dev Status 3). No full feature parity yet. Third-party module system not yet open. | Revisit in 6-12 months |
| Third-party Bunny CDN Node SDKs | Low-maintenance community projects with unclear support guarantees. The problem is already solved. | Existing `deploy-bunny.mjs` |
| Docusaurus | React/MDX overhead for zero benefit — this project docs are plain Markdown. | VitePress |
| GitBook / Notion / Confluence | Vendor lock-in, not plain-Markdown-first, not deployable to Bunny CDN without custom integration | VitePress + Bunny |
| markdownlint-cli (old) | Replaced by markdownlint-cli2 from the same author. Less active development. | markdownlint-cli2 |

---

## Stack Patterns by Variant

**For monorepo-wide cross-cutting skills:**
- Store at `.claude/skills/<skill-name>/SKILL.md`
- Set `user-invocable: false` for reference-only knowledge (e.g., NIP-66 protocol guidance)
- Set `disable-model-invocation: true` for action skills with side effects (e.g., `/deploy`, `/publish`)

**For package-specific skills:**
- Store at `packages/pkg-name/.claude/skills/<skill-name>/SKILL.md`
- Claude auto-discovers these when editing files in that package directory
- Keep `SKILL.md` under 500 lines; split detailed references into supporting files

**For CI linting:**
- Run `markdownlint-cli2 "**/*.md" --ignore node_modules` at monorepo root
- Run lychee GitHub Action separately — slow due to HTTP requests, keep it non-blocking on PR
- Block merge on markdownlint failures; lychee failures should be advisory initially (external URLs change)

**For VitePress monorepo routing:**
- Place VitePress config at `docs/.vitepress/config.ts`
- Use `rewrites` to pull README.md from each package: `'../libraries/nocap/README.md': 'libraries/nocap/index.md'`
- Or symlink package `docs/` directories into VitePress source tree

---

## Claude Code Skills Format Reference

From the official Claude Code documentation (verified 2026-03-04):

```yaml
---
name: skill-name              # lowercase, hyphens, max 64 chars; defaults to dir name
description: |                # IMPORTANT: Do NOT let prettier/formatters wrap this field.
  What this skill does and    # Wrapped description breaks skill discovery.
  when Claude should use it.  # Be "pushy" — Claude undertriggers skills.
disable-model-invocation: true  # true = only user can invoke (for /deploy, /publish etc)
user-invocable: false           # false = hidden from / menu (for background knowledge)
allowed-tools: Read, Grep       # tools Claude can use without approval in this skill
context: fork                   # fork = run in isolated subagent
argument-hint: "[package-name]" # shown in autocomplete
---

Skill instructions here...
```

Directory structure for a skill with supporting files:
```
.claude/skills/
└── nocap-adapter/
    ├── SKILL.md          # required, max 500 lines
    ├── examples.md       # referenced from SKILL.md
    └── reference.md      # loaded on demand, not at skill load
```

**Key constraint:** The `description` field must not be line-wrapped by formatters. A single-line or literal-block (`|`) description works. Prettier wrapping breaks skill discovery entirely — configure `.prettierignore` or `.editorconfig` to exclude `SKILL.md` files.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vitepress@1.6.4 | Node >=18, pnpm >=8 | Compatible with monorepo's Node >=20 requirement |
| markdownlint-cli2@0.21.0 | Node >=18 | No conflicts with existing deps |
| VitePress 1.x | VitePress 2.0 alpha | 2.0.0-alpha.16 exists; do not use — breaking changes in progress |

---

## Sources

- Official Claude Code Skills documentation — https://code.claude.com/docs/en/skills (verified 2026-03-04, HIGH confidence)
- VitePress routing/rewrites documentation — https://vitepress.dev/guide/routing (verified 2026-03-04, HIGH confidence)
- VitePress getting started — https://vitepress.dev/guide/getting-started (Node >=18 confirmed, HIGH confidence)
- mkdocs-material maintenance mode announcement — https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/ (HIGH confidence)
- mkdocs-material latest release 9.7.4 — https://github.com/squidfunk/mkdocs-material/releases (HIGH confidence, maintenance mode confirmed)
- Zensical PyPI status 0.0.24 Alpha — https://pypi.org/project/zensical/ (HIGH confidence)
- markdownlint-cli2 GitHub — https://github.com/DavidAnson/markdownlint-cli2 (version 0.21.0, HIGH confidence via npm source)
- lychee link checker — https://github.com/lycheeverse/lychee (HIGH confidence, multiple sources)
- Bunny CDN Storage API reference — https://docs.bunny.net/reference/storage-api (MEDIUM confidence — existing deploy-bunny.mjs already implements the correct pattern)
- VitePress 1.6.4 stable on npm — https://www.npmjs.com/package/vitepress (HIGH confidence)

---

*Stack research for: nostr-watch developer documentation SPA*
*Researched: 2026-03-04*
