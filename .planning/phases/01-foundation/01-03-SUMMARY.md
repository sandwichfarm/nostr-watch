---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [github-actions, markdownlint, lychee, ci, docs-lint]

requires:
  - phase: 01-01
    provides: ".markdownlint-cli2.jsonc config file that CI workflow reads"

provides:
  - GitHub Actions workflow (.github/workflows/docs-lint.yml) enforcing markdownlint and link checking on PRs
  - .lycheeignore exclusion list for relay URLs and known-flaky domains
  - lint:docs script in root package.json (verified pre-existing from plan 01-02)

affects:
  - All future phases that add or modify Markdown files in libraries/apps/internal
  - Any PR workflow that touches .md files

tech-stack:
  added: [DavidAnson/markdownlint-cli2-action@v22, lycheeverse/lychee-action@v2, actions/cache@v4]
  patterns:
    - PR-blocking CI checks with warn-only push-to-main behavior via continue-on-error and fail conditionals
    - Lychee link cache persisted with actions/cache keyed on markdown file hashes

key-files:
  created:
    - .github/workflows/docs-lint.yml
    - .lycheeignore
  modified: []

key-decisions:
  - "continue-on-error conditional on event_name != pull_request makes markdownlint warn-only on main push but blocking on PRs"
  - "lychee fail conditional on event_name == pull_request mirrors same PR-blocking/main-warn-only pattern"
  - "lychee cache keyed on hashFiles('**/*.md') — cache miss only when markdown changes, avoiding unnecessary re-checks"
  - "Globs in CI match package.json lint:docs script exactly — libraries/*/README.md, apps/*/README.md, internal/*/README.md"
  - "Link check scope extends to docs/**/*.md beyond what lint:docs checks (CI-only, lychee not installed locally)"
  - "No local link-check script added — lychee is CI-only per RESEARCH.md"

patterns-established:
  - "Warn-only-on-main: use continue-on-error: ${{ github.event_name != 'pull_request' }} for GitHub Actions steps"
  - "CI globs always match local lint script globs to keep local/CI parity"

requirements-completed: [FOUND-05, FOUND-06]

duration: 2min
completed: 2026-03-04
---

# Phase 1 Plan 03: Docs Lint CI Summary

**GitHub Actions workflow enforcing markdownlint-cli2 and lychee link checking on PRs (blocking) and push to main (warn-only) with relay URL exclusions**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-04T17:11:52Z
- **Completed:** 2026-03-04T17:13:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `.github/workflows/docs-lint.yml` with markdownlint and linkcheck jobs, PR-blocking behavior, warn-only on main
- Created `.lycheeignore` excluding wss:// relay URLs, shields.io, badge.fury.io, and npmjs.com from link checks
- Verified `lint:docs` script already present in package.json with correct globs matching CI (no change needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions docs-lint workflow and lychee exclusion list** - `ec9a4270` (chore)
2. **Task 2: Ensure lint:docs script in root package.json matches CI command** - no commit (script pre-existing and correct)

## Files Created/Modified

- `.github/workflows/docs-lint.yml` - GitHub Actions workflow; two jobs (markdownlint, linkcheck) triggered on PR/push to main with MD path filter
- `.lycheeignore` - Lychee link exclusion list; regex patterns for relay URLs and flaky badge/npm domains

## Decisions Made

- lychee `fail` conditional mirrors markdownlint `continue-on-error` pattern — both blocking on PRs, warn-only on main push
- Link check scope (`docs/**/*.md`) is broader than `lint:docs` scope intentionally — link checking the VitePress docs pages is CI-only
- Lychee cache key uses `hashFiles('**/*.md')` to invalidate only when markdown changes

## Deviations from Plan

None - plan executed exactly as written. The `lint:docs` script was already present from plan 01-02 with the correct command; Task 2 was verification-only with no file modifications required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The `GITHUB_TOKEN` used by lychee-action is the built-in Actions token; no secrets configuration needed.

## Next Phase Readiness

- Docs CI enforcement complete — any PR touching Markdown files in libraries/apps/internal will be linted and link-checked automatically
- Foundation phase (01) is now complete: styleguide (01-01), VitePress site (01-02), and CI enforcement (01-03)
- Ready for Phase 2 (package README authoring) with both local lint (`pnpm lint:docs`) and CI checks in place

---
*Phase: 01-foundation*
*Completed: 2026-03-04*
