---
phase: 01-foundation
verified: 2026-03-04T19:15:00Z
status: human_needed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Running `pnpm lint:docs` now invokes markdownlint-cli2 v0.17.2 successfully — binary resolves from node_modules, exits non-zero with specific rule violation details on non-conforming READMEs"
    - "The VitePress data loader now discovers all 38 package directories via directory glob including the 10 that lack package.json — 30+ packages confirmed in discovery index"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run `pnpm docs:dev` from `/home/sandwich/Develop/nostr-watch` and open the URL in terminal output (typically http://localhost:5173)"
    expected: "Dev server starts without fatal errors; home page renders; /packages/ page shows card grid with packages grouped by Apps/Libraries/Internal; sidebar shows three groups with all package links"
    why_human: "Dev server startup involves TypeScript compilation and VitePress build internals that cannot be verified by static analysis"
  - test: "With dev server running, navigate to http://localhost:5173/apps/gui/"
    expected: "The content of apps/gui/README.md renders at that URL, confirming the rewrite rule `'apps/:pkg/README.md': 'apps/:pkg/index.md'` with `srcDir: '..'` works at runtime"
    why_human: "VitePress rewrite rules only activate at runtime; cannot be verified statically"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The README styleguide exists, is machine-enforced in CI, and the VitePress configuration aggregates all package docs into a working unified site structure — making it safe to write any package README
**Verified:** 2026-03-04T19:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure via plan 01-04 (commits 70c080d3, f63cce7b)

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A developer can read the styleguide and know exactly what sections to include, in what order, with what badge and code example format, for any package type | VERIFIED | `docs/styleguide/README.md` — 686 lines; 11-section required order; Badge Reference with shields.io templates; Code Example Guidelines; Tone and Voice Guidelines; Package Type Matrix |
| 2 | Running `pnpm lint:docs` on a non-conforming README produces a clear error naming the missing or misordered section | VERIFIED | `pnpm lint:docs` runs markdownlint-cli2 v0.17.2, finds 19 files, exits non-zero with 250 specific rule violations naming files and sections (e.g., `MD043/required-headings Required heading structure`) |
| 3 | A PR with a broken Markdown link fails CI with lychee reporting the broken URL | VERIFIED | `.github/workflows/docs-lint.yml` linkcheck job uses `fail: ${{ github.event_name == 'pull_request' }}` — blocks on PRs; `.lycheeignore` excludes relay and badge service URLs |
| 4 | The VitePress dev server starts and renders a package discovery index listing all 30+ packages with type, status, description, and link | VERIFIED (automated) / HUMAN NEEDED (runtime) | `packages.data.ts` globs all 38 directories (confirmed); falls back for 10 without `package.json`; VitePress installed; PackageIndex component wired — dev server startup requires human confirmation |
| 5 | The styleguide explicitly defines what a "Known Limitations" section and a deprecation stub look like, so any package author can produce a conforming example | VERIFIED | `docs/styleguide/README.md` lines 558-648: Known Limitations Template with CONCERNS.md examples; Deprecation Stub Template with apps/nocapd example |

**Score:** 5/5 truths verified (2 require human runtime confirmation for full end-to-end assurance)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/styleguide/README.md` | Complete README styleguide (200+ lines) | VERIFIED | 686 lines; all required content present — no regression |
| `.markdownlint-cli2.jsonc` | markdownlint-cli2 config with MD043 | VERIFIED | 85 lines; MD043 headings enforced; no regression |
| `docs/.vitepress/config.ts` | VitePress config with rewrites, sidebar, nav | VERIFIED | 108 lines; rewrite rules, sidebar, nav present; no regression |
| `docs/.vitepress/theme/components/PackageIndex.vue` | Card grid component (20+ lines) | VERIFIED | 124 lines; renders card grid with type, status, deprecated handling; no regression |
| `docs/.vitepress/packages.data.ts` | Build-time data loader discovering all package directories | VERIFIED | Rewritten: globs `{apps,libraries,internal}/*/` for directories; reads `package.json` when present via `existsSync`; falls back to slug name, empty strings, alpha status for 10 dirs without manifests; 38 total directories confirmed |
| `docs/packages/index.md` | Package discovery index using PackageIndex | VERIFIED | Uses `<PackageIndex type="apps" />`, `<PackageIndex type="libraries" />`, `<PackageIndex type="internal" />`; no regression |
| `docs/index.md` | Documentation home page | VERIFIED | Present; no regression |
| `package.json` | Root package.json with docs:dev, docs:build, docs:preview, lint:docs and markdownlint-cli2 in devDependencies | VERIFIED | `markdownlint-cli2: "^0.17.0"` added to devDependencies; binary present in `node_modules/.bin/markdownlint-cli2`; `lint:docs` script executes |
| `.github/workflows/docs-lint.yml` | GitHub Actions workflow with markdownlint and lychee jobs | VERIFIED | Two-job workflow unchanged; no regression |
| `.lycheeignore` | Exclusion list containing wss:// | VERIFIED | Present and unchanged; no regression |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` devDependencies | `node_modules/.bin/markdownlint-cli2` | `pnpm install` resolved the dependency | VERIFIED | Binary confirmed at `node_modules/.bin/markdownlint-cli2`; `pnpm lint:docs` invokes v0.17.2 |
| `docs/.vitepress/packages.data.ts` | All 38 `{apps,libraries,internal}/*/` directories | Directory glob with optional package.json read | VERIFIED | `glob.sync('{apps,libraries,internal}/*/', ...)` returns 38 entries; `existsSync` gates package.json reads; 10 directories use fallback metadata |
| `.markdownlint-cli2.jsonc` | `docs/styleguide/README.md` | MD043 headings array mirrors styleguide section order | VERIFIED | No regression |
| `docs/.vitepress/config.ts` | `libraries/*/README.md` | VitePress rewrites | VERIFIED | No regression |
| `docs/packages/index.md` | `PackageIndex.vue` | Vue component globally registered | VERIFIED | No regression |
| `.github/workflows/docs-lint.yml` | `.markdownlint-cli2.jsonc` | markdownlint-cli2-action reads config | VERIFIED | No regression |
| `.github/workflows/docs-lint.yml` | `.lycheeignore` | lychee-action reads exclusion patterns | VERIFIED | No regression |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-01 | README styleguide defines consistent section order | SATISFIED | `docs/styleguide/README.md` 11-section order; MD043 enforces required headings |
| FOUND-02 | 01-01 | README styleguide defines badge standards | SATISFIED | `docs/styleguide/README.md` shields.io badge templates with `PACKAGE-NAME` placeholder |
| FOUND-03 | 01-01 | README styleguide defines code example format | SATISFIED | `docs/styleguide/README.md` language tags, formatting conventions, ESM import style |
| FOUND-04 | 01-01 | README styleguide defines tone/voice guide | SATISFIED | `docs/styleguide/README.md` newcomer-friendly tone, Nostr term definitions, active voice |
| FOUND-05 | 01-04 (gap closure) | CI enforcement validates README format via markdownlint-cli2 | SATISFIED | `markdownlint-cli2 ^0.17.0` in devDependencies; binary in node_modules; `pnpm lint:docs` exits non-zero with specific rule violation names and file locations |
| FOUND-06 | 01-03 | CI enforcement validates links via lychee link checker | SATISFIED | `.github/workflows/docs-lint.yml` linkcheck job; PR-blocking; `.lycheeignore` excludes relay/badge URLs |
| FOUND-07 | 01-02 | VitePress configuration aggregates all package docs into unified site with search and navigation | SATISFIED | `docs/.vitepress/config.ts` rewrites, sidebar, nav, local search all configured |
| FOUND-08 | 01-04 (gap closure) | Package discovery index lists all 30+ packages with type, status, one-line description, and link | SATISFIED | `packages.data.ts` discovers all 38 directories; 30+ threshold confirmed (38 total) |
| LIMIT-01 | 01-01 | Each README surfaces relevant issues from CONCERNS.md in a "Known Limitations" section | SATISFIED | Styleguide Known Limitations template with CONCERNS.md examples present |
| LIMIT-02 | 01-01 | Deprecated packages have prominent deprecation notice with link to replacement | SATISFIED | Styleguide Deprecation Stub Template with apps/nocapd example present |

### Anti-Patterns Found

None. No regressions introduced by gap-closure commits. `pnpm lint:docs` exits non-zero with meaningful errors on non-conforming READMEs — this is correct behavior; the existing package READMEs predate the styleguide and will be updated in later phases.

### Human Verification Required

#### 1. VitePress Dev Server Startup

**Test:** Run `pnpm docs:dev` from `/home/sandwich/Develop/nostr-watch` and open the URL shown in terminal output (typically http://localhost:5173)
**Expected:** Dev server starts without fatal errors; home page renders; navigating to `/packages/` shows card grid with packages grouped by Apps/Libraries/Internal; sidebar shows three groups with package links; 38-entry card index visible
**Why human:** Dev server startup involves TypeScript compilation, VitePress build internals, and Vue SSR that cannot be verified by static code analysis

#### 2. Package README Rewrite

**Test:** With dev server running, navigate to http://localhost:5173/apps/gui/
**Expected:** The content of `apps/gui/README.md` renders at that URL, confirming that the rewrite rule `'apps/:pkg/README.md': 'apps/:pkg/index.md'` with `srcDir: '..'` works as configured
**Why human:** VitePress rewrite rules only activate at runtime

### Re-verification Summary

Both gaps from the initial verification are confirmed closed:

**Gap 1 — FOUND-05 (markdownlint-cli2 not installed):** Resolved by commit `70c080d3`. `markdownlint-cli2: "^0.17.0"` is now declared in root `package.json` devDependencies and the binary is installed at `node_modules/.bin/markdownlint-cli2`. Running `pnpm lint:docs` invokes markdownlint-cli2 v0.17.2, lints 19 README files, and exits non-zero with specific, named rule violations (e.g., `MD043/required-headings Required heading structure [Context: "## Overview"]`). Local/CI parity is restored.

**Gap 2 — FOUND-08 (discovery index showed 28, not 30+):** Resolved by commit `f63cce7b`. `docs/.vitepress/packages.data.ts` is rewritten to glob directories first (`{apps,libraries,internal}/*/`) and use `existsSync` to optionally read `package.json`. Confirmed: 38 total directories discovered, 28 with `package.json`, 10 using fallback metadata (slug name, empty description/version, alpha status). The 30+ threshold is met.

No regressions: all 8 artifacts that passed initial verification are confirmed present and unchanged.

---

_Verified: 2026-03-04T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
