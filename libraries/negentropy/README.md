# Negentropy Utils

Utilities for implementing the Negentropy Syncing protocol (NIP-77) for Nostr clients and relays.

## Table of Contents

- [Installation](#installation)
- [Building](#building)
- [Testing](#testing)
- [Usage](#usage)
  - [Client Handler](#client-handler)
  - [Server Handler](#server-handler)
- [Development](#development)
- [License](#license)

## Installation

**Using Yarn Workspaces:**

```sh
# Install development dependencies
yarn workspace @nostrwatch/negentropy-utils add -D esbuild vitest typescript @types/node
```

**Standalone Installation:**

```sh
# Install dependencies
yarn add @nostrwatch/negentropy-utils
```

## Building

To build the project for both Node.js and browser environments:

```sh
yarn build
```

This will generate:

- `dist/index.node.js` - For Node.js (CommonJS)
- `dist/index.browser.js` - For Browser (ES Module)

## Testing

Run the test suite using Vitest:

```sh
yarn test
```

## Usage

### Client Handler

```typescript
// src/client.ts

import { ClientHandler } from './ClientHandler';
import { WebSocketTransport } from './transports/WebSocketTransport';
import { RecordItem } from './types';

// Your local records
const records: RecordItem[] = [
  // Populate with your events
];

// Create a WebSocket connection
const websocket = new WebSocket('wss://relay.example.com');

// Create a WebSocketTransport
const transport = new WebSocketTransport(websocket);

// Nostr filter
const filter = {
  kinds: [1],
};

// Subscription ID
const subscriptionId = 'sub-123';

// Instantiate the client handler
const clientHandler = new ClientHandler(records, transport, filter, subscriptionId);

// Start syncing when the WebSocket is open
websocket.onopen = () => {
  clientHandler.startSync();
};
```

### Server Handler

```typescript
// src/server.ts

import { ServerHandler } from './ServerHandler';
import { WebSocketTransport } from './transports/WebSocketTransport';
import { RecordItem } from './types';

// Your server records
const records: RecordItem[] = [
  // Populate with your events
];

// WebSocket server (using 'ws' library)
import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws: WebSocket) => {
  // Create a WebSocketTransport
  const transport = new WebSocketTransport(ws);

  const serverHandler = new ServerHandler(records, transport);

  // No need to set up ws.on('message') here, as the transport handles it
});
```

## Development

### Project Structure

```
.
├── README.md
├── package.json
└── src
    ├── ClientHandler.test.ts
    ├── ClientHandler.ts
    ├── ServerHandler.test.ts
    ├── ServerHandler.ts
    ├── index.ts
    ├── types.ts
    ├── utils
    │   ├── crypto.ts
    │   ├── encoding.ts
    │   ├── helpers.ts
    │   └── index.ts
    └── version.ts
```

### Scripts

- **Build**: `yarn build` - Builds the project for Node.js and browser.
- **Test**: `yarn test` - Runs the test suite with Vitest.

## License

[MIT](LICENSE)