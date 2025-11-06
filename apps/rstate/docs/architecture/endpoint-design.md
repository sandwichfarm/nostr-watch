# Endpoint Architecture Design: Compact-First Response Pattern

## Executive Summary

This document defines the architectural design for implementing a dual-endpoint pattern where compact responses are the default, with explicit `/detailed` endpoints for verbose data. This approach optimizes bandwidth usage, improves latency, and aligns with 402.markets monetization requirements while maintaining backward compatibility.

## 1. URL Structure Design

### 1.1 Pattern Definition

**Primary Pattern:**
- **Compact (Default):** `/relays` → Returns minimal, array-based responses
- **Detailed (Explicit):** `/relays/detailed` → Returns verbose responses with full metadata

**Applied Consistently Across All Endpoints:**

```
# List Operations
GET  /relays                    → Compact list
GET  /relays/detailed           → Detailed list

# Single Resource
GET  /relays/state              → Compact single relay
GET  /relays/state/detailed     → Detailed single relay

# Search Operations
POST /relays/search             → Compact search results
POST /relays/search/detailed    → Detailed search results

# Geographic Queries
GET  /relays/nearby             → Compact nearby relays
GET  /relays/nearby/detailed    → Detailed nearby relays

GET  /relays/bbox               → Compact bounding box results
GET  /relays/bbox/detailed      → Detailed bounding box results

# Grouping Operations
GET  /relays/by/label           → Compact label results
GET  /relays/by/label/detailed  → Detailed label results

GET  /relays/by/software        → Compact software grouping
GET  /relays/by/software/detailed → Detailed software grouping

GET  /relays/by/network         → Compact network grouping
GET  /relays/by/network/detailed → Detailed network grouping

GET  /relays/by/nip             → Compact NIP grouping
GET  /relays/by/nip/detailed    → Detailed NIP grouping

GET  /relays/by/country         → Compact country grouping
GET  /relays/by/country/detailed → Detailed country grouping

# Comparison & Availability
POST /relays/compare            → Compact comparison
POST /relays/compare/detailed   → Detailed comparison

POST /relays/online             → Compact online relays
POST /relays/online/detailed    → Detailed online relays

POST /relays/offline            → Compact offline relays
POST /relays/offline/detailed   → Detailed offline relays

POST /relays/dead               → Compact dead relays
POST /relays/dead/detailed      → Detailed dead relays

# Label Operations (inherently compact)
GET  /relays/labels             → Already compact
GET  /relays/labels/list        → Already compact
```

### 1.2 Naming Conventions

**Consistency Rules:**
1. **Base endpoint** returns compact format by default
2. **`/detailed` suffix** explicitly requests verbose format
3. **Query parameters** are preserved: `?limit=`, `?offset=`, `?sortBy=`, etc.
4. **Deprecated `?compact=` parameter** is removed from all endpoints
5. **Path structure** follows RESTful patterns: resource → action → modifier

### 1.3 Backward Compatibility Strategy

**Transition Phases:**

**Phase 1 (Immediate):**
- Keep existing endpoints with `?compact=true` parameter
- Add new `/detailed` endpoints
- Document migration path

**Phase 2 (After grace period):**
- Make compact the default on base endpoints
- Deprecate `?compact=` parameter (issue warnings)
- Update documentation

**Phase 3 (Final):**
- Remove `?compact=` parameter support
- Only support base (compact) and `/detailed` endpoints

## 2. Response Schema Architecture

### 2.1 Compact Response Schema

**Design Principles:**
- **Array-first:** Use arrays instead of objects where possible
- **Minimal keys:** Remove verbose field names
- **Omit metadata:** Exclude `contributingAuthors`, `conflicts`, `lastUpdated` per field
- **Flatten structures:** Reduce nesting depth
- **Numeric encoding:** Use short codes for enums

**Compact RelayState Schema:**

```typescript
/**
 * Compact relay state representation
 * Optimized for bandwidth and 402.markets monetization
 */
export interface CompactRelayState {
  // Core fields (always present)
  url: string                      // relayUrl
  updated: number                  // updated_at timestamp
  obs: number                      // observationCount

  // Network (single field, no support metadata)
  net?: string                     // 'clearnet' | 'tor' | 'i2p' | 'hybrid'

  // Software (flattened)
  sw?: {
    fam?: string                   // family value
    ver?: string                   // version value
  }

  // RTT (median values only, no MAD, support, or authors)
  rtt?: {
    o?: number                     // open
    r?: number                     // read
    w?: number                     // write
    i?: number                     // info
  }

  // NIPs (array only, no per-item support)
  nips?: number[]

  // Requirements (boolean values only)
  req?: {
    pay?: boolean                  // payment required
    auth?: boolean                 // auth required
  }

  // Labels (simplified: namespace → values array)
  labels?: Record<string, string[]>

  // Geo (minimal)
  geo?: [number, number, number]   // [lat, lon, precision]

  // IP addresses (array)
  ips?: string[]

  // Country (ISO code only)
  cc?: string                      // country code

  // Availability (optional timestamps)
  seen?: number                    // lastSeenAt
  open?: number                    // lastOpenAt
}
```

**Example Compact Response:**

```json
{
  "relays": [
    {
      "url": "wss://relay.example.com",
      "updated": 1699564800,
      "obs": 42,
      "net": "clearnet",
      "sw": { "fam": "nostream", "ver": "1.25.0" },
      "rtt": { "o": 150, "r": 45, "w": 60, "i": 30 },
      "nips": [1, 2, 9, 11, 15, 16, 20],
      "req": { "pay": false, "auth": false },
      "labels": {
        "geo": ["US", "North America"],
        "type": ["public", "free"]
      },
      "geo": [40.7128, -74.0060, 8],
      "cc": "US",
      "seen": 1699564750,
      "open": 1699564730
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

**Size Savings:**
- **Field name reduction:** 40-50% smaller keys
- **Metadata removal:** ~30-40% less data (no contributingAuthors, conflicts)
- **Array encoding:** ~10-20% compression for multi-value fields
- **Total reduction:** ~60-70% smaller response size

### 2.2 Detailed Response Schema

**Design Principles:**
- **Full metadata:** Include all `contributingAuthors`, `support`, `sampleSize`
- **Conflict information:** Expose minority views
- **Verbose naming:** Clear, descriptive field names
- **Backward compatible:** Match current RelayState interface

**Detailed RelayState Schema:**

```typescript
/**
 * Detailed relay state (existing RelayState interface)
 * Full metadata for analysis and debugging
 */
export interface DetailedRelayState {
  relayUrl: string
  updated_at: number
  observationCount: number
  contributingAuthors: string[]

  network?: AggregatedValue<'clearnet' | 'tor' | 'i2p' | 'hybrid'>

  software?: {
    family?: AggregatedValue<string>
    version?: AggregatedValue<string>
  }

  rtt?: {
    open?: AggregatedValue<number> & { mad?: number }
    read?: AggregatedValue<number> & { mad?: number }
    write?: AggregatedValue<number> & { mad?: number }
    info?: AggregatedValue<number> & { mad?: number }
  }

  nips?: {
    list: number[]
    support: Record<number, number>
  }

  requirements?: Record<string, AggregatedValue<boolean>>
  labels?: Record<string, string[]>

  geo?: {
    lat: number
    lon: number
    precision: number
    geohash: string
    support: number
    authors: string[]
  }

  ipAddrs?: string[]
  country?: AggregatedValue<string>
  lastSeenAt?: number
  lastOpenAt?: number
}
```

### 2.3 Transformation Layer

**Architecture Pattern: Transformer Middleware**

```typescript
/**
 * Response transformation layer
 * Handles conversion between detailed and compact formats
 */

// Transform single state
export function toCompact(detailed: RelayState): CompactRelayState {
  return {
    url: detailed.relayUrl,
    updated: detailed.updated_at,
    obs: detailed.observationCount,
    net: detailed.network?.value,
    sw: detailed.software ? {
      fam: detailed.software.family?.value,
      ver: detailed.software.version?.value,
    } : undefined,
    rtt: detailed.rtt ? {
      o: detailed.rtt.open?.value,
      r: detailed.rtt.read?.value,
      w: detailed.rtt.write?.value,
      i: detailed.rtt.info?.value,
    } : undefined,
    nips: detailed.nips?.list,
    req: detailed.requirements ? {
      pay: detailed.requirements.payment?.value,
      auth: detailed.requirements.auth?.value,
    } : undefined,
    labels: detailed.labels,
    geo: detailed.geo ? [
      detailed.geo.lat,
      detailed.geo.lon,
      detailed.geo.precision
    ] : undefined,
    ips: detailed.ipAddrs,
    cc: detailed.country?.value,
    seen: detailed.lastSeenAt,
    open: detailed.lastOpenAt,
  }
}

// Transform array of states
export function toCompactArray(detailed: RelayState[]): CompactRelayState[] {
  return detailed.map(toCompact)
}

// Keep detailed as-is (no transformation needed)
export function toDetailed(detailed: RelayState): DetailedRelayState {
  return detailed // Already in detailed format
}
```

**Integration Point:**

```typescript
// In route handlers
if (isDetailedEndpoint) {
  return { relays: statesFromCore }  // No transformation
} else {
  return { relays: toCompactArray(statesFromCore) }
}
```

### 2.4 Schema Validation

**Approach: Dual Schema Validation**

```typescript
import Ajv from 'ajv'

const ajv = new Ajv()

// Compact schemas
const compactRelayStateSchema = {
  type: 'object',
  required: ['url', 'updated', 'obs'],
  properties: {
    url: { type: 'string', format: 'uri' },
    updated: { type: 'number' },
    obs: { type: 'number' },
    net: { type: 'string', enum: ['clearnet', 'tor', 'i2p', 'hybrid'] },
    sw: {
      type: 'object',
      properties: {
        fam: { type: 'string' },
        ver: { type: 'string' }
      }
    },
    // ... more fields
  },
  additionalProperties: false
}

// Detailed schemas (existing)
const detailedRelayStateSchema = {
  type: 'object',
  required: ['relayUrl', 'updated_at', 'observationCount'],
  properties: {
    relayUrl: { type: 'string', format: 'uri' },
    updated_at: { type: 'number' },
    observationCount: { type: 'number' },
    contributingAuthors: { type: 'array', items: { type: 'string' } },
    // ... more fields
  }
}

// Validators
export const validateCompactRelayState = ajv.compile(compactRelayStateSchema)
export const validateDetailedRelayState = ajv.compile(detailedRelayStateSchema)
```

**Validation Middleware:**

```typescript
export function validateResponse(schema: 'compact' | 'detailed') {
  return (request: any, reply: any, done: any) => {
    const originalSend = reply.send
    reply.send = function(payload: any) {
      const validator = schema === 'compact'
        ? validateCompactRelayState
        : validateDetailedRelayState

      if (payload.relays) {
        for (const relay of payload.relays) {
          if (!validator(relay)) {
            throw new Error(`Invalid ${schema} relay state: ${ajv.errorsText(validator.errors)}`)
          }
        }
      }

      return originalSend.call(this, payload)
    }
    done()
  }
}
```

### 2.5 Error Response Format

**Consistent Error Structure:**

```typescript
// Both compact and detailed endpoints use same error format
export interface ErrorResponse {
  error: {
    code: string           // Machine-readable error code
    message: string        // Human-readable message
    details?: any          // Optional additional context
  }
}

// Examples
{
  "error": {
    "code": "RELAY_NOT_FOUND",
    "message": "Relay wss://example.com not found"
  }
}

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "field": "lat",
      "reason": "Must be between -90 and 90"
    }
  }
}
```

## 3. Implementation Strategy

### 3.1 Middleware/Handler Pattern

**Architecture: Dual-Route Registration**

```typescript
/**
 * Route registration pattern for dual endpoints
 */

interface RouteConfig {
  path: string
  handler: (request: any, reply: any) => Promise<any>
  schema?: any
  preHandler?: any[]
}

/**
 * Register both compact and detailed versions of a route
 */
export function registerDualRoute(
  app: FastifyInstance,
  config: {
    basePath: string
    compact: RouteConfig
    detailed: RouteConfig
  }
) {
  // Register compact (base) endpoint
  app.route({
    method: config.compact.method || 'GET',
    url: config.basePath,
    schema: config.compact.schema,
    preHandler: config.compact.preHandler,
    handler: async (request, reply) => {
      const result = await config.compact.handler(request, reply)
      // Transform to compact format
      if (result.relays) {
        result.relays = toCompactArray(result.relays)
      }
      return result
    }
  })

  // Register detailed endpoint
  app.route({
    method: config.detailed.method || 'GET',
    url: `${config.basePath}/detailed`,
    schema: config.detailed.schema,
    preHandler: config.detailed.preHandler,
    handler: async (request, reply) => {
      const result = await config.detailed.handler(request, reply)
      // No transformation needed for detailed
      return result
    }
  })
}
```

**Usage Example:**

```typescript
// In registerRelayRoutes()
registerDualRoute(app, {
  basePath: '/relays',
  compact: {
    schema: {
      tags: ['relays'],
      description: 'List all relays (compact format)',
      querystring: listQuerySchema,
      response: {
        200: schemas.relays.list.compact
      }
    },
    handler: async (request, reply) => {
      const { limit, offset, sortBy, sortOrder } = request.query
      const states = core.query.relays.getAll()
      // Sort logic...
      return {
        relays: states.slice(offset, offset + limit),
        total: states.length,
        limit,
        offset
      }
    }
  },
  detailed: {
    schema: {
      tags: ['relays'],
      description: 'List all relays (detailed format)',
      querystring: listQuerySchema,
      response: {
        200: schemas.relays.list.detailed
      }
    },
    handler: async (request, reply) => {
      // Same logic, but returns detailed format
      const { limit, offset, sortBy, sortOrder } = request.query
      const states = core.query.relays.getAll()
      // Sort logic...
      return {
        relays: states.slice(offset, offset + limit),
        total: states.length,
        limit,
        offset
      }
    }
  }
})
```

### 3.2 ContextVM Integration

**Pattern: Tool Registration with Format Parameter**

```typescript
/**
 * CVM tool registration for dual-format support
 */

// Register compact tools (default)
export function registerCompactTools(cvm: ContextVM) {
  cvm.registerTool({
    name: 'relay_list',
    description: 'List relays (compact format)',
    parameters: {
      limit: { type: 'number', default: 50 },
      offset: { type: 'number', default: 0 }
    },
    handler: async (params) => {
      const states = core.query.relays.getAll()
      const sliced = states.slice(params.offset, params.offset + params.limit)
      return toCompactArray(sliced)
    }
  })
}

// Register detailed tools (explicit)
export function registerDetailedTools(cvm: ContextVM) {
  cvm.registerTool({
    name: 'relay_list_detailed',
    description: 'List relays with full metadata',
    parameters: {
      limit: { type: 'number', default: 50 },
      offset: { type: 'number', default: 0 }
    },
    handler: async (params) => {
      const states = core.query.relays.getAll()
      return states.slice(params.offset, params.offset + params.limit)
    }
  })
}
```

**Alternative: Single Tool with Format Flag**

```typescript
cvm.registerTool({
  name: 'relay_list',
  description: 'List relays',
  parameters: {
    limit: { type: 'number', default: 50 },
    offset: { type: 'number', default: 0 },
    format: {
      type: 'string',
      enum: ['compact', 'detailed'],
      default: 'compact'
    }
  },
  handler: async (params) => {
    const states = core.query.relays.getAll()
    const sliced = states.slice(params.offset, params.offset + params.limit)

    return params.format === 'compact'
      ? toCompactArray(sliced)
      : sliced
  }
})
```

### 3.3 Migration Path

**Step-by-Step Implementation:**

**Step 1: Create Compact Schema Types**
```bash
# Create new types file
src/types/compact-schema.ts
```
- Define `CompactRelayState` interface
- Define transformation functions
- Export validators

**Step 2: Implement Transformation Layer**
```bash
# Create transformer utility
src/utils/transform.ts
```
- Implement `toCompact()`, `toCompactArray()`
- Add unit tests for transformations
- Ensure no data loss in round-trips

**Step 3: Create Dual-Route Helper**
```bash
# Add to REST server utilities
src/rest/dual-route.ts
```
- Implement `registerDualRoute()` helper
- Add schema selection logic
- Configure validation middleware

**Step 4: Update Existing Routes**
```bash
# Modify route files one by one
src/rest/routes/relays.ts
```
- Convert to `registerDualRoute()` pattern
- Keep `?compact=` parameter for backward compatibility (deprecated)
- Add warnings to deprecated usage

**Step 5: Update Schemas Directory**
```bash
# Add compact schema variants
schemas/relays-list-output-compact.json
schemas/relays-get-state-output-compact.json
```
- Create JSON schema definitions for compact format
- Update schema loader to support format variants

**Step 6: Update Documentation**
```bash
# Update API docs
docs/api/endpoints.md
docs/api/migration-guide.md
```
- Document new `/detailed` endpoints
- Provide migration examples
- Set deprecation timeline for `?compact=`

**Step 7: Update ContextVM Integration**
```bash
# Update CVM tool registrations
src/core/cvm-tools.ts
```
- Register compact tools as default
- Register detailed variants
- Update tool descriptions

**Step 8: Testing**
```bash
# Create comprehensive test suite
test/rest/compact-endpoints.test.ts
test/rest/detailed-endpoints.test.ts
```
- Test format accuracy
- Verify transformation correctness
- Measure response size reduction
- Performance benchmarks

### 3.4 Rollback Plan

**Safety Mechanisms:**

1. **Feature Flag Control**
```typescript
interface RestConfig {
  enableCompactDefault: boolean  // Default: false during rollout
  enableDetailedEndpoints: boolean
  deprecateCompactParam: boolean
}
```

2. **Gradual Rollout**
```typescript
// Phase 1: Add /detailed endpoints, keep compact=true param
config.enableDetailedEndpoints = true
config.enableCompactDefault = false  // Keep compact opt-in

// Phase 2: Make compact default, deprecate param
config.enableCompactDefault = true
config.deprecateCompactParam = true

// Phase 3: Remove param support
// Remove ?compact= parameter code entirely
```

3. **Monitoring & Alerts**
```typescript
// Track usage metrics
metrics.recordEndpointUsage({
  endpoint: '/relays',
  format: 'compact',
  responseSize: sizeInBytes,
  latency: durationMs
})

// Alert on errors
if (transformationError) {
  logger.error({ error, state }, 'Compact transformation failed')
  // Fallback to detailed format
  return detailedState
}
```

4. **Emergency Rollback**
```typescript
// Single flag to revert to old behavior
if (process.env.DISABLE_COMPACT_ENDPOINTS === 'true') {
  // Skip all compact transformation
  // Ignore /detailed routes
  // Restore ?compact= parameter behavior
}
```

## 4. 402.markets Integration

### 4.1 Monetization-Friendly Compact Schema

**Design Goals:**
- **Smaller payload = Lower cost** for users
- **Metered bandwidth** savings compound at scale
- **Tiered pricing** can offer compact-only vs. detailed access

**Pricing Model:**

```typescript
interface PricingTier {
  name: string
  maxRequestsPerDay: number
  allowedFormats: ('compact' | 'detailed')[]
  pricePerRequest: number  // in msats
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'free',
    maxRequestsPerDay: 100,
    allowedFormats: ['compact'],
    pricePerRequest: 0
  },
  {
    name: 'basic',
    maxRequestsPerDay: 1000,
    allowedFormats: ['compact'],
    pricePerRequest: 10  // 10 msats per compact response
  },
  {
    name: 'pro',
    maxRequestsPerDay: 10000,
    allowedFormats: ['compact', 'detailed'],
    pricePerRequest: 25  // 25 msats for detailed
  }
]
```

### 4.2 L402 & Cashu Compatibility

**Challenge/Response Flow:**

```typescript
/**
 * Payment pre-handler for detailed endpoints
 */
export async function detailedEndpointPaymentHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization

  // Check if requesting detailed endpoint
  const isDetailed = request.url.includes('/detailed')

  if (isDetailed) {
    // Detailed requires payment
    if (!authHeader) {
      return reply.status(402).headers({
        'WWW-Authenticate': generateL402Challenge({
          amount: 25,  // 25 msats for detailed
          memo: 'Detailed relay data access'
        }),
        'X-Cashu': generateCashuChallenge({
          amount: 25,
          pubkey: SERVER_PUBKEY
        })
      }).send({ error: 'Payment required for detailed data' })
    }

    // Verify payment
    const verified = await verifyPayment(authHeader)
    if (!verified) {
      return reply.status(402).send({ error: 'Invalid payment' })
    }
  } else {
    // Compact is free or lower cost
    if (!authHeader && config.requirePaymentForCompact) {
      return reply.status(402).headers({
        'WWW-Authenticate': generateL402Challenge({
          amount: 10,  // 10 msats for compact
          memo: 'Compact relay data access'
        })
      }).send({ error: 'Payment required' })
    }
  }

  // Allow request to proceed
}
```

### 4.3 Special Considerations

**Compact Data Monetization:**

1. **Volume Discounts:** Reward bulk compact requests
2. **Caching Strategy:** Compact data can be cached longer (less sensitive)
3. **Public Compact, Paid Detailed:** Offer compact for free, charge for detailed
4. **Bandwidth Metering:** Track actual bytes transferred, bill accordingly

**Integration Points:**

```typescript
// In route registration
registerDualRoute(app, {
  basePath: '/relays/search',
  compact: {
    preHandler: [rateLimiter, compactPaymentHandler],  // Optional payment
    handler: compactSearchHandler
  },
  detailed: {
    preHandler: [rateLimiter, detailedPaymentHandler],  // Required payment
    handler: detailedSearchHandler
  }
})
```

## 5. Architectural Specifications Summary

### 5.1 Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Compact as default** | Optimize for majority use case (bandwidth-sensitive) |
| **`/detailed` suffix** | Clear, explicit, discoverable pattern |
| **Remove `?compact=` param** | Simplify API surface, reduce confusion |
| **Array-based compact format** | 60-70% size reduction, faster parsing |
| **Dual-route pattern** | DRY principle, consistent behavior |
| **Transformation layer** | Centralized logic, testable, maintainable |
| **Feature flag rollout** | Safe, gradual migration with rollback capability |
| **Separate pricing tiers** | Monetize detailed access, reward efficient usage |

### 5.2 Implementation Checklist

- [ ] Define `CompactRelayState` TypeScript types
- [ ] Implement `toCompact()` transformation functions
- [ ] Create `registerDualRoute()` helper
- [ ] Update all relay routes to dual pattern
- [ ] Add JSON schemas for compact format
- [ ] Implement validation middleware
- [ ] Update ContextVM tool registrations
- [ ] Write comprehensive test suite
- [ ] Update API documentation
- [ ] Configure feature flags
- [ ] Integrate with 402.markets payment flow
- [ ] Set up monitoring & metrics
- [ ] Create migration guide for clients
- [ ] Define deprecation timeline
- [ ] Implement rollback mechanism

### 5.3 Success Metrics

**Performance:**
- [ ] **Response size reduction:** Target 60-70% smaller
- [ ] **Latency improvement:** <10ms overhead for transformation
- [ ] **Throughput increase:** Handle 2x more requests with same bandwidth

**Adoption:**
- [ ] **Client migration:** 80% using compact endpoints within 3 months
- [ ] **Error rate:** <0.1% transformation failures
- [ ] **User satisfaction:** Positive feedback on bandwidth savings

**Business:**
- [ ] **402.markets integration:** Successful L402/Cashu payment flow
- [ ] **Revenue impact:** Clear pricing tier adoption
- [ ] **Cost savings:** Reduced egress bandwidth costs

---

## 6. File Locations & Artifacts

**New Files to Create:**

```
src/types/compact-schema.ts           # Compact type definitions
src/utils/transform.ts                # Transformation functions
src/rest/dual-route.ts                # Route registration helper
src/rest/validation.ts                # Schema validation middleware

schemas/compact/
  ├── relay-state-compact.json        # Compact relay schema
  ├── relays-list-compact.json        # Compact list response
  └── ... (other compact variants)

test/rest/
  ├── compact-endpoints.test.ts       # Compact endpoint tests
  ├── detailed-endpoints.test.ts      # Detailed endpoint tests
  └── transformation.test.ts          # Transformation logic tests

docs/api/
  ├── compact-format.md               # Compact format specification
  ├── migration-guide.md              # Client migration instructions
  └── monetization.md                 # 402.markets integration
```

**Modified Files:**

```
src/rest/routes/relays.ts             # Convert to dual-route pattern
src/rest/routes/monitors.ts           # Same pattern
src/rest/schemas.ts                   # Load compact schemas
src/rest/payments.ts                  # Update payment handlers
src/core/cvm-tools.ts                 # Register dual-format tools
src/config.ts                         # Add feature flags
```

---

## Conclusion

This architecture provides a clear, consistent, and scalable approach to implementing compact-first endpoints with explicit detailed variants. The design optimizes for:

1. **Bandwidth efficiency** through 60-70% payload reduction
2. **Developer experience** via predictable URL patterns
3. **Monetization** with tiered access and 402.markets integration
4. **Safety** through gradual rollout and rollback mechanisms
5. **Maintainability** via centralized transformation logic

The implementation follows REST best practices, maintains backward compatibility during transition, and positions the API for scalable growth with pay-per-use models.
