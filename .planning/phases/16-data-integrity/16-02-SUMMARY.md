---
phase: 16-data-integrity
plan: 02
subsystem: ui
tags: [svelte, tailwind, css-animation, css-transition, data-freshness, liveness]

# Dependency graph
requires:
  - phase: 16-data-integrity
    plan: 01
    provides: "monitorFreshness store and row.livenessFresh boolean in monitorRows derived store"
  - phase: 16-data-integrity
    plan: 00
    provides: "Wave 0 RED-phase test scaffolds for formatter states and freshness store"
provides:
  - "Muted pulsing pending state for count columns when monitor backfill not complete"
  - "Full-color fresh state with smooth 500ms CSS transition when monitor is fresh"
  - "liveness-pulse Tailwind keyframes animation (1.8s ease-in-out infinite)"
  - "Global CSS hooks :global(.liveness-pending) and :global(.liveness-fresh) for {@html}-injected spans"
affects: [16-data-integrity, monitors-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-state formatter pattern: null (dash) / pending (muted gray + pulse) / fresh (full color)"
    - "Global Svelte :global() CSS for formatters that inject HTML via {@html}"
    - "Tailwind content-scanner-safe literal class strings in formatter return values"
    - "Freshness driven by liveness computation event, not bootstrap lifecycle"

key-files:
  created: []
  modified:
    - apps/gui/tailwind.config.ts
    - apps/gui/src/lib/config/dataTable/monitors.ts
    - apps/gui/src/routes/monitors/+page.svelte

key-decisions:
  - "Freshness signalled from liveness computation completion, not bootstrap lifecycle — avoids premature fresh state on cached-only rows"

patterns-established:
  - "Three-state formatter: null = dash, !livenessFresh = animate-liveness-pulse liveness-pending, livenessFresh = liveness-fresh full-color"
  - "liveness-pulse keyframe uses opacity fade (0.4 ↔ 0.7) at 1.8s cycle, defined in Tailwind theme.extend"

requirements-completed: [DATA-02]

# Metrics
duration: ~45min
completed: 2026-03-24
---

# Phase 16 Plan 02: Data Integrity — Freshness Indicator Summary

**CSS liveness-pulse animation and three-state count formatters give monitors page users instant visual confidence about data freshness — pending rows pulse gray until liveness computation fires, then fade to green/orange/red over 500ms**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-24
- **Completed:** 2026-03-24
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments

- Added `liveness-pulse` Tailwind keyframes animation (opacity 0.4-0.7, 1.8s infinite) alongside existing `flash` animation
- Updated all three count formatters (`reportingOnline`, `reportingOffline`, `likelyDead`) to consume `row.livenessFresh` as second argument and branch on pending/fresh state
- Added global CSS in `+page.svelte` for smooth 500ms color transition between pending and fresh states
- Fixed freshness triggering to be driven by liveness computation, not bootstrap lifecycle (fix commit e6c0b9e2)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add liveness-pulse animation and update count formatters** - `5b68ab91` (feat)
2. **Task 2: Fix — mark monitors fresh from liveness computation** - `e6c0b9e2` (fix, applied before checkpoint approval)

## Files Created/Modified

- `apps/gui/tailwind.config.ts` — Added `liveness-pulse` keyframe (opacity 0.4/0.7) and animation (`1.8s ease-in-out infinite`)
- `apps/gui/src/lib/config/dataTable/monitors.ts` — Updated `reportingOnline`, `reportingOffline`, `likelyDead` formatters with three-state rendering; all class strings are full literals for Tailwind purge safety
- `apps/gui/src/routes/monitors/+page.svelte` — Added `<style>` block with `:global(.liveness-pending)` and `:global(.liveness-fresh)` for `{@html}`-injected content

## Decisions Made

- **Freshness tied to liveness computation, not bootstrap:** Initial implementation triggered fresh state from the bootstrap lifecycle which fired too early on cached rows. The fix (e6c0b9e2) moved the `markFresh(pubkey)` call to fire only after `computeAndUpdateRelayLiveness` completes, ensuring the color transition reflects genuinely computed data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Freshness triggered prematurely from bootstrap lifecycle**
- **Found during:** Task 2 (checkpoint:human-verify)
- **Issue:** Fresh state was being signalled at bootstrap lifecycle completion rather than liveness computation completion, causing count columns to show full color before data was actually computed
- **Fix:** Moved freshness signal into the liveness computation callback so `livenessFresh` only becomes `true` once per-monitor liveness has been actually calculated
- **Files modified:** `apps/gui/src/lib/stores/monitors.ts`
- **Verification:** User visually confirmed correct behavior after fix — pending state persists until liveness computation fires
- **Committed in:** `e6c0b9e2` (fix before checkpoint approval)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in freshness trigger timing)
**Impact on plan:** Fix was essential for the feature to behave correctly. No scope creep.

## Issues Encountered

- Freshness signal timing: the plan assumed bootstrap lifecycle was the right hook, but liveness computation is the actual authoritative event. The fix was straightforward once identified during human verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DATA-02 visual layer is complete and user-approved
- Phase 16-data-integrity Plan 03 (if any) can build on the `row.livenessFresh` boolean and established three-state formatter pattern
- The liveness-pulse animation class is available globally via Tailwind for reuse in other table contexts

---
*Phase: 16-data-integrity*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: .planning/phases/16-data-integrity/16-02-SUMMARY.md
- FOUND: commit e6c0b9e2 (fix — freshness from liveness computation)
- FOUND: commit 5b68ab91 (feat — liveness indicator formatters)
