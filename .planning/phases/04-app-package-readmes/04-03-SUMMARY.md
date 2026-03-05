---
phase: 04-app-package-readmes
plan: 03
subsystem: documentation
tags: [markdownlint, md043, readme, docker-compose, browser-app, static-assets]

requires:
  - phase: 01-foundation
    provides: markdownlint-cli2 config with MD043 required heading order, styleguide

provides:
  - apps/purist/README.md — browser-only relay scanner README with no-install hosting instructions
  - apps/docker-stacks/README.md — Docker Compose stacks README with 5-stack table and docker compose up workflow

affects:
  - 04-app-package-readmes (contributes to APP-05 and APP-07 requirements)

tech-stack:
  added: []
  patterns:
    - "Pre-built browser apps (no source) get minimal full README noting dist/ hosting, not deprecation stub"
    - "Infrastructure packages (Docker Compose) adapt standard app README: Installation = no npm install, Quick Start = docker compose up"
    - "Scope badge replaces npm version badge for packages without package.json"

key-files:
  created:
    - apps/purist/README.md
  modified:
    - apps/docker-stacks/README.md

key-decisions:
  - "purist README uses scope badge (not npm version) — no package.json exists in the package directory"
  - "purist Known Limitations explicitly states source code is absent from the repository — no workaround available"
  - "docker-stacks Available Stacks table lists all 5 variants with their Services column — matches research-confirmed directory structure"
  - "docker-stacks Installation section uses sh + ls command only, not npm/pnpm — Docker Compose is infra not a Node app"

requirements-completed:
  - APP-05
  - APP-07

duration: 5min
completed: 2026-03-05
---

# Phase 4 Plan 03: Unusual App READMEs Summary

**Pre-built browser relay scanner (purist) and Docker Compose stacks (docker-stacks) documented with adapted styleguide structure — both pass MD043 linting with zero errors**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-05T09:15:00Z
- **Completed:** 2026-03-05T09:20:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- apps/purist/README.md created from scratch — browser-only relay scanner documented honestly with no fabricated source details
- apps/docker-stacks/README.md rewritten from non-conforming format — all 5 stack variants in table with services and descriptions
- Both READMEs pass `pnpm lint:docs` with zero errors (0 error total across 38 files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write apps/purist README.md** - `bb8301ed` (feat)
2. **Task 2: Write apps/docker-stacks README.md** - `2ea1c139` (feat)

## Files Created/Modified

- `apps/purist/README.md` - Browser relay scanner README with dist/ hosting instructions and Known Limitations noting absent source
- `apps/docker-stacks/README.md` - Docker Compose stacks README with 5-stack table, docker compose up workflow, Prerequisites section

## Decisions Made

- purist uses scope badge instead of npm version badge — no package.json exists, so the npm badge is inapplicable
- purist Known Limitations calls out both the missing source and the missing package.json as separate bullets — users need to know both constraints
- docker-stacks Quick Start uses shell commands with `docker compose` (v2 subcommand syntax), not legacy `docker-compose` — matches Prerequisites noting Docker Compose v2
- docker-stacks Available Stacks is a custom optional section inserted between Quick Start and Configuration — MD043 wildcard absorbs it correctly

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Both READMEs passed markdownlint-cli2 on first attempt with zero errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- APP-05 and APP-07 requirements complete
- Phase 4 plan 03 of 03 done — phase 04 complete
- Phase 5 (Skills) is next in the roadmap

---
*Phase: 04-app-package-readmes*
*Completed: 2026-03-05*
