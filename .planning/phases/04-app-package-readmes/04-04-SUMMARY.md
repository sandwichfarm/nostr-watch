---
phase: 04-app-package-readmes
plan: "04"
subsystem: documentation
tags: [markdown, browser-extension, svelte4, manifest-v3, deprecation-stub, md043]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: MD043 required section order, markdownlint-cli2 config, styleguide deprecation stub template

provides:
  - apps/nocapd/README.md -- MD043-compliant deprecation stub redirecting to relaymon
  - apps/umon/README.md -- Full browser extension README with build and load-unpacked instructions

affects: [docs-site, vitepress, ci-lint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deprecation stub includes all MD043-required sections (Overview, Installation, Quick Start, Known Limitations, License) even when content is N/A
    - Optional sections (Why deprecated, Migrating) inserted between required MD043 anchors
    - Browser extension README uses scope badge instead of npm version badge

key-files:
  created:
    - apps/umon/README.md
  modified:
    - apps/nocapd/README.md

key-decisions:
  - "nocapd relative link uses ../relaymon/README.md (sibling directories within apps/) not ../../apps/relaymon/README.md"
  - "umon package name confirmed as @nostrwatch/umon from package.json (not @nicfab/umon as plan noted to verify)"
  - "umon uses scope badge (not npm version badge) since it is a browser extension not published to npm"

patterns-established:
  - "Pattern: Deprecation stubs include all MD043 required sections even when content is N/A -- consistent with Phase 2-03 decision"
  - "Pattern: Browser extension READMEs document both Chrome and Firefox unpacked load procedures in Quick Start"

requirements-completed: [APP-06, APP-08]

# Metrics
duration: 1min
completed: 2026-03-05
---

# Phase 4 Plan 04: nocapd deprecation stub and umon browser extension READMEs

**nocapd MD043-compliant deprecation stub redirecting to relaymon, and umon Manifest V3 browser extension README with pnpm build and unpacked extension load instructions**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-05T09:18:52Z
- **Completed:** 2026-03-05T09:20:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced nocapd's ad-hoc partial stub with a full MD043-compliant deprecation stub containing all required sections and a prominent DEPRECATED blockquote banner
- Created umon README from scratch documenting its Manifest V3 browser extension nature, Svelte 4 popup, background service worker, pnpm build workflow, and unpacked extension loading for both Chrome and Firefox
- Both files pass markdownlint-cli2 with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Write apps/nocapd deprecation stub README.md** - `80ba66ae` (feat)
2. **Task 2: Write apps/umon README.md** - `1a7a79ac` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `apps/nocapd/README.md` -- Full deprecation stub: DEPRECATED banner, Why deprecated, Migrating, plus MD043-required sections with N/A content
- `apps/umon/README.md` -- Complete browser extension README: Overview, Prerequisites (dev vs end-user), Installation, Quick Start with Chrome and Firefox load steps, Configuration, Known Limitations, License

## Decisions Made

- nocapd relative link uses `../relaymon/README.md` (apps/ sibling directories); the styleguide concrete example used `../../apps/relaymon/README.md` which is a longer path from a different base -- the shorter sibling path is correct
- umon package name confirmed as `@nostrwatch/umon` from package.json (plan noted `@nicfab/umon` as a possibility to verify; it is not)
- umon uses scope badge instead of npm version badge since it is a browser extension not published to npm

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- nocapd and umon READMEs complete; apps/ package documentation for these two packages is finished
- Remaining apps in Phase 4 (04-01 through 04-03) cover gui, rstate, trawler, relaymon, purist, and docker-stacks

---

*Phase: 04-app-package-readmes*
*Completed: 2026-03-05*

## Self-Check: PASSED

- FOUND: apps/nocapd/README.md
- FOUND: apps/umon/README.md
- FOUND: .planning/phases/04-app-package-readmes/04-04-SUMMARY.md
- FOUND commit: 80ba66ae (feat(04-04): write nocapd deprecation stub README)
- FOUND commit: 1a7a79ac (feat(04-04): write umon browser extension README)
