# @nostrwatch/umon

Browser extension for monitoring Nostr relay activity.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`umon` is a Manifest V3 browser extension for monitoring Nostr (a decentralized messaging protocol) relay activity. It provides a popup interface built with Svelte 4 and uses a background service worker for persistent monitoring. Currently in early development at v0.1.0 with a minimal feature set.

## Prerequisites

**For development:**

- Node.js >=18
- pnpm

**For end users:**

- Chrome, Chromium, or Firefox with Manifest V3 support

## Installation

**Development setup:**

```sh
cd apps/umon
pnpm install
```

**Browser installation:**

Load the built extension as an unpacked extension in your browser's developer mode. No web store listing is available at this time.

## Quick Start

```sh
# Build the extension
cd apps/umon
pnpm build

# Load in Chrome or Chromium:
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode" (toggle in top-right corner)
# 3. Click "Load unpacked"
# 4. Select the apps/umon/dist/ directory

# Load in Firefox:
# 1. Navigate to about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on..."
# 3. Select apps/umon/dist/manifest.json
```

## Configuration

The extension stores settings via the browser extension storage API. No external configuration file is required. Storage utilities are implemented in `src/utils/secureStorage.ts` and `src/utils/storage.ts`.

## Known Limitations

- **Alpha/early stage:** v0.1.0 with a minimal feature set; expect breaking changes between releases.
- **No web store listing:** The extension must be loaded as an unpacked extension in developer mode; it is not available on the Chrome Web Store or Firefox Add-ons site.
- **Svelte 4:** This extension uses Svelte 4 as a dev dependency. Other packages in the monorepo have migrated to Svelte 5; umon has not yet been updated.
- **Minimal test coverage:** Jest scaffolding is present but no meaningful test suite exists yet.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

No workspace dependencies confirmed.

## License

[MIT](../../LICENSE)
