---
phase: 01-foundation
plan: 01
subsystem: documentation
tags: [markdownlint, markdownlint-cli2, shields.io, readme, styleguide, MD043]

requires: []

provides:
  - README styleguide document at docs/styleguide/README.md defining section order, badge format, code example conventions, tone, Known Limitations template, and Deprecation Stub template
  - markdownlint-cli2 configuration at .markdownlint-cli2.jsonc with MD043 section-order enforcement scoped to package READMEs

affects:
  - 01-02 (CI/linting workflow depends on .markdownlint-cli2.jsonc)
  - 01-03 (VitePress config can reference styleguide)
  - 02-apps (all app READMEs must follow this styleguide)
  - 03-libraries (all library READMEs must follow this styleguide)
  - 04-internal (all internal package READMEs must follow this styleguide)

tech-stack:
  added:
    - markdownlint-cli2 v0.21.0 (already installed; config added)
  patterns:
    - MD043 with wildcard entries for required-section-order enforcement without blocking optional sections
    - shields.io badge format for npm version, license, status, and runtime support
    - ESM import style in code examples matching .prettierrc.yaml conventions (no semicolons, single quotes, no bracket spacing)

key-files:
  created:
    - docs/styleguide/README.md
    - .markdownlint-cli2.jsonc
  modified: []

key-decisions:
  - "MD043 with wildcards chosen over custom markdownlint rule — built-in, no implementation cost, sufficient for required-section enforcement"
  - "Globs scoped to libraries/apps/internal package READMEs only — avoids linting .planning/, docs/ pages, and scripts against the package-README ruleset"
  - "MD043 required anchors: Overview, Installation, Quick Start, Known Limitations, License — wildcards absorb all optional sections"
  - "Deprecation stub format uses blockquote banner at top with no badges — deprecated packages get minimal stubs, not full READMEs"

patterns-established:
  - "Badge row: npm version + license + status (alpha/beta/stable/deprecated) + runtime support, all shields.io flat-square style"
  - "Code examples: no semicolons, single quotes, ESM imports, no bracket spacing — matches .prettierrc.yaml exactly"
  - "Known Limitations: bulleted list with what/why/workaround per item, linked to CONCERNS.md or GitHub issues"
  - "Deprecation stub: blockquote warning banner immediately after H1, followed by why-deprecated, migration path, and License only"

requirements-completed:
  - FOUND-01
  - FOUND-02
  - FOUND-03
  - FOUND-04
  - LIMIT-01
  - LIMIT-02

duration: 3min
completed: 2026-03-04
---

# Phase 1 Plan 01: README Styleguide and markdownlint-cli2 Configuration Summary

**Authoritative 686-line README styleguide with shields.io badge templates, code example conventions matching .prettierrc.yaml, Known Limitations and Deprecation Stub templates, and MD043 markdownlint enforcement scoped to package READMEs.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T17:05:41Z
- **Completed:** 2026-03-04T17:09:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wrote `docs/styleguide/README.md` (686 lines) defining all 11 required README sections with purpose, content expectations, and copy-paste examples for each
- Defined badge standards with copy-paste shields.io templates for npm version, license, status (alpha/beta/stable/deprecated), and runtime support badges
- Defined code example conventions matching `.prettierrc.yaml`: no semicolons, single quotes, ESM imports, no bracket spacing, language tags on every fenced block
- Provided concrete Known Limitations template with real examples drawn from `CONCERNS.md` (hardcoded MAX_FILTERS in route66, default relays hardcoded in RelayService)
- Provided concrete Deprecation Stub template with example for `apps/nocapd` (replaced by relaymon)
- Created Package Type Matrix clarifying required vs optional sections per type (library/app/internal)
- Created `.markdownlint-cli2.jsonc` with MD043 section-order enforcement (Overview, Installation, Quick Start, Known Limitations, License as required anchors with wildcards)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the README styleguide document** - `bba2aba8` (feat)
2. **Task 2: Create markdownlint-cli2 configuration** - `1385c4e4` (feat)

**Plan metadata:** (final commit hash — see below)

## Files Created/Modified

- `docs/styleguide/README.md` — Authoritative README styleguide (686 lines): section reference, badge reference, code example guidelines, tone/voice guidelines, Known Limitations template, Deprecation Stub template, Package Type Matrix
- `.markdownlint-cli2.jsonc` — markdownlint-cli2 configuration: MD043 required section order, MD013/MD034 disabled, MD040/MD001/MD022/MD024 enabled, globs scoped to package READMEs only

## Decisions Made

- **MD043 with wildcards over custom rule:** MD043's built-in wildcard `"*"` entries allow optional sections between required anchors without needing a custom rule. This covers the use case at zero additional implementation cost.
- **Globs scoped to package READMEs only:** Setting `globs` to `libraries/*/README.md`, `apps/*/README.md`, `internal/*/README.md` prevents the package-README ruleset from applying to docs/ pages, .planning/ documents, and scripts.
- **Required anchors selection:** Only the sections truly mandatory for every package type (Overview, Installation, Quick Start, Known Limitations, License) are enforced via MD043. All other sections (Prerequisites, API, Configuration, Agent Skills, Related Packages) are optional-by-default — this avoids false failures on stubs and internal packages.
- **Deprecation stubs use no badges:** Deprecated package READMEs get a blockquote banner and minimal prose — no badge row, no API docs. This is simpler to maintain and signals clearly that the package is end-of-life.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Styleguide is ready for all subsequent phases to reference when writing READMEs
- `.markdownlint-cli2.jsonc` is ready for Plan 02 (CI workflow) to wire up via `pnpm lint:docs` script and GitHub Actions
- VitePress config (Plan 03) can reference the styleguide structure for sidebar organization
- All app, library, and internal package README phases (02-04) can begin authoring against this styleguide immediately

---

*Phase: 01-foundation*
*Completed: 2026-03-04*
