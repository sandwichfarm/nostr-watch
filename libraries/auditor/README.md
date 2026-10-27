# @nostrwatch/auditor

Nostr relay auditor — runs NIP conformance tests against any relay.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/auditor?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/auditor)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/auditor` tests Nostr relays (WebSocket servers that store and forward signed events) for protocol conformance. Given a relay URL, it runs a battery of NIP (Nostr Implementation Possibility — numbered protocol specifications) test suites and returns a structured result indicating which NIPs the relay supports correctly. Use it to benchmark new relays, validate relay upgrades, or power relay-health dashboards.

Auditor is a library — it runs tests but does not store results. Pair it with `@nostrwatch/route66` for persistent relay monitoring or `@nostrwatch/nocap` for low-level relay connection checks.

## Installation

```sh
pnpm add @nostrwatch/auditor
```

Or with npm:

```sh
npm install @nostrwatch/auditor
```

## Quick Start

```ts
import {Auditor} from '@nostrwatch/auditor'

const auditor = new Auditor({nips: new Set(['Nip01', 'Nip11'])})
await auditor.detectSupportedNips('wss://relay.damus.io')
const result = await auditor.test('wss://relay.damus.io')
console.log(result)
// { relay: 'wss://relay.damus.io', pass: true, passrate: 0.875, suites: {...} }
```

## API

### `Auditor`

```ts
class Auditor {
  constructor(conf?: IAuditorConf)
  detectSupportedNips(relay: string): Promise<void>
  test(relay: string): Promise<IAuditorResult>
  run(relay: string): Promise<IAuditorResult>
  addSuite(suite: string, options?: any): void
  removeSuite(suite: string): void
  abort(): void
  get result(): IAuditorResult
  get suites(): Set<string>
}
```

**`constructor(conf?)`**

Creates a new `Auditor` instance. If no configuration is passed, the `Nip01` suite runs by default.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nips` | `Set<string>` | `new Set(['Nip01'])` | Suite names to run (e.g., `'Nip01'`, `'Nip11'`) |
| `options` | `Record<string, any>` | `{}` | Per-suite options keyed by suite name |

**`detectSupportedNips(relay)`**

Fetches the relay's NIP-11 info document and adds matching NIP suites to the configured suite set. Call this before `test()` to automatically test only the NIPs the relay claims to support.

**`test(relay)`**

Runs all configured NIP suites against the relay URL and returns an `IAuditorResult`. Equivalent to `run()`.

**`run(relay)`**

Alias for `test()`.

**`addSuite(suite, options?)`**

Adds a NIP suite by name. Suite names use the format `'NipXX'` (e.g., `'Nip42'`). Only suites with known test manifests are added; unknown names are silently ignored.

**`removeSuite(suite)`**

Removes a NIP suite from the configured set.

**`abort()`**

Emits an abort signal to all active suites. Use when you need to cancel an in-progress test run.

### `IAuditorConf`

```ts
interface IAuditorConf {
  nips: Set<string>
  options: Record<string, any>
}
```

### `IAuditorResult`

```ts
interface IAuditorResult {
  relay: string
  pass: boolean
  passrate: number
  reason: string
  suites: Record<string, ISuiteResult>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `relay` | `string` | The relay URL that was tested |
| `pass` | `boolean` | `true` if all non-skipped suites passed |
| `passrate` | `number` | Fraction of non-skipped suites that passed (0–1) |
| `suites` | `Record<string, ISuiteResult>` | Per-suite results keyed by suite name |

### Supported NIP Suites

| Suite name | NIP | Description |
|------------|-----|-------------|
| `Nip01` | NIP-01 | Basic relay protocol (filters, subscriptions, event publishing) |
| `Nip02` | NIP-02 | Contact list events |
| `Nip11` | NIP-11 | Relay information document |
| `Nip22` | NIP-22 | Comment events |
| `Nip42` | NIP-42 | Authentication of clients to relays |
| `Nip50` | NIP-50 | Search capability |
| `Nip65` | NIP-65 | Relay list metadata |
| `Nip77` | NIP-77 | Negentropy syncing |

### SuiteTest pattern

Individual NIP tests extend `SuiteTest` and implement a `test()` method that uses a `behavior` assertion helper:

```ts
import {SuiteTest, type ISuiteTest} from '@nostrwatch/auditor'

export class FilterLimit extends SuiteTest implements ISuiteTest {
  readonly slug: string = 'FilterLimit'
  limit: number = 1

  get filters() {
    return [{limit: this.limit}]
  }

  test({behavior}) {
    behavior.toEqual(this.totalEvents, this.limit, 'returned correct number of events')
    behavior.toBeOk(this.totalEvents > 0, 'returned at least one event')
  }
}
```

### NIP-01 conversation checks

The NIP-01 suite also includes independent, multi-step checks:

| Checks | Behavior exercised |
|--------|--------------------|
| `FilterIds`, `FilterEmptyLists` | Exact IDs, list alternatives, and empty lists matching nothing |
| `FilterSemantics` | AND within a filter, OR across filters, uppercase tags, first tag value indexing |
| `FilterInclusiveRange` | Inclusive `since` and `until`, including equal bounds |
| `FilterUnknownKeys` | Unknown fields preserve the meaning of recognized filter fields |
| `FilterLimitOrder`, `LimitLive` | Newest-first historical limits, lexical ID ties, zero historical limit, continuing live delivery |
| `SubscriptionLifecycle`, `SubscriptionIsolation` | REQ replacement, CLOSE, and subscription IDs scoped to each connection |
| `EventValidation`, `EventPersistence` | Invalid signature/ID rejection, correlated OK messages, regular event storage, duplicate publication |
| `ReplaceableEvents`, `AddressableEvents`, `EphemeralEvents` | Replacement and timestamp ties, independent `d` addresses, live-only ephemeral events |
| `ChildPath` | Differential queries at a random child of the configured relay path |

Checks use fresh signed events and isolated authors/IDs to establish positive
prerequisites before testing exclusions or live behavior. They are classified
`low-write`/`normal`, except the read-only `ChildPath` check. Regular test events
may remain on the relay; events use an `auditor-nip01-` content marker and test
keys. A write-policy rejection or unavailable baseline is recorded as skipped,
not as successful conformance. An incomplete conversation has `pass: false`,
including when an earlier assertion succeeded. Timeouts, malformed responses,
and premature connection closure are failures.

Suite aggregation excludes explicitly skipped checks from its pass decision and
sets `incomplete: true` whenever any check was skipped. A suite with no evaluated
checks has `skipped: true` and `pass: false`. Inspect each test's skipped assertions
and the suite's `incomplete` flag before treating an audit as complete coverage.

[NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) includes
mandatory requirements, recommendations, and event-kind conventions. These
checks report the observed behavior; their results should be interpreted with
the corresponding requirement strength. In particular, the current spec allows
`CLOSED` for unsupported filter elements. `FilterUnknownKeys` reports an explicit
rejection as unsupported interoperability, while silently changing the results
fails the check.

`ChildPath` compares a stable parent result with a randomly generated child path,
then confirms matching results with an exact-ID query. A child returning different
events or a different subscription policy demonstrates changed behavior. Identical
nonempty results produce a **possible alias** diagnostic with `pass: false` and a
skipped assertion: replicated independent relays and differences outside these
queries cannot be ruled out. Empty responses, changing parent data, opaque
connection failures, and silent children are also inconclusive. This check does
not claim that opening a child connection alone violates NIP-01. Observations are
retained in `result.suites.Nip01.data.ChildPath` alongside other tests' data.

### Extending multi-step tests

Use `ConversationTest` for exchanges spanning several requests, live events, or
independent connections. Implement `execute()` and obtain owned connections with
`await this.openSession(url?)`. `MessageSession.send()` sends JSON arrays;
`waitFor(predicate, {after, timeoutMs})` searches ordered history and future
messages, so immediate replies are not lost. Use a history offset to distinguish
reused subscription IDs. The runner bounds the entire conversation and releases
all its sessions on success, failure, timeout, or abort. Connection forks preserve
the configured transport, proxy agent, and protocols.

Transport handling lives in `MessageSession`; NIP-01 request/publish correlation
and event validation live in `Nip01/utils/RelayConversation.ts`; each behavior
remains a separate registered test module. Sample-dependent `SuiteTest` checks
still use ingestors. Missing samples do not suppress independent conversation
checks.

Run deterministic tests without a public relay:

```sh
pnpm --filter @nostrwatch/websocket build
pnpm --filter @nostrwatch/auditor test
pnpm --filter @nostrwatch/auditor build
pnpm --filter @nostrwatch/auditor test:built
```

The local WebSocket fixture has separate behavior faults for filters, limits,
subscriptions, event storage, and signatures. Tests exercise both conforming
behavior and each faulty variant, plus the public `Auditor` manifest path and
transport cleanup. The schema-validation fixture is self-contained and requires
no sibling package's generated artifacts.

## Known Limitations

- **Sample-dependent checks:** Legacy filter checks depend on available relay history. The independent `FilterInclusiveRange` and other conversation checks use their own accepted events, subject to the relay's write policy.
- **Child-path identity:** Finite read probes cannot establish that two endpoints are the same relay. Possible aliases remain inconclusive and include the observed evidence.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../nocap/README.md) — low-level relay connection primitives; auditor builds on nocap adapters internally
- [`@nostrwatch/nip66`](../nip66/README.md) — NIP-66 event types; audit results can be published as NIP-66 relay status events
- [`@nostrwatch/route66`](../route66/README.md) — persistent relay monitoring that uses auditor for health checks

## License

[MIT](../../LICENSE)
