# @nostrwatch/nostrings

An opinionated TypeScript library for sanitizing, validating, and normalizing fuzzy strings from nostr. 

## Features

- WebSocket relay URLs (`ws://`, `wss://`)
  - **Sanitize URLs**: Removes unnecessary characters, fragments, trailing dots, and slashes.
  - **Validate URLs**: Ensures that relay URLs meet specific conditions (valid WebSocket protocol, no local IPs, etc.).
  - **Normalize URLs**: Strips unnecessary URL components like search and hash parameters.
  - **Deduplication**: Removes duplicate relay URLs after sanitization and normalization.
  

## Installation

Install via npm or yarn:

```bash
npm install @nostrwatch/relay-sanitizer
```

or

```bash
yarn add @nostrwatch/relay-sanitizer
```

## Usage

### Basic Example

```typescript
import { sanitize } from '@nostrwatch/relay-sanitizer';

const relays = [
  'wss://RELAY.EXAMPLE.COM./#ok',
  '  wss://RELAY.EXAMPLE.COM ',
  'ws://localhost',
  'ws://192.168.1.1'
  'gm'
];

const sanitizedRelays = sanitize(relays);

console.log(sanitizedRelays);
// Output: ['wss://relay.example.com']
```

## Opinions

- Websocket URL
  - There is no such thing as perfect regex for a URL.
  - When dealing with data at scale, `localhost` and local/lan reserved IP ranges are not URLs
  - Relies on `URL().toString()` for normalization. 
  - `hash` and `searchParams` are removed. 
  - `(blob_hash)` is always removed.
  - Relays are not unique to hostname, paths can be different relays. 
  - Alternative protocols like `i2p` and `tor` are considered valid. 
  - `tlds` are not validated. 

### API

#### `sanitize(relays: string[]): string[] | void`

Sanitizes and normalizes an array of relay URLs, removing duplicates.

- **relays**: An array of relay URLs.
- **Returns**: An array of sanitized and valid relay URLs, or `void` if the input is empty.

#### `maybeSplitRelayList(relays: string[]): string[]`

Splits URLs by commas if multiple relays are provided in a single string.

- **relays**: An array of relay URLs.
- **Returns**: An array of individual relay URLs.

#### `sanitizeRelayUrl(relay: string): string`

Sanitizes a single relay URL by removing unwanted characters and normalizing it.

- **relay**: A single relay URL string.
- **Returns**: A sanitized and normalized relay URL string.

#### `qualifyRelayUrl(relay: string): boolean`

Validates whether the relay URL meets the required conditions (valid protocol, no local IPs, etc.).

- **relay**: A single relay URL string.
- **Returns**: `true` if valid, `false` otherwise.

#### `normalizeRelayUrl(relay: string): string`

Normalizes a single relay URL by stripping out hash and search parameters.

- **relay**: A single relay URL string.
- **Returns**: A normalized relay URL string or an empty string if invalid.

#### `dedup(relays: string[]): string[]`

Removes duplicate URLs from the array.

- **relays**: An array of relay URLs.
- **Returns**: A deduplicated array of relay URLs.

## Logging

This library uses the `@nostrwatch/logger` package for logging debug and warning messages.

## License

MIT License.