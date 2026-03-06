# REST API

The rstate REST API provides standard HTTP endpoints for querying aggregated relay monitoring data. This is the simplest way to get started -- no Nostr knowledge required.

## Base URL

The public nostr.watch REST API is available at:

```
https://api.nostr.watch/v2
```

When self-hosting, the default is `http://localhost:3000`.

## OpenAPI & Sandbox

Interactive OpenAPI documentation and a live sandbox are available at [api.nostr.watch/v2/](https://api.nostr.watch/v2/). You can browse all endpoints, see request/response schemas, and try queries directly from your browser.

## Key Features

- **Standard HTTP** -- works with any language, no special libraries needed
- **OpenAPI docs & sandbox** -- interactive documentation at [api.nostr.watch/v2/](https://api.nostr.watch/v2/)
- **Three response formats** -- `full`, `detailed` (default), `simple`
- **Pagination** -- `limit` and `offset` on all list endpoints
- **Sorting** -- `sortBy` and `sortOrder` on list endpoints
- **Geospatial queries** -- find relays by coordinates or bounding box
- **Label filtering** -- query relays by country, ISP, software, etc.

## Quick Example

```bash
# List first 10 relays sorted by most recently updated
curl 'https://api.nostr.watch/v2/relays?limit=10&sortBy=updated&sortOrder=desc'

# Get state for a specific relay
curl 'https://api.nostr.watch/v2/relays/state?relayUrl=wss://relay.damus.io'

# Search for relays supporting NIP-42
curl -X POST https://api.nostr.watch/v2/relays/search \
  -H "Content-Type: application/json" \
  -d '{"nips": [42]}'

# Health check
curl https://api.nostr.watch/v2/health/ping
```

## Trust Model

The REST API serves **aggregated** data. The rstate engine ingests raw NIP-66 events from multiple independent monitors, computes consensus values (using configurable quorum and outlier detection), and returns the result.

When using a third-party REST API, you trust that the operator is running an honest rstate instance. To eliminate this trust requirement:
- [Self-host rstate](/cvm/self-hosting) and enable `rest.enabled: true` in config
- Use [Raw NIP-66 events](/nip66/) to verify data independently

## Next Steps

- [Endpoints](./endpoints) -- full endpoint reference
- [Examples](./examples) -- multi-language code examples
- [Authentication](./authentication) -- auth, rate limiting, and payments
