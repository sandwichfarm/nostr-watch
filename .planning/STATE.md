---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Relay Dedup Family Scope
status: Ready to execute
stopped_at: Completed 20-02-config-extension-PLAN.md
last_updated: "2026-04-11T22:15:11.898Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 12
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Anyone can run their own relay monitor — from watching a handful of personal relays to scanning the entire network — with a one-click install on self-hosted platforms.
**Current focus:** Phase 20 — Dedup Performance & Overrides

## Current Position

Phase: 20 (Dedup Performance & Overrides) — EXECUTING
Plan: 3 of 4

Phases 17, 18, 19 complete on disk (artifacts under `.planning/phases/`). v2.3 roadmap entry added to ROADMAP.md in this commit to catch up documentation to shipped state.

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
| Phase 20-dedup-performance-overrides P02 | 2min | 1 tasks | 1 files |
| Phase 20-dedup-performance-overrides P01 | 4min | 2 tasks | 8 files |

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
- [Phase 20-dedup-performance-overrides]: Plan 20-02: Default applied via validateConfig mutation, not processConfigTimeValues — keeps Plan inside strict single-file constraint and matches existing lazy conversion pattern for nip11_cache_ttl
- [Phase 20-dedup-performance-overrides]: DedupOverrideRule locked to 4 fields (name/test/action/reason); evaluator parses URL once + per-rule try/catch; static barrel + first-match-wins, no priority field
- [Phase 20-dedup-performance-overrides]: Per-rule isolation: each override rule has its own source file AND its own test file; no cross-test imports — adding a new override = create one source + one test + add one barrel line

### Pending Todos

None yet.

### Blockers/Concerns

- Detail page (/monitors/[pubkey]) is out of scope — working acceptably, do not touch

## Session Continuity

Last session: 2026-04-11T22:15:11.865Z
Stopped at: Completed 20-02-config-extension-PLAN.md
Resume file: None
