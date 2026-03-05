---
phase: 02-internal-package-readmes
plan: 02
subsystem: documentation
tags: [readme, markdownlint, nip-66, nip-65, bullmq, redis, publisher, announce, controlflow]

requires:
  - phase: 01-foundation
    provides: markdownlint-cli2 config, MD043 ruleset, styleguide

provides:
  - internal/publisher/README.md — adapter pattern docs with Kind0/10002/10166/30166 API and Known Limitations
  - internal/controlflow/README.md — BullMQ queue factories and RetryManager docs
  - internal/announce/README.md — AnnounceMonitor class docs with NIP-66/65/01 announcement pattern

affects: [03-library-readmes, 05-skills]

tech-stack:
  added: []
  patterns:
    - "Internal package README uses scope badge (not npm badge)"
    - "Known Limitations sources from CONCERNS.md with direct link"
    - "Adapter pattern documented inline for publisher: base class + kind-specific subclasses"

key-files:
  created:
    - internal/publisher/README.md
    - internal/controlflow/README.md
    - internal/announce/README.md
  modified: []

key-decisions:
  - "publisher README documents both language tag validation concern AND console.log concern from CONCERNS.md — two distinct limitations"
  - "controlflow Known Limitations left as 'none' — no CONCERNS.md entries and no TODOs found in source scan"
  - "announce console.log noted in Known Limitations referencing CONCERNS.md — matches pattern from publisher"

patterns-established:
  - "Known Limitations: bullet per concern, name bolded, references CONCERNS.md with anchor link"
  - "API section: class signature block then per-method bold header with description and parameter table"

requirements-completed: [INT-02, INT-04, INT-07]

duration: 2min
completed: 2026-03-04
---

# Phase 2 Plan 2: Internal Package READMEs (publisher, controlflow, announce) Summary

**Three styleguide-conforming READMEs for behavioral internal packages: publisher adapter pattern with NIP-66 event kinds, BullMQ queue factories with RetryManager, and AnnounceMonitor boot announcement flow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T20:01:46Z
- **Completed:** 2026-03-04T20:04:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `internal/publisher/README.md` — documents the adapter pattern (Publisher + event-kind classes), all four kind classes (Kind0, Kind10002, Kind10166, Kind30166) with method signatures, builder helpers, and two Known Limitations sourced from CONCERNS.md
- `internal/controlflow/README.md` — documents TrawlQueue, NocapdQueue, PersistQueue, QueueInit factories and the RetryManager with exponential delay table
- `internal/announce/README.md` — documents AnnounceMonitor with full options table, three-step flow (generate → sign → publish), and the console.log Known Limitation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write README for internal/publisher** - `83961c14` (feat)
2. **Task 2: Write README for internal/controlflow** - `208a3cd4` (feat)
3. **Task 3: Write README for internal/announce** - `26ebc888` (feat)

## Files Created/Modified

- `internal/publisher/README.md` — adapter pattern, Kind0/10002/10166/30166 API, builder helpers, two Known Limitations
- `internal/controlflow/README.md` — queue factory API, RetryManager with delay table
- `internal/announce/README.md` — AnnounceMonitor constructor/generate/sign/publish API, NIP-66/65/01 explanation

## Decisions Made

- publisher README documents both the language tag validation concern AND the console.log concern from CONCERNS.md — they are distinct limitations with different impact
- controlflow Known Limitations left as "No known limitations at this time" — no CONCERNS.md entries and source audit found no relevant TODOs
- announce console.log limitation noted (matches CONCERNS.md "Console.log Statements in Production Code" which explicitly names `internal/announce/`)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Self-Check

- `internal/publisher/README.md` — found ✓
- `internal/controlflow/README.md` — found ✓
- `internal/announce/README.md` — found ✓
- Commit `83961c14` — found ✓
- Commit `208a3cd4` — found ✓
- Commit `26ebc888` — found ✓

## Self-Check: PASSED

## Next Phase Readiness

- Plans 02-03 through 02-09 (remaining internal packages) can proceed
- publisher adapter pattern is now documented — cross-references from announce README are in place
- controlflow queue pattern documented — any future package using BullMQ can cross-reference this README

---

*Phase: 02-internal-package-readmes*
*Completed: 2026-03-04*
