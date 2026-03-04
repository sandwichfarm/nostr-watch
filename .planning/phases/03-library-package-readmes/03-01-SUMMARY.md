---
phase: 03-library-package-readmes
plan: 01
subsystem: documentation
tags: [nostrings, nip66, schemata, ajv, relay-url, json-schema, nip-66, markdownlint]

requires:
  - phase: 01-foundation
    provides: markdownlint-cli2 config and MD043 heading rules that all READMEs must satisfy
  - phase: 01-foundation
    provides: docs/styleguide/README.md establishing badge patterns, code style conventions, and section requirements

provides:
  - libraries/nostrings/README.md — styleguide-conforming README documenting sanitize, qualify, normalize, dedup functions with correct package name @nostrwatch/nostrings
  - libraries/nip66/README.md — protocol documentation for NIP-66 event kinds 10166, 30166, 1066 with complete tag tables
  - libraries/schemata/README.md — README noting migration to @nostrability/schemata, documents JSON Schema coverage by NIP
  - libraries/schemata-js-ajv/README.md — documents validateNip11, validateMessage, validateNote with TypeScript signatures and SchemaValidatorResult type

affects:
  - 03-02-nocap — establishes pattern for library READMEs that later plans follow
  - 03-03-route66 — same styleguide pattern applies
  - phase 04 (app READMEs) — inherits MD043 patterns from this execution

tech-stack:
  added: []
  patterns:
    - "Library README pattern: npm badge + license + status + runtime badges, then Overview/Installation/Quick Start/API/Known Limitations/Agent Skills/Related Packages/License"
    - "Protocol documentation library pattern: no npm badge, scope badge instead, no Quick Start code (data examples only)"
    - "Migration note pattern: prominent blockquote or paragraph in Overview and Installation directing to successor package"

key-files:
  created:
    - libraries/nip66/README.md
  modified:
    - libraries/nostrings/README.md
    - libraries/schemata/README.md
    - libraries/schemata-js-ajv/README.md

key-decisions:
  - "nip66 README uses scope badge (not npm badge) since the directory has no package.json — internal-style badge signals non-published status"
  - "nip66 Quick Start uses JSON data examples (not runnable code) since the package has no executable TypeScript"
  - "schemata-js-ajv documents actual validateMessage signature including third slug parameter, which the existing README omitted"
  - "nostrings README documents additional exports (sanitizeRelayUrl, maybeSplitRelayList, isLocal, isLocalNet) beyond the four primary functions"

patterns-established:
  - "Protocol-only library (no source): use scope badge, document event kinds as data examples in Quick Start, Known Limitations notes code-only nature"
  - "Migrating package: note migration target in Overview and Installation, link to successor in Related Packages"

requirements-completed: [LIB-13, LIB-12, LIB-04, LIB-05]

duration: 3min
completed: 2026-03-04
---

# Phase 3 Plan 01: Protocol and Validation Layer READMEs Summary

**Four styleguide-conforming READMEs for the protocol/validation layer: nostrings URL sanitization (corrected package name), NIP-66 protocol reference (event kinds 10166/30166/1066 with tag tables), schemata (migration note to @nostrability/schemata), and schemata-js-ajv (AJV validation wrapper with typed signatures)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-04T23:09:07Z
- **Completed:** 2026-03-04T23:12:05Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Rewrote nostrings README with correct package name (`@nostrwatch/nostrings`, not the old `@nostrwatch/relay-sanitizer`), all four exported functions documented with actual TypeScript signatures from source
- Created nip66 README as protocol documentation — explains all three NIP-66 event kinds (10166, 30166, 1066), complete tag tables for each kind, R tag convention, links to publisher implementation
- Rewrote schemata README noting the in-progress migration to `@nostrability/schemata`, documents NIP coverage by schema file
- Rewrote schemata-js-ajv README with accurate function signatures (including the third `slug` parameter in `validateMessage` that the existing README omitted), `SchemaValidatorResult` type documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write README for libraries/nostrings** - `e437c1fe` (feat)
2. **Task 2: Write README for libraries/nip66** - `19043dfc` (feat)
3. **Task 3: Write READMEs for libraries/schemata and libraries/schemata-js-ajv** - `565f48d4` (feat)

## Files Created/Modified

- `libraries/nostrings/README.md` — rewritten; correct package name, four-function API, additional exports, TypeScript examples
- `libraries/nip66/README.md` — created; NIP-66 protocol reference with event kind tables and tag documentation
- `libraries/schemata/README.md` — rewritten; migration notice to @nostrability/schemata, NIP coverage table
- `libraries/schemata-js-ajv/README.md` — rewritten; AJV validation functions with accurate TypeScript signatures, SchemaValidatorResult type

## Decisions Made

- **nip66 scope badge:** Since `libraries/nip66/` has no `package.json`, the package is not published to npm. Used the internal scope badge pattern from the styleguide rather than a broken npm badge.
- **nip66 Quick Start as data examples:** The directory has no executable TypeScript. The Quick Start section shows JSON event examples rather than runnable code — this satisfies the MD043 requirement while being honest about the package nature.
- **validateMessage actual signature:** The existing schemata-js-ajv README showed `validateMessage(message, subject)` but the actual source takes a third `slug` parameter. Documented the correct three-parameter signature.
- **nostrings additional exports:** Beyond sanitize/qualify/normalize/dedup, the source exports `sanitizeRelayUrl`, `maybeSplitRelayList`, `normalizeRelayUrls`, `normalizeRelayUrlAcc`, `isLocal`, and `isLocalNet`. All documented in the API section.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four READMEs pass `markdownlint-cli2` with zero errors
- nip66 README satisfies the phase success criterion (NIP-66 newcomer can understand event kinds and data model)
- schemata and schemata-js-ajv are cross-linked in Related Packages
- Ready for 03-02 (nocap adapter documentation)

---

*Phase: 03-library-package-readmes*
*Completed: 2026-03-04*
