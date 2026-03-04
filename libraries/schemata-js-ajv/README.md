# @nostrwatch/schemata-js-ajv

AJV-powered validation for Nostr events, NIP-11 info documents, and protocol messages.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/schemata-js-ajv?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/schemata-js-ajv)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/schemata-js-ajv` wraps the `@nostrability/schemata` JSON Schema definitions with [AJV](https://ajv.js.org/) validation, exposing three ready-to-use validation functions for common Nostr data structures. A NIP-11 info document is the metadata object a relay (a WebSocket server that stores and forwards Nostr events) serves at its HTTP endpoint. This package validates that document as well as individual Nostr events and protocol messages.

Validation results include both hard errors (schema violations) and soft warnings (additional properties not defined in the schema).

## Installation

```sh
pnpm add @nostrwatch/schemata-js-ajv
```

Or with npm:

```sh
npm install @nostrwatch/schemata-js-ajv
```

AJV is a peer dependency — install it alongside:

```sh
pnpm add ajv
```

## Quick Start

```ts
import {validateNip11} from '@nostrwatch/schemata-js-ajv'

const nip11 = {
  name: 'Damus Relay',
  description: 'A Nostr relay',
  pubkey: 'abc123...',
  contact: 'admin@relay.damus.io',
  supported_nips: [1, 11, 42],
  software: 'strfry',
  version: '1.0.0'
}

const result = validateNip11(nip11)
console.log(result)
// { valid: true, errors: [], warnings: [] }
```

## API

### `validateNip11(nip11)`

```ts
validateNip11(nip11: any): SchemaValidatorResult | undefined
```

Validates a NIP-11 relay information document against the `@nostrability/schemata` `nip11Schema`. Returns a `SchemaValidatorResult` with validation errors and warnings about additional properties.

| Parameter | Type | Description |
|-----------|------|-------------|
| `nip11` | `any` | A NIP-11 relay info document object |

### `validateNote(note)`

```ts
validateNote(note: NostrEvent): SchemaValidatorResult | undefined
```

Validates a Nostr event (note) against the schema for its `kind`. The schema is looked up from `@nostrability/schemata` using the key `kind${kind}Schema`. Returns a result with a warning if no schema exists for the given kind.

| Parameter | Type | Description |
|-----------|------|-------------|
| `note` | `NostrEvent` | A Nostr event object (from `nostr-tools`) |

### `validateMessage(message, subject, slug)`

```ts
validateMessage(message: any, subject: 'relay' | 'client', slug: string): SchemaValidatorResult | undefined
```

Validates a Nostr protocol message against the schema for the given subject and message type. The schema key is constructed as `${subject}${capitalize(slug)}Schema` (e.g., `relayNoticeSchema` for `subject='relay'`, `slug='notice'`).

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `any` | The protocol message to validate |
| `subject` | `'relay' \| 'client'` | Message origin: from the relay or from the client |
| `slug` | `string` | Message type name (e.g., `'notice'`, `'event'`, `'ok'`) |

### `SchemaValidatorResult`

```ts
type SchemaValidatorResult = {
  valid: boolean
  warnings: ErrorObject[]
  errors: ErrorObject[]
}
```

- `valid` — `true` if the data passes all schema constraints
- `errors` — AJV validation errors (schema violations); empty when `valid` is `true`
- `warnings` — additional property warnings; populated even when `valid` is `true`

### `validate(schema, data)`

```ts
validate(schema: any, data: any): SchemaValidatorResult
```

Low-level validator. Compiles an arbitrary JSON Schema with AJV and validates `data` against it. Use `validateNip11`, `validateNote`, or `validateMessage` for common cases.

## Known Limitations

- **Partial kind coverage:** Only event kinds with a corresponding schema in `@nostrability/schemata` can be validated. `validateNote` returns a warning (not an error) when no schema exists for the given kind.
- **No multi-stage validation:** The `content` field of events that contain stringified JSON (e.g., kind 0 metadata) is not recursively validated.
- **Alpha accuracy:** False positives and false negatives are possible. The schemas are in early development.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/schemata`](../schemata/README.md) — predecessor JSON Schema package migrating to `@nostrability/schemata`
- [`@nostrability/schemata`](https://www.npmjs.com/package/@nostrability/schemata) — the schema source this package validates against
- [`@nostrwatch/nocap`](../nocap/README.md) — relay capability checker; uses NIP-11 validation internally

## License

[MIT](../../LICENSE)
