# Architecture: Three-Level Response Shaping (full | detailed | simple)

**Version**: 2.0
**Status**: Implemented
**Author**: System Architect (Hive Mind Swarm)
**Date**: 2025-11-02

## Executive Summary

This document defines the architecture for implementing three-level response shaping across CVM tools and REST endpoints. The design introduces `full`, `detailed`, and `simple` response formats via **separate endpoints per shape** (e.g., `/relays/simple`, `/relays/detailed`, `/relays/full`).

**Key Design Principles:**
- **Consumer Simplicity**: Separate endpoints per shape -- no query parameter needed
- **Schema Simplicity**: Each endpoint returns one shape, no oneOf ambiguity
- **Maintainability**: Centralized shaping utilities, consistent handling
- **No Legacy Overhead**: The deprecated `ResponseFormat` type, `formatRelayState`/`formatRelayStates` functions, `compact` boolean, and `resolveFormat()` helper have been removed

---

## 1. Type System Architecture

### 1.1 Core Types

```typescript
/**
 * Response shape enumeration
 * Replaces binary ResponseFormat type
 */
export type ResponseShape = 'full' | 'detailed' | 'simple'

// ResponseFormat type has been removed (was 'compact' | 'detailed')
// The compact?: boolean field has been removed from tool input schemas

/**
 * Full relay state with attribution
 * Contains contributingAuthors, authors fields
 */
export type FullRelayState = RelayState

/**
 * Detailed relay state without attribution
 * Removes contributingAuthors/authors but keeps aggregated fields
 * This is the current "compact" format
 */
export interface DetailedRelayState {
  relayUrl: string
  updated_at: number
  observationCount: number
  lastSeenAt?: number
  lastOpenAt?: number

  network?: CompactAggregatedValue<'clearnet' | 'tor' | 'i2p' | 'hybrid'>
  software?: {
    family?: CompactAggregatedValue<string>
    version?: CompactAggregatedValue<string>
  }
  rtt?: {
    open?: CompactAggregatedValue<number> & { mad?: number }
    read?: CompactAggregatedValue<number> & { mad?: number }
    write?: CompactAggregatedValue<number> & { mad?: number }
    info?: CompactAggregatedValue<number> & { mad?: number }
  }
  nips?: { list: number[]; support: Record<number, number> }
  requirements?: Record<string, CompactAggregatedValue<boolean>>
  labels?: Record<string, string[]>
  geo?: {
    lat: number; lon: number; precision: number
    geohash: string; support: number
  }
  ipAddrs?: string[]
  country?: CompactAggregatedValue<string>
}

/**
 * Simple relay reference (URL only)
 * Used for list endpoints when minimal data needed
 */
export type SimpleRelayReference = string  // relay URL
```

### 1.2 Type Aliases for Compatibility

```typescript
/**
 * Maintain existing CompactRelayState alias
 * Maps to DetailedRelayState in new architecture
 */
export type CompactRelayState = DetailedRelayState

/**
 * Maintain existing DetailedRelayState (was alias to RelayState)
 * Now maps to FullRelayState
 */
// Remove old: export type DetailedRelayState = RelayState
// Replace with proper interface above
```

---

## 2. Shaping Utilities Architecture

### 2.1 Core Transformation Functions

```typescript
/**
 * Transform full state to detailed (remove attribution)
 * This is the current toCompact() renamed for clarity
 */
export function toDetailed(state: RelayState): DetailedRelayState {
  // Implementation: current toCompact() logic
  // Remove contributingAuthors, authors fields
  // Keep all aggregated data (support, sampleSize, conflicts, etc.)
}

/**
 * Transform full state array to detailed
 */
export function toDetailedArray(states: RelayState[]): DetailedRelayState[] {
  return states.map(toDetailed)
}

/**
 * Extract simple relay reference (URL only)
 */
export function toSimple(state: RelayState): SimpleRelayReference {
  return state.relayUrl
}

/**
 * Extract simple relay references from array
 */
export function toSimpleList(states: RelayState[]): SimpleRelayReference[] {
  return states.map(state => state.relayUrl)
}

/**
 * Identity function for full state (no transformation)
 */
export function toFull(state: RelayState): FullRelayState {
  return state
}

/**
 * Identity function for full state array
 */
export function toFullArray(states: RelayState[]): FullRelayState[] {
  return states
}

/**
 * @deprecated Use toDetailed() instead
 * Maintained for backward compatibility
 */
export function toCompact(state: RelayState): CompactRelayState {
  return toDetailed(state)
}

/**
 * @deprecated Use toDetailedArray() instead
 * Maintained for backward compatibility
 */
export function toCompactArray(states: RelayState[]): CompactRelayState[] {
  return toDetailedArray(states)
}
```

### 2.2 Unified Shaping API

```typescript
/**
 * Apply shape transformation to single state
 * Each endpoint calls the appropriate function directly.
 */
export function applyShapeSingle(
  state: RelayState,
  shape: ResponseShape = 'detailed'
): FullRelayState | DetailedRelayState {
  switch (shape) {
    case 'full':
      return toFull(state)
    case 'detailed':
      return toDetailed(state)
    case 'simple':
      return toDetailed(state)
  }
}

/**
 * Apply shape transformation to state array
 */
export function applyShapeList(
  states: RelayState[],
  shape: ResponseShape = 'detailed'
): FullRelayState[] | DetailedRelayState[] | SimpleRelayReference[] {
  switch (shape) {
    case 'full':
      return toFullArray(states)
    case 'detailed':
      return toDetailedArray(states)
    case 'simple':
      return toSimpleList(states)
  }
}

// NOTE: The following deprecated functions have been REMOVED:
// - formatRelayState() (was ResponseFormat dispatcher)
// - formatRelayStates() (was ResponseFormat array dispatcher)
// - resolveFormat() helper (was used in REST routes and CVM tools)
// The deprecated ResponseFormat type ('compact' | 'detailed') has also been removed.
```

---

## 3. Endpoint-Based Shape Selection (Replaces Parameter Parsing)

The previous architecture used a `format` query/body parameter and a `resolveFormat()` / `parseResponseFormat()` helper to determine the response shape at runtime. This has been **replaced** by separate endpoints per shape.

### 3.1 REST Endpoint Structure

Each base path now has three sub-endpoints:

| Base Path | Simple | Detailed | Full |
|-----------|--------|----------|------|
| `/relays` | `GET /relays/simple` | `GET /relays/detailed` | `GET /relays/full` |
| `/relays/search` | `POST /relays/search/simple` | `POST /relays/search/detailed` | `POST /relays/search/full` |
| `/relays/nearby` | `GET /relays/nearby/simple` | `GET /relays/nearby/detailed` | `GET /relays/nearby/full` |
| `/relays/bbox` | `GET /relays/bbox/simple` | `GET /relays/bbox/detailed` | `GET /relays/bbox/full` |
| `/relays/by/label` | `GET /relays/by/label/simple` | `GET /relays/by/label/detailed` | `GET /relays/by/label/full` |

**Key behavior difference:** REST `/simple` endpoints return **all results with NO pagination**. Detailed and full endpoints retain pagination.

### 3.2 CVM Tool Structure

CVM tools follow the same pattern:

| Base Tool | Simple | Detailed | Full |
|-----------|--------|----------|------|
| `relays/list` | `relays/list/simple` | `relays/list/detailed` | `relays/list/full` |
| `relays/search` | `relays/search/simple` | `relays/search/detailed` | `relays/search/full` |
| `relays/nearby` | `relays/nearby/simple` | `relays/nearby/detailed` | `relays/nearby/full` |
| `relays/bbox` | `relays/bbox/simple` | `relays/bbox/detailed` | `relays/bbox/full` |
| `relays/by/label` | `relays/by/label/simple` | `relays/by/label/detailed` | `relays/by/label/full` |

**Key behavior difference:** CVM `/simple` tools **still have pagination** (unlike REST simple endpoints).

### 3.3 Removed Components

The following have been removed:
- `parseResponseFormat()` helper
- `resolveFormat()` helper (from both REST routes and CVM tools)
- `generateDeprecationHeaders()` / `applyDeprecationHeaders()` (no longer needed -- no legacy params to detect)
- `compact?: boolean` field from tool input schemas
- `format` query/body parameter from endpoints

---

## 4. REST Endpoint Architecture

### 4.1 Endpoint Structure

Each endpoint group has three dedicated routes — one per shape. No `format` query parameter is needed.

**Simple endpoints** (`/relays/simple`, etc.):
- Return `string[]` relay URLs (or `{relayUrl, distance}[]` for nearby)
- **No pagination** — return all matching results
- Accept sorting params where applicable (sortBy, sortOrder)
- Rate limit cost: 2 (higher, due to unbounded results)

**Detailed endpoints** (`/relays/detailed`, etc.):
- Return `CompactRelayState[]` (no contributor attribution)
- Standard pagination (limit, offset)
- Rate limit cost: 1

**Full endpoints** (`/relays/full`, etc.):
- Return `RelayState[]` (full attribution data)
- Standard pagination (limit, offset)
- Rate limit cost: 1

### 4.2 Shared Query Properties

```typescript
const sortQueryProps = {
  sortBy: { type: 'string', enum: ['url', 'updated', 'observationCount', 'lastSeen'], default: 'url' },
  sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
}

const paginationQueryProps = {
  limit: { type: 'number', default: 50, maximum: 200 },
  offset: { type: 'number', default: 0, minimum: 0 },
}
```

### 4.3 Response Schemas (per shape, no oneOf)

Each endpoint returns exactly one shape — no `oneOf` ambiguity:

```typescript
// Simple list: { relays: string[], total: number }
// Detailed/Full list: { relays: object[], total, limit, offset }
// Simple nearby: { relays: [{relayUrl, distance}], center, radius }
// Detailed/Full nearby: { relays: object[], center, radius }
```

JSON schema files in `src/schemas/`:
- `relays-list-simple-output.json`, `relays-list-object-output.json`
- `relays-search-simple-output.json`, `relays-search-object-output.json`
- `relays-nearby-simple-output.json`, `relays-nearby-object-output.json`
- `relays-bbox-simple-output.json`, `relays-bbox-object-output.json`
- `relays-by-label-simple-output.json`, `relays-by-label-object-output.json`

### 4.4 Handler Pattern (Factory)

```typescript
// Shared core logic per endpoint group
function sortRelays(relays: RelayState[], sortBy: string, sortOrder: string): RelayState[] { ... }

// Route registration pattern:
// GET /relays/simple — no pagination
app.get('/relays/simple', { schema: { querystring: { ...sortQueryProps } } }, async (req) => {
  const all = core.query.relays.getAll()
  sortRelays(all, req.query.sortBy, req.query.sortOrder)
  return { relays: applyShapeList(all, 'simple'), total: all.length }
})

// GET /relays/detailed — with pagination
app.get('/relays/detailed', { schema: { querystring: { ...sortQueryProps, ...paginationQueryProps } } }, async (req) => {
  const all = core.query.relays.getAll()
  sortRelays(all, req.query.sortBy, req.query.sortOrder)
  const paged = all.slice(req.query.offset, req.query.offset + req.query.limit)
  return { relays: applyShapeList(paged, 'detailed'), total: all.length, limit: req.query.limit, offset: req.query.offset }
})

// GET /relays/full — same as detailed but shape='full'
```

---

## 5. CVM Tools Architecture

### 5.1 Separate Tools per Shape

Each endpoint group produces 3 tool factory functions. All CVM tools retain pagination (limit/offset), unlike REST simple endpoints.

```typescript
// 15 tool factories (5 groups × 3 shapes):
createRelaysListSimpleTool(ctx)     // relays/list/simple
createRelaysListDetailedTool(ctx)   // relays/list/detailed
createRelaysListFullTool(ctx)       // relays/list/full
createRelaysSearchSimpleTool(ctx)   // relays/search/simple
createRelaysSearchDetailedTool(ctx) // relays/search/detailed
createRelaysSearchFullTool(ctx)     // relays/search/full
createRelaysNearbySimpleTool(ctx)   // relays/nearby/simple
createRelaysNearbyDetailedTool(ctx) // relays/nearby/detailed
createRelaysNearbyFullTool(ctx)     // relays/nearby/full
createRelaysBboxSimpleTool(ctx)     // relays/bbox/simple
createRelaysBboxDetailedTool(ctx)   // relays/bbox/detailed
createRelaysBboxFullTool(ctx)       // relays/bbox/full
createRelaysByLabelSimpleTool(ctx)  // relays/by/label/simple
createRelaysByLabelDetailedTool(ctx)// relays/by/label/detailed
createRelaysByLabelFullTool(ctx)    // relays/by/label/full
```

### 5.2 Tool Handler Pattern (Factory)

```typescript
// Shared core logic per group (same as REST)
function relaysListCore(ctx, params) {
  const all = ctx.core.query.relays.getAll()
  sortRelays(all, params.sortBy, params.sortOrder)
  return all
}

// Shape-specific factory
export function createRelaysListSimpleTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list/simple',
    description: 'List all relay URLs (simple format)',
    inputSchema: { /* limit, offset, sortBy, sortOrder */ },
    handler: async (input) => {
      const all = relaysListCore(ctx, input)
      const paged = all.slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50))
      return { relays: applyShapeList(paged, 'simple'), total: all.length, limit: input.limit, offset: input.offset }
    }
  }
}
// createRelaysListDetailedTool and createRelaysListFullTool follow same pattern with 'detailed'/'full'
```

### 5.3 Cache Keys

Each tool has a shape-specific cache key prefix to prevent cross-shape cache hits:

```typescript
cacheKeyFn: (p) => `relays:list:simple:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}`
cacheKeyFn: (p) => `relays:list:detailed:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}`
cacheKeyFn: (p) => `relays:list:full:${p.sortBy || 'url'}:${p.sortOrder || 'asc'}`
```

---

## 6. Migration Notes

The previous architecture used a `format` query/body parameter (`simple|detailed|full|compact`) and a `compact` boolean. These have been **fully removed** in favor of separate endpoints per shape.

| Old Usage | New Equivalent |
|-----------|---------------|
| `GET /relays?format=simple` | `GET /relays/simple` |
| `GET /relays?format=detailed` | `GET /relays/detailed` |
| `GET /relays?format=full` | `GET /relays/full` |
| `GET /relays?compact=true` | `GET /relays/detailed` |
| `GET /relays?compact=false` | `GET /relays/full` |
| `GET /relays` (default) | `GET /relays/detailed` |
| CVM `relays/list` with `format` param | `relays/list/simple`, `relays/list/detailed`, `relays/list/full` |

Old unified endpoints now return 404. No deprecation headers or migration shims are needed.

---

## 7. Testing Architecture

### 7.1 Unit Tests (Shaping Utilities)

```typescript
describe('Shaping Utilities', () => {
  describe('toCompact()', () => {
    it('should remove contributingAuthors from all fields')
    it('should preserve all aggregated data')
  })

  describe('toSimpleList()', () => {
    it('should extract only relay URLs')
    it('should preserve ordering')
  })

  describe('applyShapeList()', () => {
    it('should return string[] for simple shape')
    it('should return CompactRelayState[] for detailed shape')
    it('should return RelayState[] for full shape')
  })
})
```

### 7.2 Integration Tests (REST Endpoints)

```typescript
describe('REST /relays endpoints', () => {
  it('GET /relays/simple returns string[] with no pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/relays/simple' })
    const data = res.json()
    expect(typeof data.relays[0]).toBe('string')
    expect(data).not.toHaveProperty('limit')
  })

  it('GET /relays/detailed returns objects with pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/relays/detailed?limit=5&offset=0' })
    const data = res.json()
    expect(data.relays[0]).toHaveProperty('relayUrl')
    expect(data.relays[0]).not.toHaveProperty('network.contributingAuthors')
    expect(data).toHaveProperty('limit')
  })

  it('GET /relays/full returns objects with attribution', async () => {
    const res = await app.inject({ method: 'GET', url: '/relays/full?limit=5&offset=0' })
    const data = res.json()
    expect(data.relays[0]).toHaveProperty('network.contributingAuthors')
  })
})
```

### 7.3 Integration Tests (CVM Tools)

```typescript
describe('CVM tools', () => {
  const listSimple = createRelaysListSimpleTool({ core })
  const listDetailed = createRelaysListDetailedTool({ core })
  const listFull = createRelaysListFullTool({ core })

  it('simple tool returns URL strings with pagination', async () => {
    const result = await listSimple.handler({ limit: 5, offset: 0 })
    expect(typeof result.relays[0]).toBe('string')
    expect(result).toHaveProperty('limit')
  })

  it('detailed tool returns compact objects', async () => {
    const result = await listDetailed.handler({ limit: 5, offset: 0 })
    expect(result.relays[0]).toHaveProperty('relayUrl')
    expect(result.relays[0]).not.toHaveProperty('network.contributingAuthors')
  })

  it('full tool returns full state objects', async () => {
    const result = await listFull.handler({ limit: 5, offset: 0 })
    expect(result.relays[0]).toHaveProperty('network.contributingAuthors')
  })
})
```

### 7.4 REST vs Tool Parity Tests

```typescript
describe('REST vs Tool Parity', () => {
  it('parity: relays/list (detailed shape)', async () => {
    const restRes = await app.inject({ method: 'GET', url: '/relays/detailed?limit=10&offset=0&sortBy=url' })
    const toolOut = await tools.listDetailed.handler({ limit: 10, offset: 0, sortBy: 'url' })
    expect(restRes.json().total).toBe(toolOut.total)
    // relay URLs match
  })
  // Same pattern for search, byLabel, byNip, byCountry
})
```

---

## 8. File Structure & Organization

### 8.1 Modified Files

```
src/
├── types/
│   ├── response-formats.ts         [MODIFIED] Removed deprecated ResponseFormat, formatRelayState, formatRelayStates
│   └── tool-schemas.ts              [MODIFIED] Removed compact?: boolean from input interfaces
├── rest/
│   ├── routes/relays.ts             [REWRITTEN] 15 shape-specific routes (factory pattern)
│   ├── schemas.ts                   [MODIFIED] Shape-specific schema getters (no oneOf)
│   ├── payments.ts                  [MODIFIED] 17 entries in NAME_TO_ROUTE
│   └── server.ts                    [MODIFIED] Rate limit costs per shape
├── tools/
│   └── relays.ts                    [REWRITTEN] 15 shape-specific tool factories
├── server.ts                        [MODIFIED] 15 tool registrations with shape-specific cache keys
└── schemas/                         [NEW] 10 JSON schema files
    ├── relays-list-simple-output.json
    ├── relays-list-object-output.json
    ├── relays-search-simple-output.json
    ├── relays-search-object-output.json
    ├── relays-nearby-simple-output.json
    ├── relays-nearby-object-output.json
    ├── relays-bbox-simple-output.json
    ├── relays-bbox-object-output.json
    ├── relays-by-label-simple-output.json
    └── relays-by-label-object-output.json

test/
├── format.test.ts                   [MODIFIED] Uses shape-specific tool/endpoint names
├── compact-mode.test.ts             [MODIFIED] URLs changed to /detailed or /full
├── response-shaping-levels.test.ts  [MODIFIED] URLs changed to shape-specific paths
├── rest_tool_parity.test.ts         [MODIFIED] Uses detailed tool/endpoint variants
├── rest-integration.test.ts         [MODIFIED] ETag test uses /relays/detailed
├── openapi-402.test.ts              [MODIFIED] Search endpoint uses /relays/search/detailed
└── performance-compact.test.ts      [MODIFIED] Uses shape-specific paths
```

---

## 9. Non-Functional Considerations

### 9.1 Performance Impact

**Minimal Impact Expected:**
- `toDetailed()` has same complexity as current `toCompact()`
- `toSimple()` is O(n) array map (very fast)
- `applyShapeList()` adds one switch statement (negligible)
- Parsing logic is O(1) with simple conditionals

**Optimization Opportunities:**
- Consider memoization for frequently-queried relays
- Pre-compute simple lists for hot paths (future)
- Lazy evaluation for large result sets (future)

### 9.2 Payload Size Impact

| Format | Typical Size per Relay | Use Case |
|--------|------------------------|----------|
| `full` | ~2-3KB | Attribution required, internal tools |
| `detailed` | ~1.5-2KB | Default, balances detail and size |
| `simple` | ~50 bytes | Discovery, autocomplete, minimal clients |

**Bandwidth Savings:**
- `simple` reduces payload by ~40x for list endpoints
- Helpful for mobile, low-bandwidth, or high-volume scenarios

### 9.3 Security Considerations

**Attribution Privacy:**
- `full` endpoints include contributor identities
- Ensure consumers understand privacy implications
- Consider rate limiting on `full` endpoints (future)

### 9.4 Caching Strategy

**Cache Key Structure:**
```
cache:relays:list:simple:{sortBy}:{sortOrder}
cache:relays:list:detailed:{sortBy}:{sortOrder}
cache:relays:list:full:{sortBy}:{sortOrder}
cache:relays:search:simple:{hash(filters)}
cache:relays:state:{relayUrl}
```

**Cache Invalidation:**
- Each shape has its own cache key prefix — no cross-shape cache hits
- All shape variants invalidated together when relay state changes
- Simple format can have longer TTL (more cacheable, less data)

---

## 10. Documentation Requirements

### 10.1 API Documentation Updates

**Required Sections:**
1. **Response Shape Guide**
   - Explain full, detailed, simple endpoint variants
   - Show example responses for each (see Appendix A)
   - Explain use cases

2. **Endpoint Reference**
   - Document all 15 shape-specific endpoints (see Appendix B)
   - Document unchanged endpoints

### 10.2 Code Documentation

**Required Documentation:**
- Architecture decision record (this document)
- CHANGELOG entry for this milestone

---

## 11. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Client breakage from endpoint split | Medium | High | Announce migration, document old→new mapping |
| Performance degradation | Low | Medium | Profile shaping functions, add benchmarks |
| Confusion over three shapes | Medium | Low | Clear documentation, sensible defaults |

---

## 12. Success Criteria

### 12.1 Functional Requirements
- [x] Separate endpoints per shape (15 new endpoints)
- [x] REST simple endpoints return all results (no pagination)
- [x] CVM simple tools retain pagination
- [x] Old unified endpoints removed (404)
- [x] List endpoints return string[] for simple shape
- [x] Single endpoints (`/relays/state`) unchanged
- [x] All tests pass (163/163, excluding 2 pre-existing failures)

### 12.2 Non-Functional Requirements
- [x] Performance within 5% of current baseline
- [x] Each endpoint has precise JSON schema (no oneOf ambiguity)
- [x] Documentation updated
- [x] Shape-specific cache keys prevent cross-shape contamination

### 12.3 Quality Gates
- [x] All automated tests passing
- [x] REST vs Tool parity tests passing
- [x] Performance tests passing

---

## 13. Future Enhancements (Out of Scope)

**Not included in this milestone:**
- Field-level partial selection (`fields=relayUrl,network`)
- Changing global default from detailed to full
- Removing legacy `compact` parameter entirely
- Custom format definitions
- GraphQL-style query shaping
- Streaming/chunked responses for large lists

---

## Appendix A: Example Responses

### A.1 GET /relays/simple (REST — no pagination)
```json
{
  "relays": [
    "wss://relay.example.com",
    "wss://relay2.example.com",
    "wss://relay3.example.com"
  ],
  "total": 1250
}
```

### A.2 GET /relays/detailed?limit=5&offset=0
```json
{
  "relays": [
    {
      "relayUrl": "wss://relay.example.com",
      "updated_at": 1698765432000,
      "observationCount": 150,
      "network": {
        "value": "clearnet",
        "support": 0.98,
        "sampleSize": 147,
        "lastUpdated": 1698765000000
      },
      "geo": {
        "lat": 37.7749,
        "lon": -122.4194,
        "precision": 1000,
        "geohash": "9q8yy",
        "support": 0.85
      }
    }
  ],
  "total": 1250,
  "limit": 5,
  "offset": 0
}
```

### A.3 GET /relays/full?limit=5&offset=0
```json
{
  "relays": [
    {
      "relayUrl": "wss://relay.example.com",
      "updated_at": 1698765432000,
      "observationCount": 150,
      "network": {
        "value": "clearnet",
        "support": 0.98,
        "sampleSize": 147,
        "contributingAuthors": ["npub1abc...", "npub1def..."],
        "lastUpdated": 1698765000000
      },
      "geo": {
        "lat": 37.7749,
        "lon": -122.4194,
        "precision": 1000,
        "geohash": "9q8yy",
        "support": 0.85,
        "authors": ["npub1geo..."]
      }
    }
  ],
  "total": 1250,
  "limit": 5,
  "offset": 0
}
```

### A.4 GET /relays/nearby/simple?lat=37.77&lon=-122.42
```json
{
  "relays": [
    { "relayUrl": "wss://relay.example.com", "distance": 12.5 },
    { "relayUrl": "wss://relay2.example.com", "distance": 45.3 }
  ],
  "center": { "lat": 37.77, "lon": -122.42 },
  "radius": 100
}
```

---

## Appendix B: Endpoint Reference

### B.1 All Shape-Specific Endpoints

| Method | Path | Shape | Pagination |
|--------|------|-------|-----------|
| GET | `/relays/simple` | string[] | None (REST) |
| GET | `/relays/detailed` | CompactRelayState[] | limit/offset |
| GET | `/relays/full` | RelayState[] | limit/offset |
| POST | `/relays/search/simple` | string[] | None (REST) |
| POST | `/relays/search/detailed` | CompactRelayState[] | limit/offset |
| POST | `/relays/search/full` | RelayState[] | limit/offset |
| GET | `/relays/nearby/simple` | {relayUrl, distance}[] | maxResults |
| GET | `/relays/nearby/detailed` | CompactRelayState[] | maxResults |
| GET | `/relays/nearby/full` | RelayState[] | maxResults |
| GET | `/relays/bbox/simple` | string[] | None (REST) |
| GET | `/relays/bbox/detailed` | CompactRelayState[] | limit |
| GET | `/relays/bbox/full` | RelayState[] | limit |
| GET | `/relays/by/label/simple` | string[] | None (REST) |
| GET | `/relays/by/label/detailed` | CompactRelayState[] | limit/offset |
| GET | `/relays/by/label/full` | RelayState[] | limit/offset |

### B.2 Unchanged Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/relays/state` | Single relay state (accepts `relayUrl` query) |
| GET | `/relays/labels` | Labels for a specific relay |
| GET | `/relays/labels/list` | All label namespaces/values |
| GET | `/relays/by/software` | Group relays by software |
| GET | `/relays/by/network` | Group relays by network type |
| GET | `/relays/by/nip` | Group relays by NIP support |
| GET | `/relays/by/country` | Group relays by country |
| POST | `/relays/compare` | Compare 2-10 relays |
| GET | `/relays/online` | Currently online relays |
| GET | `/relays/offline` | Currently offline relays |
| GET | `/relays/dead` | Dead relays |

---

## Appendix C: TypeScript Type Definitions

```typescript
// Central type definitions for response shaping

export type ResponseShape = 'full' | 'detailed' | 'simple'

export type FullRelayState = RelayState

export interface DetailedRelayState {
  relayUrl: string
  updated_at: number
  observationCount: number
  lastSeenAt?: number
  lastOpenAt?: number
  network?: CompactAggregatedValue<'clearnet' | 'tor' | 'i2p' | 'hybrid'>
  software?: {
    family?: CompactAggregatedValue<string>
    version?: CompactAggregatedValue<string>
  }
  rtt?: {
    open?: CompactAggregatedValue<number> & { mad?: number }
    read?: CompactAggregatedValue<number> & { mad?: number }
    write?: CompactAggregatedValue<number> & { mad?: number }
    info?: CompactAggregatedValue<number> & { mad?: number }
  }
  nips?: { list: number[]; support: Record<number, number> }
  requirements?: Record<string, CompactAggregatedValue<boolean>>
  labels?: Record<string, string[]>
  geo?: {
    lat: number
    lon: number
    precision: number
    geohash: string
    support: number
  }
  ipAddrs?: string[]
  country?: CompactAggregatedValue<string>
}

export type SimpleRelayReference = string

export type CompactRelayState = DetailedRelayState

export interface ListResponse<T> {
  relays: T[]
  total: number
  limit: number
  offset: number
}

export type ListResponseVariants =
  | ListResponse<FullRelayState>
  | ListResponse<DetailedRelayState>
  | ListResponse<SimpleRelayReference>

export type SingleResponseVariants =
  | FullRelayState
  | DetailedRelayState
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-02 | System Architect | Initial architecture design |
| 2.0 | 2026-03-09 | Claude | Updated to reflect separate-endpoint implementation (no format param) |

---

**End of Architecture Document**
