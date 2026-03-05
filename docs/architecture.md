# Architecture Overview

The nostr-watch monorepo is a pnpm workspace containing 30+ packages organized into three layers.

## Directory Structure

```
nostr-watch/
├── apps/        # Product applications (services, dashboards, CLI tools)
├── libraries/   # Reusable shared packages
├── internal/    # Internal infrastructure shared across apps and libraries
└── docs/        # This documentation site
```

## Dependency Direction

Packages follow a strict layering convention to prevent circular dependencies:

```
internal  →  libraries  →  apps
```

- **internal** packages have no dependencies on libraries or apps
- **libraries** may depend on internal packages, not on apps
- **apps** consume both libraries and internal packages

## Key Packages

### Adapter Pattern (nocap, route66, publisher)

Several packages use an adapter pattern to abstract implementation details:

- **nocap** — Relay capability discovery framework. Adapters implement DNS, SSL, WebSocket, Geo, and NIP-11 info checks. The default adapter set lives in `libraries/nocap/adapters/default/`.
- **route66** — Relay aggregation and state management. Adapters handle persistence (SQLite, IndexedDB, in-memory).
- **publisher** — Nostr event publishing abstraction. Adapters wrap `nostr-tools` and other signing libraries.

### Core Libraries

| Package | Purpose |
|---------|---------|
| `nocap` | Relay capability discovery |
| `route66` | Relay state aggregation |
| `auditor` | Nostr event validation |
| `nip66` | NIP-66 relay check protocol |
| `nostrings` | Relay URL validation and normalization |
| `schemata` / `schemata-js-ajv` | JSON Schema definitions and AJV validation |

### Core Infrastructure

| Package | Purpose |
|---------|---------|
| `logger` | Structured logging (Pino) |
| `publisher` | Event publishing with adapter pattern |
| `utils` | Shared utilities (keys, arrays, env detection) |
| `controlflow` | Control flow primitives |
| `kinds` | Nostr event kind registry |

## Cross-Package Imports

All packages use scoped `@nostrwatch/*` imports resolved via pnpm workspaces:

```ts
import { getLogger } from '@nostrwatch/logger'
import { Nocap } from '@nostrwatch/nocap'
import { Route66 } from '@nostrwatch/route66'
```

## Deprecated Packages

Three packages are deprecated and maintained as stubs for migration guidance:

- `apps/nocapd` — Replaced by `apps/relaymon`
- `internal/nwcache` — Replaced by direct cache integrations
- `libraries/schemata` — Moved to `@nostrability/schemata`

See each package's README for migration instructions.

## Further Reading

- [All Packages](./packages/) — Full package list with descriptions and status
- [Getting Started](./getting-started.md) — Set up the dev environment
