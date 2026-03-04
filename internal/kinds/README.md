# @nostrwatch/kinds

Workspace placeholder for Nostr event kind constants.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](../../LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/kinds` exists as a workspace package intended to hold Nostr event kind (numeric identifiers for event types in the Nostr protocol) constants shared across the monorepo. The package currently contains only build configuration (`rollup.config.json`, `tsconfig.json`) and has no source directory and no exported symbols. It is retained as a workspace package for future use.

## Installation

This is an internal monorepo package. If you need to add it as a workspace dependency:

```sh
pnpm add @nostrwatch/kinds --filter @nostrwatch/your-package
```

It is not published to npm. Note that the package has no exports at this time.

## Quick Start

This package has no active exports. There is nothing to import.

## Known Limitations

- **No active code or exports:** This package contains only build configuration. It exists as a workspace placeholder and cannot be used as a dependency until source code is added.

## License

[MIT](../../LICENSE)
