---
phase: 04-app-package-readmes
plan: 01
subsystem: documentation
tags: [sveltekit, fastify, contextvm, nip-66, markdown, readme]

requires:
  - phase: 01-foundation
    provides: styleguide MD043 rules, markdownlint-cli2 config
  - phase: 03-library-package-readmes
    provides: established README patterns for Known Limitations, badge format, section order

provides:
  - apps/gui/README.md — SvelteKit relay dashboard README with MD043 compliance
  - apps/rstate/README.md — ContextVM relay state machine README with REST API docs

affects:
  - 04-02-PLAN (trawler/relaymon READMEs — same patterns apply)
  - 04-03-PLAN (purist/nocapd/docker-stacks/umon READMEs)

tech-stack:
  added: []
  patterns:
    - "App README must include env var table in Prerequisites when env vars exist"
    - "REST API apps get a summarized endpoint group table (not full endpoint list) in ## API section"
    - "No env vars for client-only SvelteKit apps — Prerequisites documents Node.js/pnpm only"
    - "rstate package uses @nostr-watch/rstate scope (hyphen) not @nostrwatch/rstate"

key-files:
  created: []
  modified:
    - apps/gui/README.md
    - apps/rstate/README.md

key-decisions:
  - "gui README documents no env vars — client-only app with runtime config via Preferences UI, not process env"
  - "rstate README summarizes API into 14-row endpoint table instead of copying full 50+ endpoint list"
  - "rstate badge URL must encode the slash as %2F in the npm shield URL for hyphenated scope @nostr-watch/rstate"
  - "Both READMEs include all 3 respective CONCERNS.md Known Limitations entries verbatim from source"

requirements-completed: [APP-01, APP-02]

duration: 2min
completed: 2026-03-05
---

# Phase 04 Plan 01: GUI and RState App READMEs Summary

**SvelteKit relay dashboard (gui) and ContextVM relay state machine (rstate) READMEs written to MD043 styleguide with CONCERNS.md Known Limitations and full prerequisites**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-05T09:18:37Z
- **Completed:** 2026-03-05T09:20:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `apps/gui/README.md` fully rewritten to MD043 with SvelteKit 2.5 details, no-env-var Prerequisites, pnpm --filter Quick Start, and all 3 CONCERNS.md Known Limitations (table config separation, worker fallback, store race conditions)
- `apps/rstate/README.md` fully rewritten to MD043 with env var table, summarized REST API endpoint table, YAML configuration section, and all 3 CONCERNS.md Known Limitations (SDK stubs, dev-tools @ts-nocheck, console.log in scoring)
- Both READMEs pass `pnpm lint:docs` with zero errors

## Task Commits

1. **Task 1: Write apps/gui README.md** - `28026108` (feat)
2. **Task 2: Write apps/rstate README.md** - `fa61d1d8` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `apps/gui/README.md` — SvelteKit 2.5 relay dashboard: Overview, Prerequisites (Node.js >=22, pnpm >=8, no env vars), Quick Start (pnpm --filter commands), Known Limitations (3 CONCERNS.md entries), Related Packages (route66/nocap/worker-relay/relay-charts/relay-chronicle/utils)
- `apps/rstate/README.md` — ContextVM relay state machine: env var table (6 vars), REST API summary table (14 endpoints), YAML configuration section, Known Limitations (3 CONCERNS.md entries), correct hyphenated package name @nostr-watch/rstate

## Decisions Made

- **gui has no env vars:** Client-only SvelteKit app with SSR disabled — all runtime config flows through the in-app Preferences page, not environment variables. Prerequisites documents Node.js/pnpm only.
- **rstate API as summary table:** Plan specified to document key endpoint groups rather than copy the full 50+ endpoint list. Summarized into 14-row table covering health, relays, monitors, policy, and subscriptions groups.
- **rstate badge URL encoding:** The hyphenated scope `@nostr-watch/rstate` requires encoding the slash as `%2F` in the npm shields.io URL to produce a valid badge.
- **rstate package name distinction:** `@nostr-watch/rstate` uses a hyphenated scope (unlike all other `@nostrwatch/` packages) — confirmed from package.json and documented accurately.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- gui and rstate READMEs complete and lint-clean
- Same MD043 + CONCERNS.md Known Limitations pattern applies directly to 04-02 (trawler/relaymon) and 04-03 (purist/nocapd/docker-stacks/umon)
- Deno apps (trawler/relaymon) will need `deno task` instead of `pnpm` in Quick Start — already noted in research

---
*Phase: 04-app-package-readmes*
*Completed: 2026-03-05*
