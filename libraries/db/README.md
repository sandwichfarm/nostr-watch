# @nostrwatch/db

A SQLite database package for NostrWatch applications.

## Installation

```bash
npm install @nostrwatch/db
```

## Usage

```typescript
import { NostrWatchDB } from "@nostrwatch/db";

// Create a new database instance
const db = new NostrWatchDB("path/to/database.db");

// Use the database methods
db.seedNewRelay("wss://relay.example.com", "clearnet");
db.getOnlineRelays();
db.persistResult({ /* ... */ });

// Don't forget to close the database when done
db.close();
```

## API

### Constructor
```typescript
new NostrWatchDB(dbPath: string)
```

### Methods

#### `isReadyToCheck(checkedAt: number, retries: number, expirySeconds: number, retryManager: any): boolean`
Check if a relay is ready to be checked based on its last check time and retry count.

#### `getExpiredRelays(expires: number, allowedNetworks: string[], retryManager: any): string[]`
Get a list of relays that have expired and are ready to be checked.

#### `persistResult(result: any): void`
Persist a relay check result to the database.

#### `incrementRetryCount(url: string): void`
Increment the retry count for a relay.

#### `seedNewRelay(url: string, network: string): boolean`
Add a new relay to the database. Returns true if the relay was added, false if it already existed.

#### `getOnlineRelays(): string[]`
Get a list of all online relays.

#### `saveSeederTimestamp(method: string, timestamp: number): void`
Save the timestamp of when a seeder method was last run.

#### `getSeederTimestamps(): Record<string, number>`
Get all seeder method timestamps.

#### `getRetryCount(url: string): number`
Get the current retry count for a relay.

#### `close(): void`
Close the database connection.

## Types

### RelayStatus
```typescript
interface RelayStatus {
  url: string;
  online: number;
  ignore: number;
  parent: string;
  checked_at: number;
  rtt: number;
  network: string;
  retries: number;
}
```

### SeederTimestamp
```typescript
interface SeederTimestamp {
  method: string;
  timestamp: number;
}
``` 