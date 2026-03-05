---
phase: 03-library-package-readmes
plan: 06
subsystem: documentation
tags: [readme, markdownlint, worker-relay, negentropy, nip-77, sqlite-wasm, opfs, deprecation]

requires:
  - phase: 01-foundation
    provides: styleguide, markdownlint-cli2 config, MD043 section enforcement

provides:
  - libraries/worker-relay/README.md — styleguide-conforming README for WorkerRelayInterface with sqlite-wasm and OPFS
  - libraries/negentropy/README.md — styleguide-conforming README for NIP-77 Negentropy set reconciliation
  - libraries/idb/README.md — deprecation stub for never-implemented IndexedDB wrapper
  - libraries/kit/README.md — deprecation stub for empty adapter scaffold
  - libraries/sanitize/README.md — deprecation stub directing to @nostrwatch/nostrings
  - libraries/transform/README.md — deprecation stub for empty source files

affects:
  - Phase 4 (app READMEs) — patterns for worker-relay and negentropy cross-links
  - VitePress sidebar — new pages at /libraries/idb/, /libraries/kit/, /libraries/sanitize/, /libraries/transform/, /libraries/worker-relay/, /libraries/negentropy/

tech-stack:
  added: []
  patterns:
    - Deprecation stubs include all MD043-required sections even when content is minimal
    - worker-relay NIP-119 AND-filter support documented in Overview
    - negentropy Transport abstraction documented as pluggable interface

key-files:
  created:
    - libraries/idb/README.md
    - libraries/kit/README.md
    - libraries/sanitize/README.md
    - libraries/transform/README.md
  modified:
    - libraries/worker-relay/README.md
    - libraries/negentropy/README.md

key-decisions:
  - "worker-relay README documents H1 heading (fixed existing MD001 violation — previous README started with ## not #)"
  - "negentropy README correctly identifies as NIP-77 (Negentropy protocol) not NIP-49 (Private Key Encryption)"
  - "negentropy README uses pnpm install commands replacing all yarn add references from old README"
  - "Deprecation stubs for idb/kit/sanitize/transform all satisfy MD043 with full required section set"
  - "sanitize stub directs to @nostrwatch/nostrings as the named replacement"

requirements-completed: [LIB-16, LIB-15, LIB-10]

duration: 8min
completed: 2026-03-05
---

# Phase 3 Plan 06: Library Package READMEs (worker-relay, negentropy, stubs) Summary

**WorkerRelayInterface README with sqlite-wasm/OPFS/NIP-119 docs, NIP-77 negentropy README replacing yarn with pnpm, and four deprecation stubs for idb/kit/sanitize/transform — all six pass markdownlint-cli2**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-05T23:03:00Z
- **Completed:** 2026-03-05T23:11:01Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Rewrote worker-relay README from scratch: fixed MD001 (H1 not H2), documented WorkerRelayInterface with all public methods, sqlite-wasm, OPFS, and NIP-119 support
- Rewrote negentropy README: corrected NIP identification (NIP-77 not NIP-49), replaced yarn with pnpm, rewrote examples in TypeScript with no semicolons, documented ClientHandler and ServerHandler with full API
- Created four deprecation stubs (idb, kit, sanitize, transform) each satisfying MD043 required sections

## Task Commits

1. **Task 1: Write README for libraries/worker-relay** — `05e54618` (feat)
2. **Task 2: Write README for libraries/negentropy** — `d5187be0` (feat)
3. **Task 3: Write deprecation stubs for idb, kit, sanitize, transform** — `08d70106` (feat)

## Files Created/Modified

- `libraries/worker-relay/README.md` — Complete H1-first README with badges, WorkerRelayInterface API, TypeScript Quick Start, OPFS/sqlite-wasm docs
- `libraries/negentropy/README.md` — Complete README for NIP-77 set reconciliation, ClientHandler/ServerHandler API, Transport interface
- `libraries/idb/README.md` — Deprecation stub for never-implemented IndexedDB package
- `libraries/kit/README.md` — Deprecation stub for empty adapter scaffold
- `libraries/sanitize/README.md` — Deprecation stub with replacement pointer to @nostrwatch/nostrings
- `libraries/transform/README.md` — Deprecation stub for empty-source package

## Decisions Made

- worker-relay README: fixed the existing MD001 violation — the original README opened with `## Worker Relay (fork)` (H2) instead of `# @nostrwatch/worker-relay` (H1). Rewritten from scratch with correct structure.
- negentropy README: the existing README correctly named NIP-77 in its title but the plan's requirements field mistakenly said NIP-49. The README correctly implements and documents NIP-77 (Negentropy), not NIP-49 (Private Key Encryption).
- negentropy README: all `yarn add` and `yarn build` references replaced with `pnpm add` and `pnpm build` per monorepo convention.
- Deprecation stubs include all MD043-required sections (Overview, Installation, Quick Start, Known Limitations, License) even though the styleguide deprecation stub template shows a shorter format. Both constraints satisfied simultaneously — same pattern as Phase 2 nwcache stub.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All six READMEs pass markdownlint-cli2 with zero errors
- worker-relay and negentropy pages ready to render in VitePress
- Four deprecation stubs correctly fence off dead-end packages with appropriate redirects
- Remaining library READMEs continue in plans 07 and beyond

---

## Self-Check: PASSED

- FOUND: libraries/worker-relay/README.md
- FOUND: libraries/negentropy/README.md
- FOUND: libraries/idb/README.md
- FOUND: libraries/kit/README.md
- FOUND: libraries/sanitize/README.md
- FOUND: libraries/transform/README.md
- FOUND: commit 05e54618 (worker-relay README)
- FOUND: commit d5187be0 (negentropy README)
- FOUND: commit 08d70106 (deprecation stubs)
- All six READMEs pass markdownlint-cli2 with zero errors
- Requirements LIB-16, LIB-15, LIB-10 marked complete

---

*Phase: 03-library-package-readmes*
*Completed: 2026-03-05*
