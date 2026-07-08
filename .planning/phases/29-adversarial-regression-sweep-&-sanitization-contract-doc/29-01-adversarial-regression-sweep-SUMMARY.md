---
phase: 29-adversarial-regression-sweep-&-sanitization-contract-doc
plan: 01
subsystem: testing
tags: [vitest, dompurify, xss, security, svelte, sanitize]

# Dependency graph
requires:
  - phase: 24-sanitize-helper-surface
    provides: safeHttpUrl, safeImageUrl, escapeHtml, isUrlBreakout module-private factor; JSDoc base sections (Trust boundary, Helper-per-sink table, Test-then-fix discipline)
  - phase: 25-css-banner-sinks
    provides: bannerStyleString helper; banner-sink walker pattern in banner-style-structural.test.ts
  - phase: 26-href-allowlist-sweep
    provides: CardFees safePaymentsUrl reactive pair; stripHtmlComments helper convention
  - phase: 27-countcard-structural-fix
    provides: CountCard slot-API + text-bind fallback; CardInsights / RelayFeeItem migration
  - phase: 28-notes.ts-hardening
    provides: parseNote always-on DOMPurify; ParseConfig.sanitize @deprecated field; vi.mock services.js pattern
provides:
  - v2.5 milestone canary test (one assertion per attack vector across Phases 24-28)
  - Cross-cutting {@html} audit walker (whitelist-driven, fails on unknown sinks)
  - Function-level CardInsights/RelayFeeItem adversarial smoke
  - Expanded sanitize.ts JSDoc (5 sections — adds v2.5 milestone summary + Deferred AUDIT-01)
  - Formal AUDIT-01 deferral in PROJECT.md Key Decisions
  - 4 caller cleanups (sanitize:false stripped — Phase 28 made it a no-op)
affects: future v2.6+ AUDIT-01 (formatter migration); any future {@html} sink addition

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v2.5 milestone canary — one consolidated test file with one assertion per attack vector across all phase fixes"
    - "Cross-cutting {@html} audit walker — whitelist patterns + offenders array + clear failure message hint"
    - "Inventory-floor assertion — toBeGreaterThanOrEqual on raw sink count locks against silent shrinkage"
    - "Co-located dev-note discipline — sanitization contract lives in JSDoc of the helper module that enforces it (no separate SECURITY.md)"

key-files:
  created:
    - apps/gui/src/lib/utils/v2.5-xss-smoke.test.ts
    - apps/gui/src/lib/utils/html-sink-audit.test.ts
    - apps/gui/src/lib/utils/cardinsights-relayfeeitem-adversarial.test.ts
    - .planning/phases/29-adversarial-regression-sweep-&-sanitization-contract-doc/deferred-items.md
  modified:
    - apps/gui/src/lib/utils/sanitize.ts
    - .planning/PROJECT.md
    - apps/gui/src/lib/components/feeds/FeedNoteContent.svelte
    - apps/gui/src/lib/components/feeds/FeedNote.svelte
    - apps/gui/src/lib/components/feeds/FeedMasonryNote.svelte
    - apps/gui/src/lib/components/modal/Reader.svelte

key-decisions:
  - "Inventory floor adjusted from 13 to 12 LIVE sinks — the planner's 13-count included a commented-out {@html $readerContent} in Reader.svelte:110 inside <!-- ... --> Dialog dead-code; the walker (correctly) strips comments before counting, matching the runtime surface. The $readerContent whitelist entry stays in case the dead block is re-enabled."
  - "Whitelist regex for $NIP_11_LIMITATIONS uses optional fallback group `(\\s*\\|\\|\\s*['\"][^'\"]*['\"])?` to match the actual `{@html $NIP_11_LIMITATIONS?.[key] || ''}` shape at CardLimitation.svelte:114."
  - "Coverage of behavioral parseNote test in v2.5-xss-smoke uses Phase 28's literal assertion shape (`not.toMatch(/<script\\b/i)` + `not.toMatch(/onerror=/i)` + `not.toContain('alert(1)')`) — DOMPurify keeps `<img src=\"x\">`, so asserting `not.toMatch(/<img\\b/i)` would falsely fail."
  - "Pre-existing playwright spec failures (relay-detail*.spec.ts) documented in deferred-items.md as out-of-scope infrastructure issue; vitest unit-test pass count is 274/274 across all v2.5 tests."

patterns-established:
  - "One-file-per-attack-vector milestone canary — runs in <1s, locks every fix in the milestone"
  - "Whitelist-driven {@html} walker — adding a new sink requires either matching an existing whitelist pattern or extending the whitelist with security justification in code review"
  - "stripHtmlComments before structural assertion — keeps walkers focused on live runtime surface, ignores commented-out dead code"

requirements-completed:
  - TEST-04
  - TEST-05
  - TEST-06
  - AUDIT-01
  - AUDIT-02

# Metrics
duration: ~5min
completed: 2026-05-03
---

# Phase 29 Plan 01: Adversarial Regression Sweep & Sanitization-Contract Doc Summary

**Locked v2.5 GUI XSS Hardening posture via 3 canary test files (21 new cases) + expanded sanitize.ts JSDoc + formal AUDIT-01 deferral; total v2.5 vitest count now 274/274 green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-03T20:22:29Z
- **Completed:** 2026-05-03T20:27:54Z
- **Tasks:** 3
- **Files modified:** 9 (3 created tests, 1 deferred-items.md, 5 source edits)

## Accomplishments

- Shipped 3 new test files (21 assertions total) that lock the v2.5 security posture against regression: helper-level + structural + behavioral coverage across Phases 24-28
- Expanded `sanitize.ts` JSDoc into the canonical 5-section dev note for the v2.5 sanitization contract (Trust boundary, Helper-per-sink table, Test-then-fix discipline, v2.5 milestone summary, Deferred AUDIT-01)
- Recorded formal AUDIT-01 deferral to v2.6+ in `PROJECT.md` Key Decisions with verbatim rationale from CONTEXT.md
- Stripped now-no-op `sanitize: false` literal from 4 caller files (cosmetic — Phase 28 made it inert; `ParseConfig.sanitize` stays `@deprecated`)

## Task Commits

All 3 tasks shipped in a single atomic GREEN commit (per plan — no RED needed; the security work landed in Phases 24-28):

1. **Task 1+2+3: v2.5 milestone close** — `721e0075` (feat)

## Files Created/Modified

### Created

- `apps/gui/src/lib/utils/v2.5-xss-smoke.test.ts` (161 LOC) — Consolidated milestone canary covering Phase 24 URL-01 (helper-level), Phase 25 CSS-01/02 (banner-sink imports), Phase 26 URL-02/03 (CardFees safeHttpUrl + paymentsUrl), Phase 27 CARD-01..03 (CountCard structural), Phase 28 FEED-01..05 (parseNote behavioral)
- `apps/gui/src/lib/utils/html-sink-audit.test.ts` (131 LOC) — Cross-cutting walker over `apps/gui/src/**/*.svelte` asserting every `{@html EXPR}` matches a 7-pattern whitelist; second test locks the 12-sink LIVE inventory floor
- `apps/gui/src/lib/utils/cardinsights-relayfeeitem-adversarial.test.ts` (83 LOC) — Function-level smoke for CARD-02/03 contracts (Number coercion + escapeHtml + slot-bound bottomText structural)
- `.planning/phases/29-adversarial-regression-sweep-&-sanitization-contract-doc/deferred-items.md` — Records pre-existing Playwright spec failures as out-of-scope

### Modified

- `apps/gui/src/lib/utils/sanitize.ts` — JSDoc-only expansion: added `# v2.5 milestone summary` and `# Deferred AUDIT-01 (formatter migration)` sections; replaced final FOLLOW-UP paragraph with pointer to those sections + PROJECT.md. Helper code (isUrlBreakout, escapeHtml, safeImageUrl, safeHttpUrl) byte-for-byte unchanged
- `.planning/PROJECT.md` — Inserted AUDIT-01 deferral row after the existing v2.5 "Text-bind-by-default" Key Decisions row, verbatim per CONTEXT.md `<specifics>`
- `apps/gui/src/lib/components/feeds/FeedNoteContent.svelte` — Removed `sanitize: false,` from `parserOptions`
- `apps/gui/src/lib/components/feeds/FeedNote.svelte` — Removed `sanitize: false,` from `defaultParserOptions`
- `apps/gui/src/lib/components/feeds/FeedMasonryNote.svelte` — Removed `sanitize: false,` from inline `parseNote(...)` config arg
- `apps/gui/src/lib/components/modal/Reader.svelte` — Removed `sanitize: false,` from `parserOptions`

## Test Coverage Final Tally

**v2.5 milestone — total vitest cases across all 6 phases:**

| Phase | Test File | Cases |
|-------|-----------|-------|
| 24 | `apps/gui/src/lib/utils/sanitize.test.ts` | 52 |
| 25 | `apps/gui/src/lib/utils/style-helpers.test.ts` | 22 |
| 25 | `apps/gui/src/lib/utils/banner-style-structural.test.ts` | 5 |
| 26 | `apps/gui/src/routes/relays/[protocol]/[...relay]/(components)/cards/CardFees.test.ts` | 10 |
| 27 | `apps/gui/src/routes/(components)/CountCard.test.ts` | 22 |
| 28 | `apps/gui/src/lib/utils/notes.test.ts` | 15 |
| 29 | `apps/gui/src/lib/utils/v2.5-xss-smoke.test.ts` | 12 |
| 29 | `apps/gui/src/lib/utils/html-sink-audit.test.ts` | 2 |
| 29 | `apps/gui/src/lib/utils/cardinsights-relayfeeitem-adversarial.test.ts` | 7 |
| **Phase 29 subtotal** | | **21** |
| **v2.5 grand total (helpers/structural/behavioral)** | | **147** |

Full `pnpm test` in `apps/gui`: **274 passing** vitest cases (147 v2.5 + 127 pre-existing). 2 pre-existing Playwright spec failures (out of scope — see `deferred-items.md`).

## Decisions Made

- **Inventory floor adjusted to 12 LIVE sinks (from planner's 13 expectation).** The original interfaces table counted a commented-out `{@html $readerContent}` at Reader.svelte:110 (inside an `<!-- ... -->` Dialog dead-code block). The walker strips HTML comments before counting (matches the runtime-rendered surface), giving 12 live sinks. The `$readerContent` whitelist entry stays in case the dead block is re-enabled. JSDoc on the test file documents this discrepancy explicitly.
- **Whitelist regex shape locked to actual code.** The CardLimitation pattern `^\$NIP_11_LIMITATIONS\?\.\[key\](\s*\|\|\s*['"][^'"]*['"])?$` matches the real source `{@html $NIP_11_LIMITATIONS?.[key] || ''}` with the optional fallback. Tightening this further would break on legitimate fallback patterns; loosening would let arbitrary `||` expressions through.
- **Behavioral assertion in v2.5-xss-smoke mirrors notes.test.ts:101-106 byte-for-byte.** DOMPurify sanitizes `<img src=x onerror=alert(1)>` to `<img src="x">` (keeps the element, strips the handler). The plan-time assertion `not.toMatch(/<img\b/i)` would falsely fail; we use the Phase 28 proven shape (`not.toMatch(/<script\b/i)` + `not.toMatch(/onerror=/i)` + `not.toContain('alert(1)')`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inventory floor adjusted from 13 to 12 live sinks**

- **Found during:** Task 1 (initial vitest run of html-sink-audit.test.ts)
- **Issue:** Plan asserted `>= 13` based on raw grep count. The walker (correctly) strips HTML comments before counting, so the third Reader.svelte sink (line 110, inside `<!-- ... -->` dead code) is excluded — live count is 12.
- **Fix:** Lowered the inventory floor to `>= 12`, updated the inline JSDoc to explain the discrepancy and clarify the design intent (count LIVE runtime surface, not dead-code grep matches).
- **Files modified:** `apps/gui/src/lib/utils/html-sink-audit.test.ts` (test assertion + JSDoc clarification)
- **Verification:** Re-ran `pnpm vitest run src/lib/utils/html-sink-audit.test.ts` — 2/2 green.
- **Committed in:** 721e0075 (Phase 29 single GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — planning-time inventory miscount).
**Impact on plan:** No security/scope impact — the floor adjustment reflects the live runtime surface. Inventory test still locks against silent shrinkage of the canary surface, which is its design intent.

## Issues Encountered

- **Pre-existing Playwright spec failures.** `apps/gui/tests/relay-detail.spec.ts` and `relay-detail-debug.spec.ts` fail under vitest's transform (Playwright/Vitest version conflict). Documented in `deferred-items.md` as out-of-scope; predates v2.5. All 274 vitest unit tests pass (147 v2.5 + 127 pre-existing).
- **`git stash --keep-index` round-trip during verification.** A `git stash --keep-index` was used to confirm a baseline state, but with no staged changes it reverted everything; `git stash pop` restored cleanly. No data lost.

## Pointers

- **Sanitization contract dev note:** `apps/gui/src/lib/utils/sanitize.ts` JSDoc header (5 sections — Trust boundary, Helper-per-sink table, Test-then-fix discipline, v2.5 milestone summary, Deferred AUDIT-01).
- **AUDIT-01 deferral:** `.planning/PROJECT.md` Key Decisions row "Defer AUDIT-01 (formatter migration to Svelte components) to v2.6+".
- **Cross-cutting `{@html}` walker:** `apps/gui/src/lib/utils/html-sink-audit.test.ts` — runs on every `pnpm test`, fails loudly on unknown sinks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

v2.5 is **ready for `/gsd:audit-milestone` and `/gsd:complete-milestone v2.5`**. All 6 phases are complete:

1. Phase 24 — Sanitize Helper Surface (URL-01) — shipped
2. Phase 25 — CSS Banner Sinks (CSS-01, CSS-02) — shipped
3. Phase 26 — href Allowlist Sweep (URL-02, URL-03) — shipped
4. Phase 27 — CountCard Structural Fix (CARD-01, CARD-02, CARD-03) — shipped
5. Phase 28 — notes.ts Hardening (FEED-01..05) — shipped
6. Phase 29 — Adversarial Regression Sweep & Sanitization-Contract Doc (TEST-04, TEST-05, TEST-06, AUDIT-01, AUDIT-02) — shipped

The cross-cutting `html-sink-audit.test.ts` walker is the ongoing canary that catches new `{@html}` sinks added without going through one of the v2.5 helpers. AUDIT-01 (formatter migration) is formally deferred to v2.6+ with rationale recorded.

---
*Phase: 29-adversarial-regression-sweep-&-sanitization-contract-doc*
*Completed: 2026-05-03*

## Self-Check: PASSED

All claimed files exist on disk. Commit `721e0075` exists in git log. All required content markers verified:
- 5 created files found (3 tests + deferred-items.md + this SUMMARY.md)
- 6 modified files found (sanitize.ts, PROJECT.md, 4 callers)
- PROJECT.md contains AUDIT-01 deferral row
- sanitize.ts JSDoc contains v2.5 milestone summary + Deferred AUDIT-01 sections
- All 4 callers no longer contain `sanitize: false`
- ParseConfig.sanitize `@deprecated` field preserved in notes.ts
