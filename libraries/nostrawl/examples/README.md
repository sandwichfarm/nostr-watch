# Nostrawl Examples

This directory contains examples of how to use the Nostrawl library with different queue adapters.

## PQueue Examples

The PQueue adapter is a lightweight queue implementation that doesn't require any external services.

### Basic Example

The basic example demonstrates how to use the PQueue adapter with default settings:

```bash
pnpm example:pqueue:basic
```

This example:
- Connects to multiple relays
- Retrieves text notes (kind 1)
- Processes events with a concurrency of 2
- Caches results to disk

### Advanced Example

The advanced example shows more configuration options:

```bash
pnpm example:pqueue:advanced
```

This example demonstrates:
- Custom filter configuration
- Adjusting concurrency and rate limiting
- Handling different event types
- More detailed progress reporting

## BullMQ Example

The BullMQ adapter uses Redis for distributed queue processing.

### Running the BullMQ Example

```bash
pnpm example:bullmq
```

This example:
- Uses Docker to set up Redis
- Demonstrates distributed queue processing
- Shows how to handle jobs across multiple workers

## Writing Your Own Examples

When creating your own examples:

1. Import the `nostrawl` function from the package
2. Configure your options including:
   - `adapter`: Choose between "pqueue" or "bullmq"
   - `adapterOptions`: Configure adapter-specific settings
   - `filters`: Define what events to retrieve
   - `relays`: List of relays to connect to

3. Run your example with `tsx` or your preferred TypeScript runner

Example:

```typescript
import { nostrawl } from '@nostrwatch/nostrawl';

const trawler = nostrawl({
  adapter: 'pqueue',
  adapterOptions: {
    concurrency: 2,
    intervalCap: 10,
    interval: 1000
  },
  filters: {
    kinds: [1],
    since: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
  },
  relays: [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz'
  ]
});

trawler.on('event', (event) => {
  console.log(`Received event: ${event.id}`);
});

trawler.on('progress', (progress) => {
  console.log(`Progress: ${progress.found} events found`);
});
``` 