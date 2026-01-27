# @nostrwatch/kuma

Uptime Kuma PUSH monitor for Nostr relays using `@nostrwatch/nocap` (default websocket adapter). Runs open/read/write checks and pushes status to Uptime Kuma.

- Default checks: `open,read`
- Optional: `write` (publishes a sample event)
- Pass through nocap options (e.g., `event_sample`, timeouts, log level)

## Install (workspace)

- Included in the monorepo (`libraries/uptime-kuma-monitor`).
- Build: `pnpm -w run build --filter @nostrwatch/kuma`

## CLI Usage

```
nostrwatch-kuma --relay wss://relay.example --push-url https://kuma.example/api/push/<key> \
  [--checks open,read[,write]] [--once] [--interval 60000] \
  [--log-level debug] [--write-sample-json '{"kind":1,...}']
```

Environment variables (alternatives):
- `RELAY_URL` — Nostr relay URL
- `KUMA_PUSH_URL` — Uptime Kuma push URL
- `CHECKS` — comma separated `open,read[,write]`
- `CHECK_WRITE=true|false` — include write check
- `KUMA_ONCE=true|false` — run once and exit
- `KUMA_INTERVAL_MS=60000` — loop interval in ms
- `NOCAP_LOG_LEVEL=info|debug|warn` — nocap logger level
- `NOCAP_WRITE_SAMPLE_JSON` — JSON for write check event

## Build Binary

You can create a native-like single executable via Bun or Deno:

- Bun (native binary):
  - `pnpm --filter @nostrwatch/kuma build:bin:bun`
  - Output: `libraries/uptime-kuma-monitor/dist/nostrwatch-kuma`

- Deno (native binary):
  - `pnpm --filter @nostrwatch/kuma build:bin:deno`
  - Output: `libraries/uptime-kuma-monitor/dist/nostrwatch-kuma`

Prereqs: Bun ≥ 1.0.21 or Deno ≥ 1.39 with Node compat. The Deno build uses `--compat --node-modules-dir` to resolve workspace dependencies.

## Library API

- `runChecks(options)` → executes nocap checks, returns summary
- `runOnce(options)` → checks + push
- `runForever(options)` → checks + push on interval, returns a stop function

`KumaMonitorOptions`:
- `relayUrl: string`
- `pushUrl: string`
- `checks?: ('open'|'read'|'write')[]` (default: `['open','read']`)
- `requiredChecks?: ('open'|'read'|'write')[]` (default: same as `checks`)
- `pingStrategy?: 'sum'|'max'` (default: `sum`)
- `nocap?: { ... }` (partial `@nostrwatch/nocap` config, e.g. `event_sample`)
- `headers?: boolean` (default: `true`)
- `once?: boolean`, `intervalMs?: number`

## Notes

- Status is `up` only if all required checks pass (by default `open` and `read`).
- When `write` is enabled, set `nocap.event_sample` or `--write-sample-json` to customize the event sent.
- `ping` uses the sum of durations for the selected checks by default.

