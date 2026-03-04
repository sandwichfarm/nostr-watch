# RelayVM API Examples

Comprehensive examples for using RelayVM's REST API and MCP interfaces in various programming languages and scenarios.

## Table of Contents

1. [REST API Examples](#rest-api-examples)
   - [cURL](#curl-examples)
   - [JavaScript/TypeScript](#javascripttypescript)
   - [Python](#python)
   - [Go](#go)
2. [Server-Sent Events (SSE)](#server-sent-events)
3. [MCP Examples](#mcp-examples)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Authentication](#authentication)

## REST API Examples

### cURL Examples

#### Health Check

```bash
# Basic health check
curl http://localhost:3000/health/ping

# Pretty-printed with jq
curl -s http://localhost:3000/health/ping | jq '.'

# Check specific metric
curl -s http://localhost:3000/health/ping | jq '.cache.hitRatePercent'
```

#### List Relays

```bash
# Get first 10 relays
curl 'http://localhost:3000/relays?limit=10&offset=0'

# Sort by uptime
curl 'http://localhost:3000/relays?limit=10&sortBy=uptime&sortOrder=desc'

# Get specific relay
curl 'http://localhost:3000/relays/wss%3A%2F%2Frelay.damus.io'
```

#### Search Relays

```bash
# Find relays supporting NIP-42
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "nips": [42]
    }
  }'

# Find clearnet relays with low latency
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "network": ["clearnet"],
      "maxLatency": 100
    }
  }'

# Find relays by software
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "software": "strfry"
    }
  }'

# Complex search with pagination
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "nips": [1, 9, 11],
      "network": ["clearnet"],
      "minSupport": 0.7
    },
    "limit": 50,
    "offset": 0
  }'
```

#### Geospatial Queries

```bash
# Find relays near coordinates (100km radius)
curl -X POST http://localhost:3000/relays/nearby \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 37.7749,
    "lon": -122.4194,
    "radiusKm": 100
  }'

# Find relays in bounding box (San Francisco Bay Area)
curl -X POST http://localhost:3000/relays/bbox \
  -H "Content-Type: application/json" \
  -d '{
    "minLat": 37.2,
    "maxLat": 38.0,
    "minLon": -122.5,
    "maxLon": -121.5
  }'
```

#### Labels

```bash
# List all available labels
curl http://localhost:3000/labels

# Get labels for specific relay
curl 'http://localhost:3000/relays/wss%3A%2F%2Frelay.damus.io/labels'

# Find relays by country
curl -X POST http://localhost:3000/relays/by-label \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "country",
    "value": "US"
  }'

# Find relays by ISP
curl -X POST http://localhost:3000/relays/by-label \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "isp",
    "value": "amazon"
  }'
```

#### Aggregations

```bash
# Group by software
curl http://localhost:3000/relays/by-software

# Group by network type
curl http://localhost:3000/relays/by-network

# Group by NIP support
curl http://localhost:3000/relays/by-nip

# Group by country
curl http://localhost:3000/relays/by-country
```

#### Compare Relays

```bash
# Compare multiple relays
curl -X POST http://localhost:3000/relays/compare \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://relay.snort.social"
    ]
  }'
```

#### Monitor Information

```bash
# List all monitors
curl http://localhost:3000/monitors

# Get specific monitor
curl 'http://localhost:3000/monitors/MONITOR_PUBKEY_HEX'

# Get monitor analytics
curl 'http://localhost:3000/monitors/MONITOR_PUBKEY_HEX/analytics'

# Get all monitor analytics
curl http://localhost:3000/monitors/analytics
```

#### Policy Management

```bash
# Get current policy
curl http://localhost:3000/policy

# Update policy (requires authentication)
curl -X PUT http://localhost:3000/policy \
  -H "Content-Type: application/json" \
  -H "Authorization: Nostr BASE64_AUTH_EVENT" \
  -d '{
    "quorum": 0.6,
    "labelQuorum": 0.4
  }'
```

### JavaScript/TypeScript

#### Basic Client

```typescript
// relayvm-client.ts
class RelayVMClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health/ping`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async listRelays(params?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

    const response = await fetch(`${this.baseUrl}/relays?${query}`);
    if (!response.ok) {
      throw new Error(`Failed to list relays: ${response.statusText}`);
    }
    return response.json();
  }

  async getRelay(url: string): Promise<any> {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(`${this.baseUrl}/relays/${encodedUrl}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get relay: ${response.statusText}`);
    }

    return response.json();
  }

  async searchRelays(filter: any, limit: number = 100, offset: number = 0): Promise<any> {
    const response = await fetch(`${this.baseUrl}/relays/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, limit, offset }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  async nearbyRelays(lat: number, lon: number, radiusKm: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/relays/nearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lon, radiusKm }),
    });

    if (!response.ok) {
      throw new Error(`Nearby search failed: ${response.statusText}`);
    }

    return response.json();
  }

  async compareRelays(urls: string[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}/relays/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      throw new Error(`Compare failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Usage examples
async function examples() {
  const client = new RelayVMClient();

  // Health check
  const health = await client.healthCheck();
  console.log('Service status:', health.status);
  console.log('Cache hit rate:', health.cache.hitRatePercent, '%');

  // List relays
  const relays = await client.listRelays({ limit: 10, sortBy: 'uptime', sortOrder: 'desc' });
  console.log('Top 10 relays by uptime:', relays.relays);

  // Get specific relay
  const relay = await client.getRelay('wss://relay.damus.io');
  if (relay) {
    console.log('Relay state:', relay);
  }

  // Search for NIP-42 relays
  const nip42Relays = await client.searchRelays({
    nips: [42],
    minSupport: 0.8,
  });
  console.log('NIP-42 relays:', nip42Relays.relays.length);

  // Find nearby relays (San Francisco)
  const nearby = await client.nearbyRelays(37.7749, -122.4194, 100);
  console.log('Relays within 100km:', nearby.relays);

  // Compare relays
  const comparison = await client.compareRelays([
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
  ]);
  console.log('Comparison:', comparison);
}
```

#### With Rate Limit Handling

```typescript
class RelayVMClientWithRetry extends RelayVMClient {
  private async fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limited
      const retryAfter = response.headers.get('Retry-After');
      const waitSeconds = retryAfter ? parseInt(retryAfter) : 5;

      console.log(`Rate limited. Retrying after ${waitSeconds} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));

      return this.fetchWithRetry(url, options);
    }

    return response;
  }

  async searchRelays(filter: any, limit: number = 100, offset: number = 0): Promise<any> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/relays/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, limit, offset }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### Python

#### Basic Client

```python
# relayvm_client.py
import requests
from typing import Dict, List, Optional, Any
from urllib.parse import quote

class RelayVMClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()

    def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        response = self.session.get(f"{self.base_url}/health/ping")
        response.raise_for_status()
        return response.json()

    def list_relays(
        self,
        limit: int = 100,
        offset: int = 0,
        sort_by: Optional[str] = None,
        sort_order: str = "asc"
    ) -> Dict[str, Any]:
        """List relays with pagination"""
        params = {
            "limit": limit,
            "offset": offset,
        }
        if sort_by:
            params["sortBy"] = sort_by
            params["sortOrder"] = sort_order

        response = self.session.get(f"{self.base_url}/relays", params=params)
        response.raise_for_status()
        return response.json()

    def get_relay(self, url: str) -> Optional[Dict[str, Any]]:
        """Get specific relay state"""
        encoded_url = quote(url, safe='')
        response = self.session.get(f"{self.base_url}/relays/{encoded_url}")

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    def search_relays(
        self,
        filter_params: Dict[str, Any],
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Search relays by filter criteria"""
        payload = {
            "filter": filter_params,
            "limit": limit,
            "offset": offset,
        }

        response = self.session.post(
            f"{self.base_url}/relays/search",
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def nearby_relays(
        self,
        lat: float,
        lon: float,
        radius_km: float
    ) -> Dict[str, Any]:
        """Find relays near coordinates"""
        payload = {
            "lat": lat,
            "lon": lon,
            "radiusKm": radius_km,
        }

        response = self.session.post(
            f"{self.base_url}/relays/nearby",
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def compare_relays(self, urls: List[str]) -> Dict[str, Any]:
        """Compare multiple relays"""
        payload = {"urls": urls}

        response = self.session.post(
            f"{self.base_url}/relays/compare",
            json=payload
        )
        response.raise_for_status()
        return response.json()

    def list_monitors(self) -> Dict[str, Any]:
        """List all known monitors"""
        response = self.session.get(f"{self.base_url}/monitors")
        response.raise_for_status()
        return response.json()

    def get_monitor_analytics(self, pubkey: Optional[str] = None) -> Dict[str, Any]:
        """Get monitor reliability analytics"""
        if pubkey:
            url = f"{self.base_url}/monitors/{pubkey}/analytics"
        else:
            url = f"{self.base_url}/monitors/analytics"

        response = self.session.get(url)
        response.raise_for_status()
        return response.json()

# Usage examples
if __name__ == "__main__":
    client = RelayVMClient()

    # Health check
    health = client.health_check()
    print(f"Status: {health['status']}")
    print(f"Cache hit rate: {health['cache']['hitRatePercent']}%")

    # List top relays
    relays = client.list_relays(limit=10, sort_by="uptime", sort_order="desc")
    print(f"Found {relays['total']} relays, showing {len(relays['relays'])}")

    # Search for specific NIPs
    nip_relays = client.search_relays({
        "nips": [1, 9, 11],
        "minSupport": 0.8,
    })
    print(f"Relays supporting NIPs 1,9,11: {len(nip_relays['relays'])}")

    # Find nearby relays
    nearby = client.nearby_relays(37.7749, -122.4194, 100)
    print(f"Relays within 100km of SF: {len(nearby['relays'])}")

    # Compare relays
    comparison = client.compare_relays([
        "wss://relay.damus.io",
        "wss://relay.nostr.band",
    ])
    print("Comparison:", comparison)
```

#### With Retry Logic

```python
import time
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

class RelayVMClientWithRetry(RelayVMClient):
    def __init__(self, base_url: str = "http://localhost:3000"):
        super().__init__(base_url)

        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def search_relays(self, filter_params: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Search with automatic retry on rate limit"""
        try:
            return super().search_relays(filter_params, **kwargs)
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                retry_after = int(e.response.headers.get('Retry-After', 5))
                print(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                return super().search_relays(filter_params, **kwargs)
            raise
```

### Go

```go
// relayvm/client.go
package relayvm

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "strconv"
    "time"
)

type Client struct {
    BaseURL    string
    HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
    return &Client{
        BaseURL: baseURL,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

type HealthResponse struct {
    Status            string `json:"status"`
    Version           string `json:"version"`
    Uptime            int    `json:"uptime"`
    ObservationCount  int    `json:"observationCount"`
    RelayCount        struct {
        Transport  int `json:"transport"`
        Ingestion  int `json:"ingestion"`
    } `json:"relayCount"`
    Cache struct {
        Size           int     `json:"size"`
        MaxSize        int     `json:"maxSize"`
        HitRate        float64 `json:"hitRate"`
        HitRatePercent float64 `json:"hitRatePercent"`
    } `json:"cache"`
}

func (c *Client) HealthCheck() (*HealthResponse, error) {
    resp, err := c.HTTPClient.Get(c.BaseURL + "/health/ping")
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("health check failed: %s", resp.Status)
    }

    var health HealthResponse
    if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
        return nil, err
    }

    return &health, nil
}

type ListRelaysParams struct {
    Limit     int
    Offset    int
    SortBy    string
    SortOrder string
}

type RelayListResponse struct {
    Relays []map[string]interface{} `json:"relays"`
    Total  int                      `json:"total"`
    Limit  int                      `json:"limit"`
    Offset int                      `json:"offset"`
}

func (c *Client) ListRelays(params ListRelaysParams) (*RelayListResponse, error) {
    u, err := url.Parse(c.BaseURL + "/relays")
    if err != nil {
        return nil, err
    }

    q := u.Query()
    if params.Limit > 0 {
        q.Set("limit", strconv.Itoa(params.Limit))
    }
    if params.Offset > 0 {
        q.Set("offset", strconv.Itoa(params.Offset))
    }
    if params.SortBy != "" {
        q.Set("sortBy", params.SortBy)
        q.Set("sortOrder", params.SortOrder)
    }
    u.RawQuery = q.Encode()

    resp, err := c.HTTPClient.Get(u.String())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("list relays failed: %s", resp.Status)
    }

    var result RelayListResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return &result, nil
}

type SearchFilter struct {
    NIPs       []int    `json:"nips,omitempty"`
    Network    []string `json:"network,omitempty"`
    Software   string   `json:"software,omitempty"`
    MinSupport float64  `json:"minSupport,omitempty"`
    MaxLatency int      `json:"maxLatency,omitempty"`
}

func (c *Client) SearchRelays(filter SearchFilter, limit, offset int) (*RelayListResponse, error) {
    payload := map[string]interface{}{
        "filter": filter,
        "limit":  limit,
        "offset": offset,
    }

    body, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    resp, err := c.HTTPClient.Post(
        c.BaseURL+"/relays/search",
        "application/json",
        bytes.NewReader(body),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("search failed: %s", resp.Status)
    }

    var result RelayListResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return &result, nil
}

// Usage example
func main() {
    client := NewClient("http://localhost:3000")

    // Health check
    health, err := client.HealthCheck()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Status: %s, Cache hit rate: %.2f%%\n",
        health.Status, health.Cache.HitRatePercent)

    // List relays
    relays, err := client.ListRelays(ListRelaysParams{
        Limit:     10,
        SortBy:    "uptime",
        SortOrder: "desc",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Found %d relays\n", relays.Total)

    // Search for NIP-42 relays
    results, err := client.SearchRelays(SearchFilter{
        NIPs:       []int{42},
        MinSupport: 0.8,
    }, 100, 0)
    if err != nil {
        panic(err)
    }
    fmt.Printf("NIP-42 relays: %d\n", len(results.Relays))
}
```

## Server-Sent Events

### JavaScript SSE Client

```javascript
// sse-client.js
class RelayVMSSEClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.eventSource = null;
    this.subscriptionId = null;
  }

  async subscribe(filter, onUpdate, onError) {
    // Create subscription
    const response = await fetch(`${this.baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${response.statusText}`);
    }

    const { subscriptionId } = await response.json();
    this.subscriptionId = subscriptionId;

    // Connect to SSE stream
    this.eventSource = new EventSource(
      `${this.baseUrl}/subscriptions/events?subscriptionId=${subscriptionId}`
    );

    this.eventSource.addEventListener('state-update', (event) => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    });

    this.eventSource.addEventListener('error', (event) => {
      if (onError) {
        onError(event);
      }
    });

    return subscriptionId;
  }

  async unsubscribe() {
    if (this.subscriptionId) {
      await fetch(`${this.baseUrl}/subscriptions/${this.subscriptionId}`, {
        method: 'DELETE',
      });
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.subscriptionId = null;
  }
}

// Usage example
async function watchRelays() {
  const client = new RelayVMSSEClient();

  try {
    const subscriptionId = await client.subscribe(
      {
        urls: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
      },
      (update) => {
        console.log('Relay state update:', update);
      },
      (error) => {
        console.error('SSE error:', error);
      }
    );

    console.log('Subscribed:', subscriptionId);

    // Unsubscribe after 60 seconds
    setTimeout(async () => {
      await client.unsubscribe();
      console.log('Unsubscribed');
    }, 60000);
  } catch (err) {
    console.error('Subscription failed:', err);
  }
}
```

### Python SSE Client

```python
# sse_client.py
import requests
import sseclient
import json

class RelayVMSSEClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.subscription_id = None

    def subscribe(self, filter_params, on_update):
        # Create subscription
        response = requests.post(
            f"{self.base_url}/subscriptions",
            json={"filter": filter_params}
        )
        response.raise_for_status()

        self.subscription_id = response.json()["subscriptionId"]

        # Connect to SSE stream
        sse_url = f"{self.base_url}/subscriptions/events?subscriptionId={self.subscription_id}"
        response = requests.get(sse_url, stream=True)

        client = sseclient.SSEClient(response)

        for event in client.events():
            if event.event == "state-update":
                data = json.loads(event.data)
                on_update(data)

    def unsubscribe(self):
        if self.subscription_id:
            requests.delete(f"{self.base_url}/subscriptions/{self.subscription_id}")
            self.subscription_id = None

# Usage
def handle_update(update):
    print(f"Relay update: {update}")

client = RelayVMSSEClient()
client.subscribe(
    {"urls": ["wss://relay.damus.io"]},
    handle_update
)
```

## MCP Examples

### Claude Desktop Configuration

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

### MCP Tool Usage (via Claude)

Example prompts for Claude Desktop:

```
Find all relays that support NIP-42 authentication

List the top 10 most reliable relays by uptime

Show me relays within 100km of San Francisco

Compare relay.damus.io and relay.nostr.band

What's the current cache hit rate?

Find all relays running strfry software

Show me offline relays that were recently seen
```

## Error Handling

### Handling HTTP Errors

```typescript
async function robustFetch(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, options);

    // Handle specific status codes
    switch (response.status) {
      case 200:
        return await response.json();

      case 404:
        throw new Error('Resource not found');

      case 429:
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`);

      case 400:
        const error = await response.json();
        throw new ValidationError(error.error.message);

      case 500:
      case 502:
      case 503:
        throw new ServerError('Server error occurred');

      default:
        throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new NetworkError('Network request failed');
    }
    throw err;
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

## Rate Limiting

### Respecting Rate Limits

```typescript
class RateLimitedClient {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;

  constructor(private baseUrl: string) {}

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;

      try {
        await request();
      } catch (err) {
        if (err instanceof RateLimitError) {
          // Re-queue the request
          this.requestQueue.unshift(request);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw err;
        }
      }
    }

    this.processing = false;
  }

  async enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      this.processQueue();
    });
  }
}

// Usage
const client = new RateLimitedClient('http://localhost:3000');

// These will be automatically queued and respect rate limits
const results = await Promise.all([
  client.enqueueRequest(() => fetch('/relays/1')),
  client.enqueueRequest(() => fetch('/relays/2')),
  client.enqueueRequest(() => fetch('/relays/3')),
]);
```

## Authentication

### Nostr Auth for Policy Updates

```typescript
import { SimplePool, finishEvent, getPublicKey } from 'nostr-tools';

async function updatePolicy(newPolicy: any, privateKey: string) {
  const publicKey = getPublicKey(privateKey);

  // Create auth event
  const authEvent = {
    kind: 27235, // NIP-98 HTTP Auth
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', 'http://localhost:3000/policy'],
      ['method', 'PUT'],
    ],
    content: '',
    pubkey: publicKey,
  };

  const signedEvent = finishEvent(authEvent, privateKey);
  const authHeader = `Nostr ${btoa(JSON.stringify(signedEvent))}`;

  // Update policy
  const response = await fetch('http://localhost:3000/policy', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(newPolicy),
  });

  if (!response.ok) {
    throw new Error(`Policy update failed: ${response.statusText}`);
  }

  return response.json();
}
```

## Summary

These examples cover the most common usage patterns for RelayVM's APIs. For more details:

- REST API: See [README.md](README.md#rest-api)
- Deployment: See [DEPLOYMENT.md](DEPLOYMENT.md)
- Monitoring: See [MONITORING.md](MONITORING.md)
