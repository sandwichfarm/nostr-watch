# Nostr Relay Seeder

This module provides relay seeding functionality for Nostr Watch applications. It's used to discover and collect relay URLs from various sources.

## Installation

```bash
pnpm add @nostrwatch/seed
```

## Usage

```javascript
import { RelaySeeder } from '@nostrwatch/seed';

// Create a new seeder with configuration
const seeder = new RelaySeeder({
  interval: 3600000, // 1 hour in milliseconds
  sources: ['config', 'static', 'db', 'api', 'events', 'cache'],
  options: {
    allowedNetworks: ['clearnet', 'tor', 'i2p'],
    db: { 
      path: './relays.sqlite',
      enableWAL: true 
    },
    static: { path: './relays.yaml' },
    config: ['wss://relay.nostr.watch', 'wss://relay.damus.io'],
    api: { rest_api: 'https://api.nostr.watch/v1' },
    events: { 
      pubkeys: ['npub1...'], 
      relays: ['wss://relay.example.com'] 
    },
    // Optional custom relay blocking function
    isRelayBlocked: (relay) => relay.includes('blocked-relay.com')
  }
});

// Start relay seeding
await seeder.start();

// Later, to stop the seeder
seeder.stop();

// Get all relays
const relays = seeder.getRelays();
console.log(`Found ${relays.length} relays`);
```

## Features

- Multiple relay seeding strategies (configuration, static files, database, API, Nostr events)
- Custom relay blocking (blacklisting)
- Network filtering (clearnet, tor, i2p, etc.)
- TypeScript types included
- ESM compatible

## Building

```bash
# Install dependencies
pnpm install

# Build
pnpm build
```

## Development

```bash
# Lint
pnpm lint

# Run tests
pnpm test
```

## License

MIT 