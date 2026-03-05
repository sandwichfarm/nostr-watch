---
phase: 01-foundation
plan: 04
subsystem: tooling
tags: [markdownlint, vitepress, package-discovery, linting, monorepo]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: VitePress setup and markdownlint config from plans 01-02 and 01-01
provides:
  - markdownlint-cli2 installed in devDependencies (pnpm lint:docs functional)
  - VitePress data loader discovers all 38 package directories including 10 without package.json
affects: [02-apps, 03-libraries, 04-internal, 05-skills]

# Tech tracking
tech-stack:
  added: [markdownlint-cli2 ^0.17.0]
  patterns: [directory-first package discovery with optional package.json read]

key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml
    - docs/.vitepress/packages.data.ts

key-decisions:
  - "Directory glob {apps,libraries,internal}/*/ chosen over package.json glob to ensure all directories discovered regardless of manifest presence"
  - "fs.existsSync used to gate package.json reads — directories without manifest fall back to slug name, empty description/version, alpha status"

patterns-established:
  - "Package discovery: glob directories first, then optionally read package.json for metadata — not package.json-first"

requirements-completed: [FOUND-05, FOUND-08]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 1 Plan 4: Gap Closure Summary

**markdownlint-cli2 added to devDependencies and VitePress data loader rewritten to discover all 38 package directories via directory glob with optional package.json fallback**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-04T17:40:00Z
- **Completed:** 2026-03-04T17:43:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added markdownlint-cli2 to devDependencies so `pnpm lint:docs` resolves binary from node_modules (FOUND-05 gap closed)
- Rewrote packages.data.ts to glob directories first, then read package.json when present — discovers all 38 directories vs. previous 28 (FOUND-08 gap closed)
- 10 previously invisible directories (docker-stacks, purist, relaymon, trawler, idb, kit, nip66, sanitize, transform, kinds) now appear in the VitePress package index

## Task Commits

Each task was committed atomically:

1. **Task 1: Add markdownlint-cli2 to devDependencies** - `70c080d3` (chore)
2. **Task 2: Update data loader to discover all package directories** - `f63cce7b` (feat)

## Files Created/Modified
- `package.json` - Added markdownlint-cli2 ^0.17.0 to devDependencies
- `pnpm-lock.yaml` - Updated lockfile after pnpm install
- `docs/.vitepress/packages.data.ts` - Rewritten to glob directories and optionally read package.json

## Decisions Made
- Used directory glob `{apps,libraries,internal}/*/` instead of package.json glob — future-proof, discovers all dirs regardless of manifest presence
- fs.existsSync gates package.json reads: fallback uses slug as name, empty strings for description/version, alpha for status — consistent with existing default behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both FOUND-05 and FOUND-08 verification gaps from 01-VERIFICATION.md are resolved
- Phase 1 gap closure complete; ready for Phase 2

---
*Phase: 01-foundation*
*Completed: 2026-03-04*
