# @nostrwatch/logger

Structured logging wrapper used throughout the nostr-watch monorepo.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](../../LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/logger` wraps Winston to provide structured, level-gated logging for both Node.js and browser environments. On Node.js it uses Winston with colorized, timestamped output; in the browser it falls back to the native `console`. Every consuming package instantiates the `Logger` class with a namespace string, giving each log line a `[label]` prefix that identifies which module produced it. The package supports five log levels: `fatal`, `error`, `warn`, `info`, and `debug`.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/logger --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import Logger from '@nostrwatch/logger'

const log = new Logger('my-module', 'INFO')

log.info('relay connected')
// 2026-03-04T20:00:00.000Z [my-module] info: relay connected

log.debug('processing event')
// (no output — debug is below the INFO threshold)

log.warn('relay slow to respond')
// 2026-03-04T20:00:01.000Z [my-module] warn: relay slow to respond
```

## API

### `Logger`

```ts
class Logger {
  constructor(name: string, log_level?: string, split_logs?: boolean)
  fatal(message: any): void
  error(message: any): void
  err(message: any): void
  warn(message: any): void
  info(message: any): void
  debug(message: any): void
}
```

**`constructor(name, log_level?, split_logs?)`**

Creates a new logger with the given namespace label.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Label printed with every log line (e.g., `'relaymon'`, `'sanitizers'`) |
| `log_level` | `string` | `'INFO'` | Minimum level to emit. One of: `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG` |
| `split_logs` | `boolean` | `false` | Reserved for future use |

**`fatal(message)` / `error(message)` / `err(message)` / `warn(message)` / `info(message)` / `debug(message)`**

Emit a log line at the corresponding level. Messages are gated by `log_level` — a message is emitted only if its level is at or above the configured threshold. `error` and `err` are aliases.

## Configuration

### Log level

Pass the log level as the second constructor argument. Level comparison is case-insensitive.

```ts
const log = new Logger('publish', 'DEBUG') // emits all levels
const log = new Logger('publish', 'WARN')  // emits warn, error, fatal only
```

The `debug` level also checks whether the `debug` npm package's namespace is enabled (via the `DEBUG` environment variable), which can enable or disable debug output selectively per namespace:

```sh
DEBUG=my-module node index.js
```

### Runtime detection

The logger detects its environment at module load time. On Node.js, Winston is loaded dynamically; in the browser (when `window` is defined), both Winston and `debug` are unavailable and the logger writes to `console` directly with the same API surface.

## Known Limitations

- **`console.log` in consuming packages:** Several packages that use `@nostrwatch/logger` also contain unconditional `console.log` calls scattered through production code (including files in `internal/announce/` and `internal/publisher/`). These bypass the logger entirely and will appear regardless of the configured log level. See [CONCERNS.md — Console.log Statements in Production Code](../../.planning/codebase/CONCERNS.md).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/utils`](../utils/README.md) — utility package; logger re-exports some utilities from it
- [`@nostrwatch/announce`](../announce/README.md) — event announcement package; primary consumer of this logger
- [`@nostrwatch/publisher`](../publisher/README.md) — event publishing package; primary consumer of this logger

## License

[MIT](../../LICENSE)
