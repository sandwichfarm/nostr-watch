---
phase: 03-library-package-readmes
plan: 07
subsystem: documentation
tags: [nostrawl, relay-charts, relay-chronicle, uptime-kuma-monitor, nostr, nip-66, charting, monitoring, markdownlint]

requires:
  - phase: 01-foundation
    provides: styleguide rules, markdownlint-cli2 config, MD043 section order enforcement
  - phase: 03-library-package-readmes
    provides: phase context, code research notes

provides:
  - "nostrawl README: queue-based Nostr crawler with PQueue/BullMQ adapters documented"
  - "uptime-kuma-monitor README: @nostrwatch/kuma CLI and library API documented"
  - "relay-charts README: ChartAdapter interface, three adapter backends, utility functions documented"
  - "relay-chronicle README: NIP-66 kind 1066 state composition, uptime/history API documented"

affects:
  - phase 04 (app READMEs referencing these libraries)
  - agent skills documentation for relay-chronicle and relay-charts

tech-stack:
  added: []
  patterns:
    - "nostrawl uses non-scoped package name (nostrawl not @nostrwatch/nostrawl) — badge URL and install command use bare name"
    - "relay-charts adapter sub-path imports (@nostrwatch/relay-charts/chartjs) documented for tree-shaking"
    - "relay-chronicle EventStorage interface pattern: callers provide backend-agnostic query implementation"

key-files:
  created: []
  modified:
    - libraries/nostrawl/README.md
    - libraries/uptime-kuma-monitor/README.md
    - libraries/relay-charts/README.md
    - libraries/relay-chronicle/README.md

key-decisions:
  - "nostrawl package name is the bare 'nostrawl' (not scoped) — npm badge and install command use 'nostrawl' directly"
  - "relay-charts adapter sub-paths documented as primary import pattern for tree-shaking; main entry noted as bundler-dependent"
  - "relay-chronicle EventStorage interface documented with nostr-tools SimplePool as the Quick Start example"
  - "uptime-kuma-monitor runtime badge uses 'cli' since it is both CLI and library"

patterns-established:
  - "Existing content-rich READMEs (419 and 792 lines): extract technical accuracy, discard emoji formatting, restructure to styleguide"

requirements-completed:
  - LIB-08
  - LIB-06
  - LIB-07
  - LIB-17

duration: 12min
completed: 2026-03-04
---

# Phase 03 Plan 07: Application-Layer Library READMEs Summary

**Four application-layer library READMEs rewritten to styleguide: nostrawl queue crawler, relay-charts ChartAdapter system, relay-chronicle NIP-66 state composition, and @nostrwatch/kuma Uptime Kuma monitor**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-04T23:00:00Z
- **Completed:** 2026-03-04T23:11:59Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `nostrawl` README rewrites the 95-line original: documents `nostrawl()` factory, `TrawlerOptions` and `PQueueAdapterOptions` tables, EventEmitter events, and `Progress` type — confirms non-scoped package name from `package.json`
- `@nostrwatch/kuma` README rewrites the 67-line original: covers both CLI (`nostrwatch-kuma` binary) and library API (`runChecks`, `runOnce`, `runForever`), `KumaMonitorOptions` table, CLI flag reference, env var table
- `@nostrwatch/relay-charts` README restructures the 419-line original without emoji: documents `ChartAdapter` interface, three adapter factories with sub-path imports for tree-shaking, all three chart types, `ChartOptions`, utility functions, custom adapter pattern
- `@nostrwatch/relay-chronicle` README restructures the 792-line original without emoji: covers `composeState`, `calculateUptime`, `liveness`, `uptimeHistory`, `changeHistory`, full time series API table, `EventStorage` interface with implementation example, `RelayState` and `UptimeStats` types

## Task Commits

1. **Task 1: nostrawl and uptime-kuma-monitor READMEs** - `ef344f43` (feat)
2. **Task 2: relay-charts README** - `bebaabbf` (feat)
3. **Task 3: relay-chronicle README** - `a6c697dd` (feat)

## Files Created/Modified

- `libraries/nostrawl/README.md` — queue-based Nostr crawler; PQueue/BullMQ adapter docs; TrawlerOptions table
- `libraries/uptime-kuma-monitor/README.md` — @nostrwatch/kuma CLI and library API; KumaMonitorOptions; runOnce/runForever
- `libraries/relay-charts/README.md` — ChartAdapter interface; Chart.js/ECharts/Recharts adapters; utility functions; custom adapter pattern
- `libraries/relay-chronicle/README.md` — NIP-66 kind 1066 state composition; EventStorage interface; uptime, history, and time series API

## Decisions Made

- `nostrawl` uses the bare package name (not `@nostrwatch/nostrawl`) — confirmed from `package.json`; npm badge URL and install command use `nostrawl` directly
- relay-charts adapter sub-path imports (`@nostrwatch/relay-charts/chartjs`) are the primary pattern and tree-shaking recommendation; the main entry is noted as adapter-dependent
- relay-chronicle Quick Start uses `nostr-tools/pool SimplePool` as the `EventStorage` implementation since it is the most natural real-world usage and matches the existing README's example
- `@nostrwatch/kuma` runtime badge uses `cli` because the package is primarily a CLI tool, with library API as secondary use

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four READMEs pass markdownlint-cli2 with zero errors
- relay-charts and relay-chronicle are cross-linked in Related Packages as required
- All required sections present in correct MD043 order

---

*Phase: 03-library-package-readmes*
*Completed: 2026-03-04*
