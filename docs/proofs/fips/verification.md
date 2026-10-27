# FIPS verification

Verified on 2026-10-27 against integration base `58e0b068`.

## Results

| Surface | Verification | Result |
| --- | --- | --- |
| Shared utilities | `pnpm -C internal/utils exec vitest run` | 26 passed |
| NOCAP and adapters | `pnpm -C libraries/nocap exec vitest run src` | 35 passed |
| Monitor announcement | `pnpm -C internal/announce exec vitest run` | 3 passed |
| Relaymon | `deno task test:unit` in `apps/relaymon` | 379 passed |
| Relaymon integration | Baseline, delta-events, and worker integration files under the normal Deno test flags | 25 passed |
| Chronicle | `deno task test` in `libraries/relay-chronicle` | 38 passed |
| rstate | `pnpm -C apps/rstate exec vitest run` | 301 passed, 2 pre-existing skipped |
| rstate types/build | `pnpm -C apps/rstate type-check` and `build` | Passed |
| GUI units | `NODE_OPTIONS=--localstorage-file=/tmp/nostr-watch-fips-test-storage pnpm -C apps/gui test` | 327 passed |
| GUI browser proof | `pnpm -C apps/gui exec playwright test tests/fips.spec.ts` | 4 passed: Chromium and Firefox |
| GUI production build | `pnpm -C apps/gui build` | Passed |
| GUI formatting gate | `pnpm -C apps/gui lint` | Passed |
| Package dependencies | Serial build of `@nostrwatch/gui^...`, plus announce/publisher dependencies | Passed |
| WebSocket adapter | `pnpm -F @nostrwatch/nocap-websocket-adapter-default build` | Passed |
| Package documentation | `pnpm exec markdownlint-cli2` | Passed |
| Live FIPS fixture | Two nodes running FIPS 0.5.3, revision `f4a5b4a8e6`, Deno 2.9.5 | Passed |

Node 26 requires an explicit local-storage file for this GUI unit suite. Without
that flag, pre-existing tests fail with `No localStorage found`. The flag changes
the test runtime, not application behavior.

The base Relaymon unit suite reproduced 19 failures because its `p-queue@latest`
import now resolves to an API without `.on()`. Pinning its existing compatible
9.1.2 version restores the queue contract; all 379 unit tests then pass.

## Existing GUI type-check debt

`pnpm -C apps/gui check` still fails against the repository's stored baseline.
The integration base also fails. Comparing machine-readable Svelte diagnostics
between a detached base worktree and this change found **no added or removed
diagnostic locations**. The baseline wrapper reports 151 additional diagnostics
here and 152 on the base; one existing union-type diagnostic changes its import
ordering/path text. No baseline was widened and no existing diagnostic was hidden.

## Live monitor and isolation proof

[monitor.json](monitor.json) records successful open, read, write and NIP-11
checks over the actual encrypted mesh. Both classifiers identify `fips` and
Relaymon's result validator accepts the result. The proof contains a signed kind
30166 event with `['n', 'fips']`; its saved signature was independently verified.
Unit tests additionally prove that public DoH receives zero requests for overlay
names, and that DB seeding applies FIPS and clearnet allowlists correctly.

The monitor's wildcard-bound sentinel port was unreachable from the other mesh
node. Its explicit firewall DROP rule counted two packets. Neither node used
host networking or published a port; public/LAN discovery was disabled. Only
ephemeral fixture configuration was mounted. Both containers and their internal
Docker network were removed after the run. Private identities were not retained.

## GUI proof

The browser fixture injects actual kind 10166/30166 models and cached monitor
records. Real aggregation workers, formatters, filters, routing and check-detail
components run. Public transport sockets are isolated inside the fixture,
including inline workers, so live relay updates cannot overwrite the evidence.

- [Chromium relay list](chromium-fips-relays.png) and [Firefox relay list](firefox-fips-relays.png)
- [Chromium FIPS filter](chromium-fips-filter.png) and [Firefox FIPS filter](firefox-fips-filter.png)
- [Chromium check details](chromium-fips-detail.png) and [Firefox check details](firefox-fips-detail.png)
- [Chromium monitor networks](chromium-fips-monitor.png) and [Firefox monitor networks](firefox-fips-monitor.png)

Browser assertions verify that FIPS and clearnet initially coexist, selecting
FIPS removes the clearnet row, check details retain the FIPS network, the SVG
loads, and the monitor advertises FIPS alongside Tor and I2P.
