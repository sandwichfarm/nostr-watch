---
phase: 04-app-package-readmes
verified: 2026-03-05T10:45:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "Known Limitations sections reflect actual codebase state"
    status: partial
    reason: "Content is accurate but CONCERNS.md 'See' links in gui, rstate, and relaymon READMEs use wrong relative paths (.planning/codebase/CONCERNS.md instead of ../../.planning/codebase/CONCERNS.md). These are broken filesystem-relative links that would fail lychee link-checking in CI on any PR. The inline descriptive text is fully accurate."
    artifacts:
      - path: "apps/gui/README.md"
        issue: "3 Known Limitations entries use '.planning/codebase/CONCERNS.md' — should be '../../.planning/codebase/CONCERNS.md'"
      - path: "apps/rstate/README.md"
        issue: "3 Known Limitations entries use '.planning/codebase/CONCERNS.md' — should be '../../.planning/codebase/CONCERNS.md'"
      - path: "apps/relaymon/README.md"
        issue: "2 Known Limitations entries use '.planning/codebase/CONCERNS.md' — should be '../../.planning/codebase/CONCERNS.md'"
    missing:
      - "Fix relative path prefix in all CONCERNS.md links: change '.planning/' to '../../.planning/' in apps/gui/README.md, apps/rstate/README.md, and apps/relaymon/README.md"
human_verification:
  - test: "Open http://localhost:5173/apps/gui/ after running pnpm docs:dev"
    expected: "gui README renders as a VitePress page with correct heading structure and no broken internal links visible"
    why_human: "VitePress rendering and broken-link visual indicators require browser testing"
  - test: "Open http://localhost:5173/apps/nocapd/ in the VitePress dev server"
    expected: "DEPRECATED banner appears immediately below the H1 heading, clearly visible before any other content"
    why_human: "Visual prominence of the deprecation notice requires browser verification"
---

# Phase 4: App Package READMEs Verification Report

**Phase Goal:** Every apps/ package has a conforming README.md or deprecation stub; deprecated apps clearly direct users to the replacement; Known Limitations sections reflect actual codebase state
**Verified:** 2026-03-05T10:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Phase 4 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every apps/ README passes markdownlint-cli2 without modification | VERIFIED | `pnpm lint:docs` returns 0 errors across 38 files including all 8 app READMEs |
| 2 | VitePress renders a route for each app README | VERIFIED | `docs/.vitepress/config.ts` sidebar lists all 8 apps with correct `apps/:pkg/index.md` rewrites |
| 3 | A developer opening apps/nocapd README immediately sees a prominent deprecation notice | VERIFIED | Line 3 is a blockquote `> **DEPRECATED** -- This package has been replaced by ...` immediately after H1 |
| 4 | A developer reading any active app README understands how to run it, env vars, and dependencies | VERIFIED | All 7 active READMEs include Quick Start with runtime-appropriate commands, Prerequisites with env var tables where applicable, and Related Packages |
| 5 | Apps with CONCERNS.md entries have accurate Known Limitations | PARTIAL | Content is accurate inline; however, 8 "See" links across 3 READMEs use broken relative paths (.planning/ instead of ../../.planning/) — would fail lychee CI on PR |

**Score:** 4/5 truths fully verified; 1 partial

---

## Required Artifacts

All 8 required README files exist and are substantive (not stubs for active packages, not false stubs for the deprecated one).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/gui/README.md` | SvelteKit dashboard README | VERIFIED | 71 lines; MD043-compliant; 3 CONCERNS.md Known Limitations; pnpm workflow; commit 28026108 |
| `apps/rstate/README.md` | ContextVM state machine + REST API README | VERIFIED | 133 lines; env var table; 14-row API table; 3 CONCERNS.md Known Limitations; commit fa61d1d8 |
| `apps/trawler/README.md` | Deno crawler README | VERIFIED | 115 lines; Deno-native; config.yaml docs; deno task commands; commit 6efcdd88 |
| `apps/relaymon/README.md` | Deno health monitor README | VERIFIED | 187 lines; RELAYMON_NSEC env var; Docker variants; 2 CONCERNS.md Known Limitations; commit 28842cb9 |
| `apps/purist/README.md` | Pre-built browser scanner README | VERIFIED | 54 lines; dist/ hosting instructions; no fabricated source details; commit bb8301ed |
| `apps/docker-stacks/README.md` | Docker Compose stacks README | VERIFIED | 91 lines; 5-stack table; docker compose workflow; commit 2ea1c139 |
| `apps/nocapd/README.md` | Deprecation stub | VERIFIED | 32 lines; DEPRECATED banner on line 3; all MD043 sections with N/A content; links to relaymon; commit 80ba66ae |
| `apps/umon/README.md` | Browser extension README | VERIFIED | 79 lines; Manifest V3; pnpm build; Chrome and Firefox unpacked load steps; Known Limitations; commit 1a7a79ac |

---

## Key Link Verification

### MD043 Section Order (All 8 READMEs)

Every README has the required sections in MD043-compliant order (Overview → Installation → Quick Start → Known Limitations → License). Verified by `pnpm lint:docs` returning 0 errors.

| README | Section Order | Status |
|--------|--------------|--------|
| `apps/gui/README.md` | Overview, Prerequisites, Installation, Quick Start, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/rstate/README.md` | Overview, Prerequisites, Installation, Quick Start, API, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/trawler/README.md` | Overview, Prerequisites, Installation, Quick Start, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/relaymon/README.md` | Overview, Prerequisites, Installation, Quick Start, Docker, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/purist/README.md` | Overview, Installation, Quick Start, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/docker-stacks/README.md` | Overview, Prerequisites, Installation, Quick Start, Available Stacks, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |
| `apps/nocapd/README.md` | Overview, Installation, Quick Start, Why deprecated, Migrating, Known Limitations, License | WIRED |
| `apps/umon/README.md` | Overview, Prerequisites, Installation, Quick Start, Configuration, Known Limitations, Agent Skills, Related Packages, License | WIRED |

### Deprecation Link: nocapd → relaymon

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/nocapd/README.md` | `apps/relaymon/README.md` | `../relaymon/README.md` (sibling path) | WIRED | Line 3 blockquote and "Migrating" section both link to relaymon |

### CONCERNS.md "See" Links: 3 READMEs

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/gui/README.md` | `.planning/codebase/CONCERNS.md` | 3 Known Limitations entries | NOT_WIRED | Path resolves to `apps/gui/.planning/codebase/CONCERNS.md` — does not exist. Correct path: `../../.planning/codebase/CONCERNS.md` |
| `apps/rstate/README.md` | `.planning/codebase/CONCERNS.md` | 3 Known Limitations entries | NOT_WIRED | Same broken path prefix; 3 affected links |
| `apps/relaymon/README.md` | `.planning/codebase/CONCERNS.md` | 2 Known Limitations entries | NOT_WIRED | Same broken path prefix; 2 affected links |

Phase 3 library READMEs correctly use `../../.planning/codebase/CONCERNS.md` — the same depth as apps/ but Phase 4 omitted the prefix.

---

## Requirements Coverage

All 8 requirement IDs from the 4 plan files are covered and no orphaned requirements found.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| APP-01 | 04-01-PLAN.md | README.md for apps/gui following styleguide | SATISFIED | `apps/gui/README.md` exists, MD043-compliant, full content |
| APP-02 | 04-01-PLAN.md | README.md for apps/rstate following styleguide | SATISFIED | `apps/rstate/README.md` exists, MD043-compliant, env var table, REST API table |
| APP-03 | 04-02-PLAN.md | README.md for apps/trawler following styleguide | SATISFIED | `apps/trawler/README.md` exists, Deno-native, deno task commands |
| APP-04 | 04-02-PLAN.md | README.md for apps/relaymon following styleguide | SATISFIED | `apps/relaymon/README.md` exists, Docker variants, 2 CONCERNS.md entries |
| APP-05 | 04-03-PLAN.md | README.md for apps/purist following styleguide | SATISFIED | `apps/purist/README.md` exists; correctly documents no source in repo |
| APP-06 | 04-04-PLAN.md | Deprecation stub for apps/nocapd | SATISFIED | `apps/nocapd/README.md` has DEPRECATED banner, relaymon link, N/A sections |
| APP-07 | 04-03-PLAN.md | README.md for apps/docker-stacks following styleguide | SATISFIED | `apps/docker-stacks/README.md` exists, 5-stack table, docker compose workflow |
| APP-08 | 04-04-PLAN.md | README.md or deprecation stub for apps/umon | SATISFIED | `apps/umon/README.md` exists as full README (not deprecated); Manifest V3, pnpm build, unpacked load |

All 8 requirements satisfied. Requirements.md shows all 8 marked as `[x] Complete` and mapped to Phase 4.

---

## Anti-Patterns Found

No TODO/FIXME/HACK/PLACEHOLDER patterns found in any of the 8 README files.

No empty implementations or stub patterns detected.

The CONCERNS.md link path issue (`apps/gui`, `apps/rstate`, `apps/relaymon`) is categorized as:

| Files | Pattern | Severity | Impact |
|-------|---------|----------|--------|
| `apps/gui/README.md`, `apps/rstate/README.md`, `apps/relaymon/README.md` | Broken relative paths in "See" links: `.planning/codebase/CONCERNS.md` (should be `../../.planning/codebase/CONCERNS.md`) | Warning | Would fail lychee link-checking on PRs; does not affect readable content or markdownlint compliance |

---

## Human Verification Required

### 1. VitePress App Route Rendering

**Test:** Run `pnpm docs:dev` from monorepo root; navigate to `/apps/gui/`, `/apps/rstate/`, `/apps/trawler/`, `/apps/relaymon/`, `/apps/purist/`, `/apps/docker-stacks/`, `/apps/nocapd/`, `/apps/umon/`
**Expected:** Each route renders the README as a correctly structured VitePress page with visible headings, tables, and code blocks; no raw Markdown visible
**Why human:** VitePress rendering and visual correctness require a browser session

### 2. nocapd Deprecation Notice Visual Prominence

**Test:** Open `/apps/nocapd/` in the VitePress dev server
**Expected:** The DEPRECATED blockquote banner appears immediately below the H1 heading as visually distinct callout text (typically rendered with a left border in VitePress default theme) before any prose content
**Why human:** Visual rendering of blockquote callouts and visual hierarchy require browser verification

---

## Gaps Summary

**One structural gap found: broken CONCERNS.md relative link paths in 3 READMEs.**

Apps `gui`, `rstate`, and `relaymon` each contain Known Limitations entries that end with `See [CONCERNS.md — ...](. planning/codebase/CONCERNS.md#...)`. The path `.planning/codebase/CONCERNS.md` is resolved relative to the README file's location — meaning it attempts to reach `apps/<pkg>/.planning/codebase/CONCERNS.md`, which does not exist. The correct path is `../../.planning/codebase/CONCERNS.md` (matching the pattern already used by Phase 3 library and internal READMEs).

The inline text of each Known Limitations entry is fully accurate — correct issue description, correct file paths, correct line numbers. The broken links are supplementary "See also" references to the planning-layer concerns document, not the primary content.

The gap is classified as a **Warning** (not a blocker for the developer-facing goal) because:
1. `pnpm lint:docs` (markdownlint-cli2) passes with 0 errors — this does not check link targets
2. The inline content of each Known Limitations entry is accurate and complete
3. The lychee link-checker configured in CI would flag these on a PR, but the lychee job has `fail: false` on push (only `fail: true` on pull_request)

However, the gap must be fixed before this branch merges to main to avoid lychee failures in PR CI.

**Affected lines to fix:**

`apps/gui/README.md` — 3 occurrences: lines 49, 51, 53. Change `.planning/` to `../../.planning/`

`apps/rstate/README.md` — 3 occurrences: lines 114, 116, 118. Change `.planning/` to `../../.planning/`

`apps/relaymon/README.md` — 2 occurrences: lines 167, 169. Change `.planning/` to `../../.planning/`

---

_Verified: 2026-03-05T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
