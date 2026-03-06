# CVM Tools Reference

Complete reference for all 21 MCP tools available through CVM.

## Relay Query Tools

### relays/list

Get a paginated list of all relays.

**Input:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Results per page |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `url` | Sort field: `url`, `updated`, `observationCount` |
| `sortOrder` | string | `asc` | Sort direction: `asc`, `desc` |
| `format` | string | `detailed` | Response format: `full`, `detailed`, `simple` |

**Output:** `{ relays, total, limit, offset }`

---

### relays/state

Get state for a specific relay.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrl` | string | Yes | The relay WebSocket URL |
| `format` | string | No | Response format: `full`, `detailed`, `simple` |

**Output:** `{ relay }` -- full relay state object or null if not found

---

### relays/search

Search relays with filters.

**Input:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `network` | string | -- | Filter: `clearnet`, `tor`, `i2p`, `hybrid` |
| `nips` | number[] | -- | Filter by supported NIPs |
| `software` | object | -- | Filter by `{ family, version }` |
| `labels` | object[] | -- | Filter by `[{ namespace, value }]` |
| `maxLatency` | object | -- | Max RTT: `{ open, read, write }` in ms |
| `minSupport` | number | -- | Minimum monitor support ratio (0-1) |
| `limit` | number | 100 | Results per page |
| `offset` | number | 0 | Pagination offset |
| `format` | string | `detailed` | Response format |

**Output:** `{ relays, total, limit, offset }`

## Geospatial Tools

### relays/nearby

Find relays near a geographic location.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | Yes | -- | Latitude (-90 to 90) |
| `lon` | number | Yes | -- | Longitude (-180 to 180) |
| `radius` | number | No | 100 | Search radius in km |
| `maxResults` | number | No | 50 | Maximum results |
| `format` | string | No | `detailed` | Response format |

**Output:** `{ relays, center: { lat, lon }, radius }` -- each relay includes a `distance` field in km

---

### relays/bbox

Find relays within a bounding box.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sw` | object | Yes | Southwest corner: `{ lat, lon }` |
| `ne` | object | Yes | Northeast corner: `{ lat, lon }` |
| `limit` | number | No | Max results (default 100) |
| `compact` | boolean | No | Legacy: return URLs only (default false) |

**Output:** `{ relays, bbox: { sw, ne }, total }`

## Label Tools

### relays/labels

Get labels for a specific relay.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrl` | string | Yes | The relay URL |
| `namespace` | string | No | Filter to a specific namespace |

**Output:** `{ relayUrl, labels }` -- labels is a `Record<namespace, values[]>`

---

### relays/labels/list

List all available labels across all relays.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `namespace` | string | No | Filter to a specific namespace |

**Output:** `{ namespaces, labels }` -- namespaces is a sorted string array, labels is `Record<namespace, values[]>`

---

### relays/by/label

Get relays that have a specific label.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `namespace` | string | Yes | -- | Label namespace (e.g. `country`, `isp`) |
| `value` | string | Yes | -- | Label value (e.g. `US`, `amazon`) |
| `limit` | number | No | 100 | Results per page |
| `offset` | number | No | 0 | Pagination offset |
| `format` | string | No | `detailed` | Response format |

**Output:** `{ relays, label: { namespace, value }, total }`

## Aggregation Tools

### relays/by/software

Group relays by software family.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `family` | string | No | Filter to a specific software family |

**Output:** `{ groups: [{ family, count, relays }] }`

---

### relays/by/network

Group relays by network type.

**Input:** None

**Output:** `{ groups: [{ network, count, relays }] }`

---

### relays/by/nip

Group relays by NIP support.

**Input:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `nip` | number | No | -- | Filter to a specific NIP |
| `minSupport` | number | No | 0.5 | Minimum support ratio |

**Output:** `{ groups: [{ nip, count, avgSupport, relays }] }`

---

### relays/by/country

Group relays by country.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `countryCode` | string | No | Filter to ISO 3166-1 alpha-2 code |

**Output:** `{ groups: [{ countryCode, countryName, count, relays }] }`

## Availability Tools

### relays/online

List relays considered online (recently responded to a check).

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `onlineWindowSeconds` | number | No | Override online window (default: max monitor frequency) |
| `filters` | object | No | `{ network, labels }` for filtering |
| `limit` | number | No | Results per page (default 100) |
| `offset` | number | No | Pagination offset |

**Output:** `{ relays, total, limit, offset }`

---

### relays/offline

List relays that are offline but not yet considered dead.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `offlineThresholdSeconds` | number | No | Seconds since last open to consider offline |
| `deadThresholdSeconds` | number | No | Seconds since last seen to consider dead (default: 7 days) |
| `filters` | object | No | `{ network, labels }` |
| `limit` | number | No | Results per page |
| `offset` | number | No | Pagination offset |

**Output:** `{ relays, total, limit, offset }`

---

### relays/dead

List relays considered dead (not seen for a long time).

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deadThresholdSeconds` | number | No | Override threshold |
| `filters` | object | No | `{ network, labels }` |
| `limit` | number | No | Results per page |
| `offset` | number | No | Pagination offset |

**Output:** `{ relays, total, limit, offset }`

---

### relays/compare

Compare multiple relays side-by-side.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrls` | string[] | Yes | 2-10 relay URLs to compare |

**Output:** `{ relays, comparison: { common: { nips, requirements }, differences: { network, software, latency } } }`

## Monitor Tools

### monitors/get

Get information about a specific monitor.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pubkey` | string | Yes | Monitor's hex pubkey |

**Output:** `{ monitor, analytics }` -- analytics includes reliability score and coverage data

---

### monitors/list

List all known monitors with reliability scores.

**Input:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Results per page |
| `offset` | number | 0 | Pagination offset |

**Output:** `{ monitors, total, analytics }` -- sorted by last seen (most recent first)

## System Tools

### health/ping

Check server health and version information.

**Input:** None

**Output:** `{ status, version, uptime, relayCount, observationCount, cache, timestamp }`

Status is `ok`, `degraded`, or `error` based on relay connectivity.

---

### policy/get

Get current aggregation policy configuration.

**Input:** None

**Output:** `{ policy }` -- includes quorum, labelQuorum, madScale, weights

---

### policy/set

Update aggregation policy (requires authorization).

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `policy` | object | Yes | Policy fields to update |

Policy fields: `windowStrategy`, `quorum`, `labelQuorum`, `madScale`, `weights: { recency, reliability }`

**Output:** `{ success, policy, message }`

## Subscription Tools

### relays/subscribe_state

Subscribe to relay state change notifications.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relayUrls` | string[] | No | Filter by specific relay URLs |
| `network` | string | No | Filter by network type |
| `nips` | number[] | No | Filter by required NIPs |
| `software` | object | No | Filter by software family/version |
| `labels` | object[] | No | Filter by labels |
| `geo` | object | No | Filter by area: `{ center: { lat, lon }, radius }` |
| `thresholds` | object | No | Change thresholds: `{ rttDeltaMs, supportDelta }` |

**Output:** `{ subscriptionId, message }`

---

### relays/unsubscribe

Cancel a state change subscription.

**Input:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscriptionId` | string | Yes | The subscription ID to cancel |

**Output:** `{ success, message }`
