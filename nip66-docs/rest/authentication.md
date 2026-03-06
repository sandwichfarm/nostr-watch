# Authentication, Rate Limiting & Payments

## Authentication

Most REST endpoints are **public and unauthenticated**. Authentication is only required for:

- **Policy updates** (`PUT /policy`) -- requires NIP-98 HTTP Auth

### NIP-98 HTTP Auth

Policy updates use [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) authentication. Create a signed Nostr event and pass it as a Bearer token.

```typescript
import { finishEvent, getPublicKey } from 'nostr-tools'

async function updatePolicy(newPolicy: any, privateKey: Uint8Array) {
  const publicKey = getPublicKey(privateKey)

  // Create NIP-98 auth event
  const authEvent = finishEvent({
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', 'https://api.nostr.watch/v2/policy'],
      ['method', 'PUT'],
    ],
    content: '',
  }, privateKey)

  const authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`

  const response = await fetch('https://api.nostr.watch/v2/policy', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(newPolicy),
  })

  return response.json()
}
```

The server validates that:
1. The event signature is valid
2. The pubkey is in the `allowedPubkeys` configuration
3. The `u` tag matches the request URL
4. The `method` tag matches the HTTP method
5. The event `created_at` is recent (within a few minutes)

## Rate Limiting

The REST API uses rate limiting to prevent abuse. Default configuration:

| Setting | Default Value |
|---------|---------------|
| Requests per second | 10 |
| Max burst | 100 |

### Rate Limit Headers

When rate limiting is active, responses include:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait (only on 429 responses) |

### Handling Rate Limits

When you receive a `429 Too Many Requests` response:

1. Read the `Retry-After` header
2. Wait that many seconds
3. Retry the request

```typescript
async function fetchWithRateLimit(url: string): Promise<any> {
  const response = await fetch(url)

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '5')
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
    return fetchWithRateLimit(url)
  }

  return response.json()
}
```

### Best Practices

- **Cache responses locally.** NIP-66 data updates hourly -- there's rarely a reason to poll more frequently.
- **Use pagination.** Fetch smaller pages instead of requesting all data at once.
- **Batch related queries.** Use `/relays/search` with multiple filters instead of multiple separate requests.
- **Use `/relays/compare`** instead of fetching individual relay states when comparing.

## Rate Limit Configuration (Self-Hosting)

When running your own rstate instance, configure rate limiting in `config.yaml`:

```yaml
rest:
  rateLimit:
    enabled: true
    requestsPerSecond: 10
    maxBurst: 100
```

Set `enabled: false` to disable rate limiting entirely on your own instance.

## Payments (REST)

The REST API can optionally require payment for certain endpoints. This works separately from CVM payments.

When enabled, premium endpoints return a `402 Payment Required` response with payment instructions. This feature is configurable per-endpoint by the operator.

For the public nostr.watch API, all endpoints are currently free.

## CORS

The REST API supports CORS for browser-based clients. Allowed origins are configured server-side:

```yaml
rest:
  corsOrigins:
    - 'https://your-app.example.com'
    - 'http://localhost:3000'
```

If you're making requests from a browser and receiving CORS errors, the API operator needs to add your origin to the allowed list. When self-hosting, add your origins to the config.

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "RELAY_NOT_FOUND",
    "message": "Relay wss://example.com not found"
  }
}
```

Common error codes:

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 404 | `RELAY_NOT_FOUND` | Relay URL not in the dataset |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
