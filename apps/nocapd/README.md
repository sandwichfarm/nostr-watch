# @nostrwatch/nocapd

> **DEPRECATED** -- This package has been replaced by [@nostrwatch/relaymon](../relaymon/README.md). No further updates will be made here.

## Overview

`nocapd` was an early relay monitoring daemon that checked Nostr relay (WebSocket servers that store and forward events) health on a polling schedule. It has been deprecated and replaced by `relaymon`. No new features or fixes will be made to this package.

## Installation

N/A -- this package is deprecated. See [@nostrwatch/relaymon](../relaymon/README.md).

## Quick Start

N/A -- this package is deprecated. See [@nostrwatch/relaymon](../relaymon/README.md).

## Why deprecated

`nocapd` was an early relay monitoring daemon that checked relay health on a polling schedule. It has been replaced by `relaymon`, which provides a more robust and configurable monitoring loop, better database integration, and improved NIP-66 event publishing. `nocapd` is no longer maintained.

## Migrating

Use [`@nostrwatch/relaymon`](../relaymon/README.md) instead. Configuration format has changed -- see the relaymon README for the new environment variable schema.

## Known Limitations

N/A -- this package is deprecated.

## License

[MIT](../../LICENSE)
