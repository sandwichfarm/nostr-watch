# Getting Started with CVM

## Claude Desktop Setup

The fastest way to use CVM is through Claude Desktop with the MCP integration.

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "relayvm": {
      "command": "npx",
      "args": ["-y", "@nostr-watch/relayvm"],
      "env": {
        "CVM_RELAYS": "wss://relay.damus.io,wss://relay.nostr.band",
        "INGEST_RELAYS": "wss://history.nostr.watch",
        "CVM_SERVER_NSEC": "nsec1..."
      }
    }
  }
}
```

Once configured, you can ask Claude natural language questions about relay data:

```
Find all relays that support NIP-42 authentication

List the top 10 most reliable relays by uptime

Show me relays within 100km of San Francisco

Compare relay.damus.io and relay.nostr.band

What's the current cache hit rate?

Find all relays running strfry software

Show me offline relays that were recently seen
```

Claude will automatically call the appropriate CVM tools and present the results.

## Programmatic Usage

You can call CVM tools directly over Nostr. The protocol works like this:

1. Connect to the CVM relay(s)
2. Send a tool call as a Nostr event
3. Receive the result as a response event

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CVM_RELAYS` | Yes | Comma-separated relay URLs for CVM transport |
| `INGEST_RELAYS` | Yes | Comma-separated relay URLs for NIP-66 data ingestion |
| `CVM_SERVER_NSEC` | Yes | Server private key (nsec format) for signing responses |

### Example: List Relays

A CVM tool call is an MCP `tools/call` request transported over Nostr:

```javascript
// Conceptual example - the CVM SDK handles the Nostr transport
const result = await cvmClient.callTool('relays/list', {
  limit: 10,
  sortBy: 'updated',
  sortOrder: 'desc',
  format: 'detailed'
})

console.log(result.relays) // Array of relay state objects
console.log(result.total)  // Total relay count
```

### Example: Search Relays

```javascript
const result = await cvmClient.callTool('relays/search', {
  network: 'clearnet',
  nips: [42, 50],
  software: { family: 'strfry' },
  maxLatency: { open: 200 },
  limit: 50,
  format: 'detailed'
})

console.log(`Found ${result.total} matching relays`)
```

### Example: Find Nearby Relays

```javascript
const result = await cvmClient.callTool('relays/nearby', {
  lat: 37.7749,
  lon: -122.4194,
  radius: 100,
  maxResults: 10,
  format: 'detailed'
})

for (const relay of result.relays) {
  console.log(`${relay.relayUrl} - ${relay.distance}km away`)
}
```

### Example: Compare Relays

```javascript
const result = await cvmClient.callTool('relays/compare', {
  relayUrls: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://relay.snort.social'
  ]
})

console.log('Common NIPs:', result.comparison.common.nips)
console.log('Different networks:', result.comparison.differences.network)
console.log('Different software:', result.comparison.differences.software)
```

## Response Formats

All relay query tools support a `format` parameter:

| Format | Returns | Use When |
|--------|---------|----------|
| `full` | All fields including per-monitor attribution | You need to see which monitors reported what |
| `detailed` | Aggregated values without attribution (default) | Most use cases |
| `simple` | Relay URLs only | You just need a list of addresses |

## Next Steps

- [Tools Reference](./tools-reference) -- full documentation for all 21 tools
- [Self-Hosting](./self-hosting) -- run your own rstate CVM
- [Payments](./payments) -- payment flows for premium tools
