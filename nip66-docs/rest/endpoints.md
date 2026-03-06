# Endpoint Reference

Complete reference for all REST API endpoints. All endpoints return JSON. All paths are relative to the base URL `https://api.nostr.watch/v2`.

You can also explore and test these endpoints interactively via the [OpenAPI sandbox](https://api.nostr.watch/v2/).

## Health

### GET /health/ping

Server health check with cache and connectivity stats.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "relayCount": { "transport": 2, "ingestion": 3 },
  "observationCount": 15420,
  "cache": {
    "size": 1523,
    "maxSize": 10000,
    "hitRate": 0.85,
    "hitRatePercent": 85
  },
  "timestamp": 1709740800000
}
```

Status values: `ok` (all connections healthy), `degraded` (partial connectivity), `error` (no connections).

## Relay Endpoints

### GET /relays

List all relays with pagination and sorting.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Results per page (max 200) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `url` | Sort by: `url`, `updated`, `observationCount`, `lastSeen` |
| `sortOrder` | string | `asc` | `asc` or `desc` |
| `format` | string | `detailed` | `full`, `detailed`, or `simple` |

**Response:** `{ relays: [], total, limit, offset }`

---

### GET /relays/state

Get state for a specific relay.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrl` | string | Yes | Relay WebSocket URL (URL-encoded) |
| `format` | string | No | `full`, `detailed`, or `simple` |

**Response:** `{ relay: {} }` or 404 with `{ error: { code: "RELAY_NOT_FOUND", message } }`

---

### POST /relays/search

Search relays with complex filters.

**Request Body:**
```json
{
  "network": "clearnet",
  "nips": [1, 42],
  "software": { "family": "strfry", "version": "1.0.0" },
  "labels": [{ "namespace": "country", "value": "US" }],
  "maxLatency": { "open": 200, "read": 150, "write": 150 },
  "minSupport": 0.7,
  "limit": 100,
  "offset": 0,
  "format": "detailed"
}
```

All filter fields are optional. Only relays matching **all** provided filters are returned.

**Response:** `{ relays: [], total, limit, offset }`

---

### GET /relays/nearby

Find relays near a geographic point.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | Yes | -- | Latitude (-90 to 90) |
| `lon` | number | Yes | -- | Longitude (-180 to 180) |
| `radius` | number | No | 100 | Radius in km |
| `format` | string | No | `detailed` | Response format |

**Response:** `{ relays: [], center: { lat, lon }, radius }`

---

### GET /relays/bbox

Find relays within a bounding box.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sw.lat` | number | Yes | Southwest latitude |
| `sw.lon` | number | Yes | Southwest longitude |
| `ne.lat` | number | Yes | Northeast latitude |
| `ne.lon` | number | Yes | Northeast longitude |
| `format` | string | No | Response format |

**Response:** `{ relays: [], bbox: { sw, ne }, total }`

## Label Endpoints

### GET /relays/labels

Get labels for a specific relay.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrl` | string | Yes | Relay URL |
| `namespace` | string | No | Filter to a specific namespace |

**Response:** `{ labels: { namespace: [values] } }`

---

### GET /relays/labels/list

List all available labels.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | No | Filter to a specific namespace |

**Response:** `{ namespaces: [], labels: { namespace: [values] } }`

---

### GET /relays/by/label

Find relays with a specific label.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `namespace` | string | Yes | -- | e.g. `country`, `isp` |
| `value` | string | Yes | -- | e.g. `US`, `amazon` |
| `limit` | number | No | 100 | Max results (max 200) |
| `offset` | number | No | 0 | Pagination offset |
| `format` | string | No | `detailed` | Response format |

**Response:** `{ relays: [], label: { namespace, value }, total }`

## Aggregation Endpoints

### GET /relays/by/software

Group relays by software family.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `family` | string | No | Filter to a specific software family |

**Response (no filter):** `{ groups: { family: [relayUrls] } }`

**Response (with filter):** `{ relays: [relayUrls], total }`

---

### GET /relays/by/network

Group relays by network type.

**Response:** `{ groups: [{ network, count, relays }] }`

---

### GET /relays/by/nip

Group relays by NIP support.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `nip` | number | No | -- | Filter to a specific NIP |
| `minSupport` | number | No | 0.5 | Minimum support ratio (0-1) |

**Response:** `{ groups: [{ nip, count, avgSupport, relays }] }`

---

### GET /relays/by/country

Group relays by country.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `countryCode` | string | No | ISO 3166-1 alpha-2 code (e.g. `US`) |

**Response:** `{ groups: [{ countryCode, countryName, count, relays }] }`

## Comparison

### POST /relays/compare

Compare multiple relays side-by-side.

**Request Body:**
```json
{
  "relayUrls": [
    "wss://relay.damus.io",
    "wss://relay.nostr.band"
  ]
}
```

1-10 relay URLs.

**Response:**
```json
{
  "relays": [ /* full relay state objects */ ],
  "comparison": {
    "common": {
      "nips": [1, 11, 42],
      "requirements": ["!auth"]
    },
    "differences": {
      "network": false,
      "software": true,
      "latency": true
    }
  }
}
```

## Availability Endpoints

### POST /relays/online

Get currently online relays.

**Request Body:**
```json
{
  "onlineWindowSeconds": 7200,
  "network": "clearnet",
  "labels": [{ "namespace": "country", "value": "US" }]
}
```

All fields optional. Default window derived from max monitor frequency.

**Response:** `{ relays: [], total }`

---

### POST /relays/offline

Get relays that are offline but not yet dead.

**Request Body:**
```json
{
  "offlineThresholdSeconds": 7200,
  "deadThresholdSeconds": 604800,
  "network": "clearnet",
  "labels": []
}
```

All fields optional.

**Response:** `{ relays: [], total }`

---

### POST /relays/dead

Get probably dead relays.

**Request Body:**
```json
{
  "deadThresholdSeconds": 604800,
  "network": "clearnet",
  "labels": []
}
```

All fields optional. Default dead threshold is 7 days.

**Response:** `{ relays: [], total }`

## Monitor Endpoints

### GET /monitors

List all known monitors with reliability scores.

**Response:** `{ monitors: [], total, analytics: [] }`

---

### GET /monitors/:pubkey

Get a specific monitor.

**Response:** `{ monitor, analytics }`

---

### GET /monitors/:pubkey/analytics

Get analytics for a specific monitor.

---

### GET /monitors/analytics

Get analytics for all monitors.

## Policy Endpoints

### GET /policy

Get current aggregation policy.

**Response:** `{ policy: { quorum, labelQuorum, madScale, weights } }`

---

### PUT /policy

Update aggregation policy. Requires Nostr authentication (NIP-98).

**Headers:** `Authorization: Nostr <base64-encoded-signed-event>`

**Request Body:**
```json
{
  "quorum": 0.6,
  "labelQuorum": 0.4
}
```

**Response:** `{ success, policy, message }`
