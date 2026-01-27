# PQueue Examples

This directory contains examples of using Nostrawl with the PQueue adapter, which provides a lightweight in-memory queue implementation.

## Basic Example

The basic example (`basic-example.ts`) demonstrates the simplest way to use Nostrawl with PQueue:

```bash
pnpm example:pqueue:basic
```

This example:
- Connects to 5 different relays
- Retrieves text notes (kind 1)
- Uses a concurrency of 2 for processing
- Caches results to disk at `./cache`
- Runs for 2 minutes before stopping

Key configuration:
```typescript
const trawler = nostrawl({
  adapter: 'pqueue',
  adapterOptions: {
    concurrency: 2,
    timeout: 30000,
    cache: {
      path: './cache'
    }
  },
  filters: {
    kinds: [1]
  },
  relays: [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz',
    'wss://relay.nostr.band',
    'wss://nostr.bitcoiner.social',
    'wss://relay.nostr.info'
  ]
});
```

## Advanced Example

The advanced example (`advanced-example.ts`) shows more configuration options and event handling:

```bash
pnpm example:pqueue:advanced
```

This example demonstrates:
- Custom filter configuration with multiple kinds
- Rate limiting with `intervalCap` and `interval`
- Detailed progress reporting
- Error handling
- Custom event processing logic

Key features:
```typescript
const trawler = nostrawl({
  adapter: 'pqueue',
  adapterOptions: {
    concurrency: 3,
    intervalCap: 10,
    interval: 1000,
    timeout: 60000
  },
  filters: {
    kinds: [1, 3, 7], // Text notes, contacts, reactions
    since: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
  },
  relays: [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz'
  ]
});

// Custom event handling
trawler.on('event', (event) => {
  switch (event.kind) {
    case 1:
      console.log(`Note: ${event.content}`);
      break;
    case 3:
      console.log(`Contact list updated`);
      break;
    case 7:
      console.log(`Reaction received`);
      break;
  }
});

// Error handling
trawler.on('error', (error) => {
  console.error('Error:', error);
});
```

## Configuration Options

The PQueue adapter supports the following options:

- `concurrency`: Number of jobs to process simultaneously (default: 1)
- `intervalCap`: Maximum number of jobs per interval (default: Infinity)
- `interval`: Interval in milliseconds for rate limiting (default: 0)
- `timeout`: Timeout in milliseconds for job processing (default: 30000)
- `cache`: Cache configuration
  - `path`: Directory to store cache files
  - `ttl`: Time-to-live for cached items in seconds

## Events

The trawler emits the following events:

- `event`: Emitted when a new event is received
- `progress`: Emitted with progress updates
- `error`: Emitted when an error occurs
- `complete`: Emitted when all jobs are completed
- `idle`: Emitted when the queue becomes idle

## Best Practices

1. Always set appropriate concurrency and rate limits to avoid overwhelming relays
2. Use caching for long-running operations
3. Implement proper error handling
4. Monitor progress events for debugging
5. Clean up resources when done 