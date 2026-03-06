# Code Examples

Multi-language examples for common REST API operations.

## cURL

```bash
# Health check
curl -s https://api.nostr.watch/v2/health/ping | jq '.'

# List relays sorted by uptime
curl 'https://api.nostr.watch/v2/relays?limit=10&sortBy=updated&sortOrder=desc'

# Get specific relay
curl 'https://api.nostr.watch/v2/relays/state?relayUrl=wss%3A%2F%2Frelay.damus.io'

# Search for NIP-42 relays
curl -X POST https://api.nostr.watch/v2/relays/search \
  -H "Content-Type: application/json" \
  -d '{"nips": [42]}'

# Find relays near San Francisco
curl 'https://api.nostr.watch/v2/relays/nearby?lat=37.7749&lon=-122.4194&radius=100'

# Group by software
curl https://api.nostr.watch/v2/relays/by/software

# Compare relays
curl -X POST https://api.nostr.watch/v2/relays/compare \
  -H "Content-Type: application/json" \
  -d '{"relayUrls": ["wss://relay.damus.io", "wss://relay.nostr.band"]}'

# Find relays by country
curl 'https://api.nostr.watch/v2/relays/by/label?namespace=country&value=US'

# Get online relays
curl -X POST https://api.nostr.watch/v2/relays/online \
  -H "Content-Type: application/json" \
  -d '{}'
```

## JavaScript / TypeScript

```typescript
const BASE_URL = 'https://api.nostr.watch/v2'

// Health check
const health = await fetch(`${BASE_URL}/health/ping`).then(r => r.json())
console.log('Status:', health.status)
console.log('Cache hit rate:', health.cache.hitRatePercent, '%')

// List relays
const relays = await fetch(`${BASE_URL}/relays?limit=10&sortBy=updated&sortOrder=desc`)
  .then(r => r.json())
console.log(`${relays.total} total relays, showing ${relays.relays.length}`)

// Get specific relay
const encodedUrl = encodeURIComponent('wss://relay.damus.io')
const relay = await fetch(`${BASE_URL}/relays/state?relayUrl=${encodedUrl}`)
  .then(r => r.json())
console.log('Relay state:', relay)

// Search with filters
const searchResults = await fetch(`${BASE_URL}/relays/search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nips: [42],
    network: 'clearnet',
    minSupport: 0.8,
    limit: 50,
  }),
}).then(r => r.json())
console.log(`Found ${searchResults.total} NIP-42 relays`)

// Find nearby relays
const nearby = await fetch(`${BASE_URL}/relays/nearby?lat=37.7749&lon=-122.4194&radius=100`)
  .then(r => r.json())
console.log(`${nearby.relays.length} relays within 100km of SF`)

// Compare relays
const comparison = await fetch(`${BASE_URL}/relays/compare`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    relayUrls: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
  }),
}).then(r => r.json())
console.log('Common NIPs:', comparison.comparison.common.nips)
```

### With Rate Limit Handling

```typescript
async function fetchWithRetry(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, options)

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const waitSeconds = retryAfter ? parseInt(retryAfter) : 5
    console.log(`Rate limited. Retrying after ${waitSeconds}s...`)
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
    return fetchWithRetry(url, options)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}
```

## Python

```python
import requests
from urllib.parse import quote

BASE_URL = "https://api.nostr.watch/v2"

# Health check
health = requests.get(f"{BASE_URL}/health/ping").json()
print(f"Status: {health['status']}")
print(f"Cache hit rate: {health['cache']['hitRatePercent']}%")

# List relays
relays = requests.get(f"{BASE_URL}/relays", params={
    "limit": 10,
    "sortBy": "updated",
    "sortOrder": "desc",
}).json()
print(f"{relays['total']} total relays, showing {len(relays['relays'])}")

# Get specific relay
encoded_url = quote("wss://relay.damus.io", safe="")
relay = requests.get(f"{BASE_URL}/relays/state", params={
    "relayUrl": "wss://relay.damus.io",
}).json()
print(f"Relay state: {relay}")

# Search with filters
search_results = requests.post(f"{BASE_URL}/relays/search", json={
    "nips": [42],
    "network": "clearnet",
    "minSupport": 0.8,
    "limit": 50,
}).json()
print(f"Found {search_results['total']} NIP-42 relays")

# Find nearby relays
nearby = requests.get(f"{BASE_URL}/relays/nearby", params={
    "lat": 37.7749,
    "lon": -122.4194,
    "radius": 100,
}).json()
print(f"{len(nearby['relays'])} relays within 100km of SF")

# Compare relays
comparison = requests.post(f"{BASE_URL}/relays/compare", json={
    "relayUrls": ["wss://relay.damus.io", "wss://relay.nostr.band"],
}).json()
print(f"Common NIPs: {comparison['comparison']['common']['nips']}")
```

### With Retry Logic

```python
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET", "POST"],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Use session instead of requests for automatic retries
relays = session.get(f"{BASE_URL}/relays", params={"limit": 10}).json()
```

## Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "time"
)

const baseURL = "https://api.nostr.watch/v2"

var client = &http.Client{Timeout: 30 * time.Second}

func healthCheck() {
    resp, err := client.Get(baseURL + "/health/ping")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var health map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&health)
    fmt.Printf("Status: %s\n", health["status"])
}

func listRelays() {
    u, _ := url.Parse(baseURL + "/relays")
    q := u.Query()
    q.Set("limit", "10")
    q.Set("sortBy", "updated")
    q.Set("sortOrder", "desc")
    u.RawQuery = q.Encode()

    resp, err := client.Get(u.String())
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Printf("Total relays: %v\n", result["total"])
}

func searchRelays() {
    payload := map[string]interface{}{
        "nips":       []int{42},
        "network":    "clearnet",
        "minSupport": 0.8,
        "limit":      50,
    }
    body, _ := json.Marshal(payload)

    resp, err := client.Post(
        baseURL+"/relays/search",
        "application/json",
        bytes.NewReader(body),
    )
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Printf("NIP-42 relays: %v\n", result["total"])
}

func main() {
    healthCheck()
    listRelays()
    searchRelays()
}
```
