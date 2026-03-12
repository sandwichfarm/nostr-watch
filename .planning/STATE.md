---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Wider NIP Support
status: ready_to_plan
last_updated: "2026-03-12"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** The auditor can test any Nostr relay against every NIP that defines relay behavior
**Current focus:** Phase 5 — Foundation (ready to plan)

## Current Position

Phase: 5 of 9 (Foundation)
Plan: — of — in current phase
Status: Ready to plan
Last activity: 2026-03-12 — Roadmap created, 29 requirements mapped across 5 phases (5-9)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v2.0 Init]: Behavioral tests over schema-heavy — verify relay does the right thing
- [v2.0 Init]: Keep auto-detect via NIP-11 supported_nips
- [v2.0 Init]: Complete NIP-42 scaffolding (has schemata/interfaces, needs runnable suite)
- [v2.0 Init]: Use nostr-tools/pure (not /wasm) — no async init overhead in test runner
- [v2.0 Init]: Ephemeral keypairs per run — prevent test event pollution on live relays
- [v2.0 Init]: Phase 8 depends on Phase 6 (NIP-70 requires AUTH); Phases 7 and 9 only need Phase 5

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5]: formatNip() bug silently drops suites for NIP numbers >= 100 — must fix before any new suites run
- [Phase 6]: NIP-42 Nip42/index.ts is a bare class — does not extend Suite, no slug, no test() method, absent from both manifests
- [Phase 7]: NIP-40 second criterion (EXP-02 — stored expired events not served) may need timing strategy validation against a real relay; marked WARN not FAIL per spec

## Session Continuity

Last session: 2026-03-12
Stopped at: Roadmap written — ROADMAP.md, STATE.md, REQUIREMENTS.md traceability updated
Resume file: None
