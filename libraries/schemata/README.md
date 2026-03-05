# @nostrwatch/schemata

JSON Schema definitions for Nostr protocol data structures.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/schemata?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/schemata)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/schemata` provides JSON Schema definitions for Nostr protocol data structures including events (the signed JSON objects that form the basis of Nostr communication), NIP-11 relay info documents, and protocol messages. A schema (a JSON Schema document) describes the shape and constraints of a data structure so it can be validated programmatically.

> **Migration notice:** This package is migrating to [`@nostrability/schemata`](https://www.npmjs.com/package/@nostrability/schemata) under a separate npm organization. New projects should use `@nostrability/schemata` directly. `@nostrwatch/schemata-js-ajv` already depends on `@nostrability/schemata` rather than this package.

The schemas are defined in YAML format under `nips/nip-XX/` and compiled to JSON at build time. Schemas exist for NIPs 01, 02, 11, 18, 22, 40, and 65.

## Installation

```sh
pnpm add @nostrwatch/schemata
```

Or with npm:

```sh
npm install @nostrwatch/schemata
```

For new projects, prefer the successor package:

```sh
pnpm add @nostrability/schemata
```

## Quick Start

The compiled schemas are available as JSON after running the build. Use them with any JSON Schema validator:

```ts
import Ajv from 'ajv'
import schema from '@nostrwatch/schemata/dist/schema.json'

const ajv = new Ajv()
const validate = ajv.compile(schema)

const event = {
  kind: 1,
  content: 'Hello from Nostr',
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  pubkey: '<32-byte-hex-pubkey>',
  id: '<32-byte-hex-id>',
  sig: '<64-byte-hex-sig>'
}

const valid = validate(event)
console.log(valid) // true or false
```

For a ready-to-use validation wrapper with AJV, see [`@nostrwatch/schemata-js-ajv`](../schemata-js-ajv/README.md).

## API

The compiled output at `dist/schema.json` and `dist/schema.content.json` are the primary artifacts. The schema source is organized by NIP:

| NIP | Schema file | Covers |
|-----|-------------|--------|
| NIP-01 | `nips/nip-01/` | Base event structure, kinds 0 and 1, protocol messages, unsigned notes |
| NIP-11 | `nips/nip-11/` | Relay information document (`RelayInformationDocument`) |
| NIP-02 | `nips/nip-02/` | Contact list events |
| NIP-22 | `nips/nip-22/` | Comment events |
| NIP-40 | `nips/nip-40/` | Expiration events |
| NIP-65 | `nips/nip-65/` | Relay list metadata |
| NIP-18 | `nips/nip-18/` | Reposts |

The build script compiles YAML sources to `dist/schema.json` (event schemas) and `dist/schema.content.json` (content schemas). The `quicktype` tool generates typed outputs for Rust, Python, Swift, Kotlin, Java, Go, TypeScript, and JavaScript from these JSON schemas.

## Known Limitations

- **In-progress migration:** This package is moving to `@nostrability/schemata`. The migration is underway; `@nostrwatch/schemata-js-ajv` already uses the new package. This package will remain available until all consumers migrate.
- **Build process required:** Schemas are not available in raw form from the npm package — the YAML sources must be compiled via `pnpm build`. The dist files are included in the published package.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/schemata-js-ajv`](../schemata-js-ajv/README.md) — AJV-powered validation functions built on `@nostrability/schemata` (the successor to this package)
- [`@nostrability/schemata`](https://www.npmjs.com/package/@nostrability/schemata) — the migration target for this package; prefer this for new projects

## License

[MIT](../../LICENSE)
