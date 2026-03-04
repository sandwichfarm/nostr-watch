# @nostrwatch/nwcache

> **DEPRECATED** — This package is no longer maintained. Its caching functionality was inlined into consuming packages. No replacement package exists.

## Overview

`@nostrwatch/nwcache` was an internal LMDB-backed caching layer for nostr-watch. It stored relay check results, NIP-11 info documents, SSL data, DNS records, and WebSocket timing in a local embedded database. This package is deprecated — all caching functionality has been inlined into the packages that consumed it.

## Installation

This package is deprecated and should not be installed. Do not add `@nostrwatch/nwcache` as a dependency.

## Quick Start

This package is deprecated. Do not install or use it. Caching functionality is now handled directly within consuming packages.

## Why deprecated

`nwcache` provided an LMDB-backed persistence layer for relay audit data, using a mixin-based architecture (`RelayMixin`, `ChecksMixin`, `InfoMixin`, `StatMixin`, and others) to organize reads and writes by data type. As the nostr-watch codebase evolved, the caching logic was simplified and inlined directly into the packages that needed it, eliminating the overhead of a shared caching abstraction. There is no replacement package — consuming packages now manage their own persistence.

## Known Limitations

This package is deprecated and no longer maintained. No bug fixes or updates will be made.

## License

[MIT](../../LICENSE)
