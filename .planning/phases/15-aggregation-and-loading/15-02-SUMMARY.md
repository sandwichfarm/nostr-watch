---
phase: 15-aggregation-and-loading
plan: 02
subsystem: ui
tags: [svelte, svelte-store, monitors, liveness, loading-state, progressive-reveal]

# Dependency graph
requires:
  - phase: 15-aggregation-and-loading
    plan: 01
    provides: Collapsed monitors store chain with livenessReady-ready liveness computation
provides:
  - livenessReady writable store flag set to true after first successful liveness computation
  - Progressive reveal: monitor rows show immediately, count columns show dash until ready
  - Empty state: "No monitors found" message when genuinely no monitors exist
  - Null-safe count formatters in dataTable/monitors.ts
affects: [monitors page, dataTable/monitors, liveness counts display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Progressive reveal: separate monitors store from monitorRows for empty-state discrimination"
    - "Null sentinel: liveness counts use null (not 0) to signal uninitialized state in formatters"
    - "Cache-aware initialization: livenessReady set immediately at startup if cached data has non-zero counts"

key-files:
  created: []
  modified:
    - apps/gui/src/lib/stores/monitors.ts
    - apps/gui/src/routes/monitors/+page.svelte
    - apps/gui/src/lib/config/dataTable/monitors.ts

key-decisions:
  - "Use null (not 0) as the sentinel for uninitialized liveness counts — enables formatters to distinguish 'not ready' from 'zero relays'"
  - "livenessReady set immediately at startup if cached data has any non-zero counts — returning users skip loading dash"
  - "Empty state uses !$monitors.length not !$monitorRows.length — discriminates no-monitors from rows-still-computing"

patterns-established:
  - "Null sentinel pattern: use null values to distinguish 'not yet computed' from 'computed zero' in derived stores"
  - "Cache-aware readiness: check cached data at store initialization to pre-set ready flags for returning users"

requirements-completed: [LOAD-01, LOAD-02, LOAD-03]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 15 Plan 02: Aggregation and Loading Summary

**livenessReady flag with progressive reveal — count columns show '-' during initialization and resolve to real numbers after first computation; empty state shows 'No monitors found' when no monitors exist**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T21:35:24Z
- **Completed:** 2026-03-22T21:40:00Z
- **Tasks:** 2 (Task 3 is checkpoint:human-verify — awaiting user verification)
- **Files modified:** 3

## Accomplishments
- Added `livenessReady` writable store (false by default, set to true after first successful computation or if cached data has non-zero counts)
- Updated `monitorRows` derived to produce `null` counts when `livenessReady` is false, enabling downstream formatters to show '-' instead of 0
- Updated all three count formatters (`reportingOnline`, `reportingOffline`, `likelyDead`) to return a dash span when value is `null`
- Added `monitors` import to `+page.svelte` and `{:else if !$monitors.length}` block with "No monitors found" message

## Task Commits

Each task was committed atomically:

1. **Task 1: Add livenessReady flag and integrate into monitorRows** - `f3c5cc26` (feat)
2. **Task 2: Update page with progressive reveal, loading columns, and empty state** - `6c220f15` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/gui/src/lib/stores/monitors.ts` - Added livenessReady store, cache-aware initialization, updated monitorRows derived
- `apps/gui/src/routes/monitors/+page.svelte` - Added monitors import, empty state message
- `apps/gui/src/lib/config/dataTable/monitors.ts` - Added null guards to count formatters

## Decisions Made
- Used `null` (not `0`) as the sentinel for uninitialized liveness counts — this is the key distinction that makes formatters show '-' vs '0' for the uninitialized case
- `livenessReady` is initialized by checking if cached data has non-zero counts; this means returning users with warm cache see actual numbers immediately (no flash of dashes)
- Empty state check uses `!$monitors.length` (not `!$monitorRows.length`) because `monitorRows` is always non-empty when monitors exist — it derives from monitors, so the distinction needs to be upstream

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Task 3 (checkpoint:human-verify) is pending user verification of the monitors page behavior
- After user approval: phase 15 is complete and the monitors page fix milestone (v2.2) is done
- The monitors page now has correct progressive reveal, accurate counts, and an empty state

---
*Phase: 15-aggregation-and-loading*
*Completed: 2026-03-22*
