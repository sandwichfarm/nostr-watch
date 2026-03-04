# @nostrwatch/kuma

Uptime Kuma PUSH monitor for Nostr relays.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/kuma?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/kuma)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-cli-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/kuma` integrates Nostr relay (a WebSocket server that stores and forwards events) health checks with [Uptime Kuma](https://github.com/louislam/uptime-kuma) push monitors. It runs `open`, `read`, and optional `write` checks against a relay using the `@nostrwatch/nocap` WebSocket adapter, then pushes the result — status (`up` or `down`) and latency — to an Uptime Kuma push URL. Available as both a CLI tool and a TypeScript library.

## Prerequisites

Node.js >=18 and pnpm >=9.

An Uptime Kuma instance with a configured push-type monitor. The push URL looks like `https://kuma.example.com/api/push/<key>`.

## Installation

```sh
pnpm add @nostrwatch/kuma
```

Or with npm:

```sh
npm install @nostrwatch/kuma
```

## Quick Start

Run a one-shot check via CLI:

```sh
npx nostrwatch-kuma \
  --relay wss://relay.damus.io \
  --push-url https://kuma.example.com/api/push/abc123 \
  --once
```

Or use the library API:

```ts
import {runOnce} from '@nostrwatch/kuma'

await runOnce({
  relayUrl: 'wss://relay.damus.io',
  pushUrl: 'https://kuma.example.com/api/push/abc123',
  checks: ['open', 'read']
})
// Checks the relay and pushes status=up/down + ping to Uptime Kuma
```

## API

### Library API

#### `runChecks(options)`

```ts
async function runChecks(options: KumaMonitorOptions): Promise<CheckResultSummary>
```

Runs nocap relay checks and returns a summary without pushing to Uptime Kuma. Use this to inspect results before deciding whether to push.

#### `runOnce(options)`

```ts
async function runOnce(options: KumaMonitorOptions): Promise<void>
```

Runs checks and pushes the result to Uptime Kuma once. Resolves when the push completes. Rejects if the push request fails.

#### `runForever(options)`

```ts
async function runForever(options: KumaMonitorOptions): Promise<() => void>
```

Runs checks and pushes on a repeating interval. Returns a `stop` function that halts the loop when called. The first check runs immediately.

#### `buildKumaPayload(summary, strategy?)`

```ts
function buildKumaPayload(summary: CheckResultSummary, strategy?: PingStrategy): KumaPushPayload
```

Converts a `CheckResultSummary` to a `KumaPushPayload`. Exposed for custom push implementations.

### `KumaMonitorOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `relayUrl` | `string` | — | WebSocket URL of the relay to check |
| `pushUrl` | `string` | — | Full Uptime Kuma push URL |
| `checks` | `CheckKey[]` | `['open','read']` | Which checks to run: `'open'`, `'read'`, `'write'` |
| `requiredChecks` | `CheckKey[]` | same as `checks` | Checks that must pass for status to be `up` |
| `pingStrategy` | `'sum' \| 'max'` | `'sum'` | How to aggregate check durations into ping value |
| `intervalMs` | `number` | `60000` | Loop interval for `runForever` in milliseconds |
| `nocap` | `Partial<NocapConfig>` | — | Pass-through config for `@nostrwatch/nocap` |
| `headers` | `boolean` | `true` | Include HTTP headers in nocap result |

### `CheckResultSummary`

```ts
interface CheckResultSummary {
  ok: boolean
  failing: CheckKey[]
  result: any
  durations: Partial<Record<CheckKey, number>>
}
```

`ok` is `true` only when all `requiredChecks` pass. `durations` contains per-check millisecond timings.

### CLI Reference

```sh
nostrwatch-kuma [options]

Options:
  --relay <url>             Relay WebSocket URL (or RELAY_URL env var)
  --push-url <url>          Uptime Kuma push URL (or KUMA_PUSH_URL env var)
  --checks <list>           Comma-separated: open,read[,write] (default: open,read)
  --once                    Run once and exit (or KUMA_ONCE=true)
  --interval <ms>           Loop interval in milliseconds (default: 60000)
  --log-level <level>       Nocap log level: debug, info, warn (or NOCAP_LOG_LEVEL)
  --write-sample-json <json> JSON event for write check (or NOCAP_WRITE_SAMPLE_JSON)
```

Environment variables: `RELAY_URL`, `KUMA_PUSH_URL`, `CHECKS`, `KUMA_ONCE`, `KUMA_INTERVAL_MS`, `NOCAP_LOG_LEVEL`, `NOCAP_WRITE_SAMPLE_JSON`.

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../nocap/README.md) — relay check engine that `kuma` uses internally for open/read/write checks
- [`@nostrwatch/nocap-websocket-adapter-default`](../websocket/README.md) — default WebSocket adapter used by `nocap`

## License

[MIT](../../LICENSE)
