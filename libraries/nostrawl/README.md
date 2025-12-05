# nostrawl

> Trawl [/trɔːl/]: 1. an act of fishing with a trawl net or seine. 2. a thorough search.

A tool for persistently fetching and processing filtered events from [nostr](https://github.com/nostr-protocol/) relays.

`nostrawl` wraps `nostr-fetch` and implements queue adapters for processing nostr events with persistent caching.

## Features

- Multiple queue adapters (in-memory or Redis-based)
- Persistent LMDB caching
- Configurable event filtering
- Event validation and parsing
- Progress tracking and event handling
- Automatic retry and reconnection

## Installation

```bash
npm install @nostrwatch/nostrawl
# or
pnpm install @nostrwatch/nostrawl
# or
yarn add @nostrwatch/nostrawl
```

## Quick Start

```javascript
import { nostrawl } from '@nostrwatch/nostrawl';

// Create a trawler with PQueue adapter
const trawler = nostrawl({
  adapter: 'pqueue',
  adapterOptions: { concurrency: 2 },
  filters: { kinds: [1] },  // Get text notes
  relays: [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz'
  ]
});

// Handle events
trawler.on('event', (event) => {
  console.log(`Received event: ${event.id}`);
});

// Track progress
trawler.on('progress', (progress) => {
  console.log(`Found ${progress.found} events, rejected ${progress.rejected}`);
});

// Start trawling
trawler.run();
```

## Available Adapters

- **PQueueAdapter**: In-memory queue for single-process environments
- **BullMQAdapter**: Redis-based queue for distributed processing

## Running Examples

The examples directory contains sample code for both queue adapters:

```bash
# Run PQueue basic example
pnpm example:pqueue:basic

# Run PQueue advanced example
pnpm example:pqueue:advanced

# Run BullMQ example (requires Docker)
pnpm example:bullmq
```

See [examples documentation](./examples/README.md) for details.

## Documentation

- [PQueue Adapter Documentation](./examples/pqueue/README.md)
- [BullMQ Adapter Documentation](./examples/bullmq/README.md)

## Running Tests

```bash
pnpm test           # Run tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with coverage
```

## License

MIT
