---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Fix Monitors Page
status: unknown
stopped_at: Completed 16-02-PLAN.md
last_updated: "2026-03-24T01:23:52.837Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Anyone can run their own relay monitor — from watching a handful of personal relays to scanning the entire network — with a one-click install on self-hosted platforms.
**Current focus:** Phase 16 — data-integrity

## Current Position

Phase: 16 (data-integrity) — COMPLETE
Plan: 3 of 3 (all plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (this milestone)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 14-revert-broken-bugfix P01 | 6 | 2 tasks | 2 files |
| Phase 15-aggregation-and-loading P01 | 2 | 2 tasks | 2 files |
| Phase 15 P02 | 5 | 2 tasks | 3 files |
| Phase 15-aggregation-and-loading P02 | 5 | 3 tasks | 3 files |
| Phase 16-data-integrity P00 | 3 | 2 tasks | 2 files |
| Phase 16 P01 | 5 | 2 tasks | 5 files |
| Phase 16-data-integrity P02 | ~45 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- Revert first: Start from pre-bugfix/monitor-pages-aggregation state, fix properly afterward
- v2.1 shelved: Test profiles work (Phases 11-13) not abandoned, just paused
- v3.0 continues separately: Self-hosted distribution on feature/self-hosted branch (PR #874)
- [Phase 14-revert-broken-bugfix]: Revert first: surgically remove all PR #861 changes to establish known-good baseline before re-implementing aggregation properly in Phase 15
- [Phase 15-aggregation-and-loading]: Collapsed monitors+monitorsSorted into single derived store with re-export alias; StateManager.set extracted into separate subscription to break localStorage cascade
- [Phase 15-aggregation-and-loading]: computeAndUpdateRelayLiveness now unconditionally overwrites liveness counts with dead-threshold zeroing — no merge with stale data
- [Phase 15-aggregation-and-loading]: null sentinel for uninitialized liveness counts: enables formatters to show '-' vs '0' for uninitialized state
- [Phase 15-aggregation-and-loading]: livenessReady initialized from cache at startup: returning users with warm cache skip loading dashes
- [Phase 15-aggregation-and-loading]: empty state checks monitors.length not monitorRows.length: discriminates no-monitors from rows-still-computing
- [Phase 15-aggregation-and-loading]: Checkpoint:human-verify approved: monitors page shows progressive reveal with '-' count columns until livenessReady, resolving to real numbers after first computation
- [Phase 16-data-integrity]: TDD RED scaffolds use vi.mock() for localStorage-dependent store imports in test environment; computeActive pure function in test file validates formula contract Plan 01 must implement
- [Phase 16-data-integrity]: monitorFreshness store tests use dynamic import() + manual cleanup; dataTable tests mock $lib/stores/monitors.js to prevent module-level localStorage crash
- [Phase 16-data-integrity]: monitorFreshness is ephemeral — never persisted to StateManager/localStorage to avoid stale fresh-flags across sessions
- [Phase 16-data-integrity]: monitorsLivenessLeniency added as reactive derived input to monitorRows so leniency changes instantly re-derive all rows without separate trigger
- [Phase 16-data-integrity P02]: Freshness signal driven by liveness computation completion, not bootstrap lifecycle — avoids premature fresh state on cached-only rows

### Pending Todos

None yet.

### Blockers/Concerns

- Detail page (/monitors/[pubkey]) is out of scope — working acceptably, do not touch

## Session Continuity

Last session: 2026-03-24T00:00:00.000Z
Stopped at: Completed 16-02-PLAN.md
Resume file: None
