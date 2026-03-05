# @nostrwatch/purist

Browser-based Nostr relay scanner.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

Purist is a client-side web application for scanning and testing Nostr relays (WebSocket servers that store and forward events) directly in the browser. It uses Web Workers for parallel relay checks, including NIP-11 (relay information document) retrieval and connectivity testing. The app is distributed as pre-built static assets — no server-side runtime is required.

## Installation

No package manager installation is needed. The app is distributed as pre-built static files in the `dist/` directory.

```sh
# Host the dist/ directory with any static file server
npx serve dist

# Or open directly in a browser (no server required)
open dist/index.html
```

## Quick Start

```sh
# Option 1: Open directly in a browser
open apps/purist/dist/index.html

# Option 2: Serve with a local HTTP server
cd apps/purist
npx serve dist
# Visit http://localhost:3000
```

## Known Limitations

- **No source code in repository:** This package contains only pre-built assets in `dist/`. The original source is not present in the monorepo, so the app cannot be modified or rebuilt from this repository. No workaround is available; rebuilding requires the original source.
- **No package.json:** Standard monorepo tooling (`pnpm install`, `pnpm build`) does not apply to this package. The app cannot be built or updated via monorepo scripts.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

No related packages confirmed (no package.json to reference workspace dependencies).

## License

[MIT](../../LICENSE)
