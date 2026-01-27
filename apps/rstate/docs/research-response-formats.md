# Response Format Implementation Research

**Research Date:** 2025-11-02
**Researcher:** Hive Mind Research Agent
**Mission:** Document current response format patterns to inform three-level shaping design

---

## Executive Summary

The codebase currently implements a **two-level response format system** (`compact` and `detailed`) with the following characteristics:

- **Default Format:** `compact` (removes contributor attribution data)
- **Alternative Format:** `detailed` (includes full contributor data)
- **Backward Compatibility:** Legacy `compact` boolean parameter supported alongside new `format` enum
- **Implementation:** Type-safe transformation functions with consistent patterns
- **Coverage:** Partially implemented across endpoints (some endpoints still use old patterns)

---

## 1. Current Implementation Architecture

### 1.1 Type System (`src/types/response-formats.ts`)

**Core Types:**
```typescript
type ResponseFormat = 'compact' | 'detailed'
type CompactRelayState = Omit<AggregatedValue, 'contributingAuthors'>
type DetailedRelayState = RelayState
```

**Transformation Functions:**
- `toCompact(state: RelayState): CompactRelayState` - Removes contributor fields
- `toCompactArray(states: RelayState[]): CompactRelayState[]` - Batch transformation
- `formatRelayState(state, format)` - Format dispatcher for single objects
- `formatRelayStates(states, format)` - Format dispatcher for arrays

**Key Implementation Details:**
- Manually strips `contributingAuthors` from all aggregated values
- Removes `authors` field from geo data
- Preserves all other fields (values, support, sampleSize, lastUpdated, conflicts)
- Defense-in-depth: Recursive sanitization as fallback

### 1.2 Legacy Utilities (`src/utils/compact.ts`)

**Purpose:** Original compact implementation (pre-format system)

**Functions:**
- `compactRelayState(state)` - Similar to `toCompact` but older pattern
- `compactRelayStates(states)` - Array version
- `sanitizeContributors(obj)` - Recursive cleanup utility

**Status:** Still used in some endpoints that haven't migrated to new format system

---

## 2. Endpoint Categorization

### 2.1 Endpoints Using New Format System

**Pattern:** `format?: ResponseFormat` parameter with backward compatibility

| Endpoint | Type | Format Support | Default | Notes |
|----------|------|----------------|---------|-------|
| `GET /relays` | List | ✅ Full | `compact` | Pagination support |
| `GET /relays/state` | Single | ✅ Full | `compact` | Single relay query |
| `POST /relays/search` | List | ✅ Full | `compact` | Complex filters, payment required |
| **CVM Tools:** | | | | |
| `relays/list` | List | ✅ Full | `compact` | MCP tool version |
| `relays/get_state` | Single | ✅ Full | `compact` | MCP tool version |
| `relays/search` | List | ✅ Full | `compact` | MCP tool version |
| `relays/nearby` | List | ✅ Full | `compact` | With distance field |

**Implementation Pattern:**
```typescript
// Query parameter with backward compatibility
const format: ResponseFormat =
  request.query.format ||
  (request.query.compact === false ? 'detailed' : 'compact')

// Apply transformation
const formatted = format === 'compact' ? toCompactArray(paged) : paged
```

### 2.2 Endpoints Using Legacy Compact Boolean

**Pattern:** `compact?: boolean` parameter (old style)

| Endpoint | Type | Compact Support | Default | Migration Status |
|----------|------|-----------------|---------|------------------|
| `GET /relays/nearby` | List | ⚠️ Boolean only | `false` | Needs migration |
| `GET /relays/bbox` | List | ⚠️ Boolean only | `false` | Needs migration |
| `GET /relays/by/label` | List | ⚠️ Boolean only | `false` | Needs migration |
| **CVM Tools:** | | | | |
| `relays/bbox` | List | ⚠️ Boolean only | `false` | Needs migration |
| `relays/by_label` | List | ⚠️ Boolean only | `false` | Needs migration |

**Implementation Pattern:**
```typescript
// Legacy boolean compact parameter
const compact = params.compact || false

// Apply old utility function
if (compact) {
  paged = compactRelayStates(paged)
}
```

### 2.3 Endpoints Without Format Support

**Pattern:** Always return full detailed format

| Endpoint | Type | Format Support | Return Type | Notes |
|----------|------|----------------|-------------|-------|
| `GET /relays/labels` | Object | ❌ None | `{ labels: Record<string, string[]> }` | Label metadata only |
| `GET /relays/labels/list` | Object | ❌ None | `{ namespaces, labels }` | Metadata aggregation |
| `GET /relays/by/software` | Grouped | ❌ None | `{ groups: Array }` | URL lists only |
| `GET /relays/by/network` | Grouped | ❌ None | `{ groups: Array }` | URL lists only |
| `GET /relays/by/nip` | Grouped | ❌ None | `{ groups: Array }` | Statistics focus |
| `GET /relays/by/country` | Grouped | ❌ None | `{ groups: Array }` | URL lists only |
| `POST /relays/compare` | List | ❌ None | `{ relays, comparison }` | Always full detail for comparison |
| `POST /relays/online` | List | ❌ None | `{ relays: string[] }` | URLs only |
| `POST /relays/offline` | List | ❌ None | `{ relays: string[] }` | URLs only |
| `POST /relays/dead` | List | ❌ None | `{ relays: string[] }` | URLs only |

**Rationale:** These endpoints either:
1. Return URL lists only (no relay state objects)
2. Return metadata/aggregations (no contributor data to strip)
3. Require full detail for their use case (comparison)

---

## 3. Backward Compatibility Mechanisms

### 3.1 Parameter Fallback Logic

**Current Implementation:**
```typescript
// Priority order:
// 1. New format parameter (if provided)
// 2. Legacy compact boolean (if explicitly false, use detailed)
// 3. Default to compact
const format: ResponseFormat =
  params.format ||
  (params.compact === false ? 'detailed' : 'compact')
```

**Edge Cases Handled:**
- `format=compact` → compact (explicit)
- `format=detailed` → detailed (explicit)
- `compact=true` → compact (legacy)
- `compact=false` → detailed (legacy)
- No parameters → compact (default)
- Both parameters → format wins (priority)

### 3.2 Deprecation Strategy

**Current Status:** No deprecation warnings implemented

**What Should Be Added:**
1. Console warnings when `compact` boolean is used
2. Response headers indicating deprecated parameter usage
3. OpenAPI schema deprecation markers
4. Migration timeline in documentation

---

## 4. Schema Exposure Mechanisms

### 4.1 JSON Schema Files

**Location:** `src/schemas/*.json`

**Key Schemas:**
- `relays-list-output.json` - Used by list endpoints
- `relays-get-state-output.json` - Used by single relay endpoints
- `relays-by-label-output.json` - Used by label queries
- `relays-availability-output.json` - Used by online/offline queries

**Current Limitation:** Schemas use generic `additionalProperties: true` and don't specify compact vs detailed variants

**Example:**
```json
{
  "relays": {
    "type": "array",
    "items": {
      "type": "object",
      "description": "RelayState object - see tool-schemas.ts for full structure",
      "additionalProperties": true
    }
  }
}
```

### 4.2 Schema Loading (`src/rest/schemas.ts`)

**Pattern:** Static JSON file loading at module initialization

```typescript
export const schemas = {
  relays: {
    list: loadSchema('relays-list-output.json'),
    getState: loadSchema('relays-get-state-output.json'),
    // ... more schemas
  }
}
```

**Gap:** No dynamic schema selection based on format parameter

### 4.3 OpenAPI Documentation

**Current State:**
- Format parameter documented in querystring schema
- Description includes explanation of compact vs detailed
- No separate response schemas for different formats

**Example:**
```typescript
querystring: {
  properties: {
    format: {
      type: 'string',
      enum: ['compact', 'detailed'],
      default: 'compact',
      description: 'Response format: compact (default, no contributor data) or detailed (includes all attribution)'
    }
  }
}
```

---

## 5. Key Questions Answered

### Q1: How are format params currently parsed and validated?

**Answer:**
- Query parameters use Fastify schema validation
- Type coercion: `format` parsed as string enum
- Validation: Fastify validates against `enum: ['compact', 'detailed']`
- Fallback logic handles both new format and legacy compact parameters
- No runtime validation beyond schema checks

### Q2: Which endpoints return arrays vs single objects?

**Arrays (List Responses):**
- `/relays` (paginated)
- `/relays/search` (filtered)
- `/relays/nearby` (geo query)
- `/relays/bbox` (geo query)
- `/relays/by/label` (filtered)
- `/relays/compare` (multi-relay comparison)
- All CVM list tools

**Single Objects:**
- `/relays/state` (by URL)
- CVM `relays/get_state`

**URL Lists Only:**
- `/relays/online`
- `/relays/offline`
- `/relays/dead`

**Grouped/Aggregated:**
- `/relays/by/software` (groups with URL lists)
- `/relays/by/network` (groups with URL lists)
- `/relays/by/nip` (statistics with URL lists)
- `/relays/by/country` (groups with URL lists)

**Metadata Only:**
- `/relays/labels` (label map)
- `/relays/labels/list` (namespace map)

### Q3: What's the current default behavior?

**Answer:**
- **New endpoints:** Default to `compact` format (removes contributor data)
- **Legacy endpoints:** Default to `compact=false` (full detail) - INCONSISTENT
- **Migration in progress:** Some endpoints migrated, others still use old boolean pattern

### Q4: How are schemas currently generated/exposed?

**Answer:**
- **Static JSON files** loaded at startup (not generated dynamically)
- **Generic schemas** with `additionalProperties: true` (no format-specific variants)
- **OpenAPI integration** via Fastify schema registration
- **No conditional schemas** based on format parameter
- **Manual maintenance** required for schema updates

### Q5: What deprecation mechanisms are in place?

**Answer:**
- **None currently implemented**
- Only backward compatibility through parameter fallback
- No warnings, headers, or explicit deprecation notices
- Documentation describes new format parameter but doesn't mark compact as deprecated

---

## 6. Recommendations for Three-Level Implementation

### 6.1 Immediate Priorities

1. **Complete Migration:**
   - Convert remaining endpoints from `compact: boolean` to `format: ResponseFormat`
   - Update `relays/nearby`, `relays/bbox`, `relays/by/label` endpoints
   - Update corresponding CVM tools

2. **Add Deprecation Warnings:**
   - Log warnings when `compact` boolean parameter is used
   - Add `X-Deprecated-Parameter` response header
   - Update OpenAPI schemas with deprecation markers

3. **Schema Enhancement:**
   - Create format-specific JSON schemas
   - Implement conditional schema selection based on format
   - Generate schemas programmatically from TypeScript types

### 6.2 Three-Level Design Integration Points

**Proposed Levels:**
1. **minimal** - Ultra-compact (URLs + essential metadata only)
2. **compact** - Current compact (no contributor data)
3. **detailed** - Current detailed (full attribution)

**Where to Add:**

**Type System (`response-formats.ts`):**
```typescript
type ResponseFormat = 'minimal' | 'compact' | 'detailed'

function toMinimal(state: RelayState): MinimalRelayState {
  return {
    relayUrl: state.relayUrl,
    updated_at: state.updated_at,
    // Only core fields
  }
}
```

**Endpoint Updates:**
- Extend all format-aware endpoints to support 'minimal'
- Update parameter validation schemas
- Add transformation logic for minimal format

**Schema Files:**
- Create `*-minimal.json` variants
- Implement schema router based on format
- Update schema loader to handle three levels

**Backward Compatibility:**
```typescript
const format: ResponseFormat =
  params.format ||
  params.shaping || // New parameter name?
  (params.compact === false ? 'detailed' : 'compact') // Legacy
```

### 6.3 Migration Path

**Phase 1 - Unification (Current):**
- ✅ Establish type system with two levels
- ✅ Migrate high-traffic endpoints
- ⏳ Complete remaining endpoint migrations
- ⏳ Add deprecation mechanisms

**Phase 2 - Three-Level Expansion:**
- Add 'minimal' level to type system
- Implement transformation functions
- Update all format-aware endpoints
- Create minimal schemas

**Phase 3 - Advanced Features:**
- Field selection (query-level customization)
- Schema version negotiation
- Performance monitoring per format level

---

## 7. Current Patterns & Anti-Patterns

### ✅ Good Patterns

1. **Type Safety:** Strong TypeScript types for formats
2. **Centralized Transformations:** Single source of truth in `response-formats.ts`
3. **Consistent Interface:** `toCompact`, `toDetailed` naming convention
4. **Backward Compatibility:** Smooth migration path from boolean to enum
5. **Documentation:** Clear parameter descriptions in OpenAPI

### ⚠️ Anti-Patterns & Tech Debt

1. **Inconsistent Defaults:**
   - New endpoints default to `compact`
   - Legacy endpoints default to detailed (`compact=false`)

2. **Schema Duplication:**
   - Two transformation utilities (`response-formats.ts` and `utils/compact.ts`)
   - Risk of divergent behavior

3. **Static Schemas:**
   - Generic `additionalProperties: true` instead of precise schemas
   - No format-specific schema variants

4. **No Deprecation Path:**
   - Silent acceptance of legacy parameters
   - No migration incentives for API consumers

5. **Partial Implementation:**
   - Some endpoints fully migrated, others not
   - Inconsistent API surface

---

## 8. Performance Considerations

### Current Transformation Costs

**Compact Transformation:**
- Manual field copying (not structural sharing)
- Multiple object allocations per relay state
- Recursive sanitization as safety net
- No caching of transformed results

**Estimated Impact:**
- Small: ~10-50 µs per relay state
- Large list (1000 relays): ~10-50 ms additional latency
- Acceptable for most use cases but could be optimized

**Optimization Opportunities:**
1. Lazy transformation (transform on serialization)
2. Structural sharing where possible
3. Result caching with format-aware cache keys
4. SIMD for batch transformations

---

## 9. Test Coverage

### Current Testing

**Files Checked:**
- `test/compact-mode.test.ts` - Comprehensive compact format tests
- `test/performance-compact.test.ts` - Performance benchmarks
- `test/rest-integration.test.ts` - REST endpoint tests
- `test/rest_tool_parity.test.ts` - CVM/REST parity tests

**Coverage:**
- ✅ Format parameter parsing
- ✅ Transformation correctness
- ✅ Backward compatibility
- ✅ Performance benchmarks
- ✅ REST/CVM parity

**Gaps:**
- ❌ No tests for format-specific schemas
- ❌ No deprecation warning tests
- ❌ Limited edge case coverage for mixed parameters

---

## 10. Memory Storage for Coordination

**Key:** `hive/research/response-formats`

**Stored Data:**
```json
{
  "research_date": "2025-11-02",
  "agent": "researcher",
  "summary": {
    "current_levels": 2,
    "proposed_levels": 3,
    "default_format": "compact",
    "migration_status": "partial"
  },
  "endpoint_categories": {
    "format_aware": ["GET /relays", "GET /relays/state", "POST /relays/search"],
    "legacy_compact": ["GET /relays/nearby", "GET /relays/bbox", "GET /relays/by/label"],
    "format_unaware": ["GET /relays/labels", "GET /relays/by/software", "POST /relays/online"]
  },
  "migration_priorities": [
    "Complete format migration for legacy endpoints",
    "Add deprecation warnings for compact boolean",
    "Implement format-specific schemas",
    "Add minimal level support"
  ],
  "backward_compatibility": {
    "mechanism": "parameter_fallback",
    "supports": ["format enum", "compact boolean"],
    "priority": "format > compact > default",
    "deprecation_status": "not_implemented"
  },
  "schema_system": {
    "type": "static_json",
    "location": "src/schemas/*.json",
    "format_variants": false,
    "dynamic_selection": false,
    "maintenance": "manual"
  }
}
```

---

## Appendix A: File Inventory

**Core Implementation:**
- `/home/sandwich/Develop/relay-state/src/types/response-formats.ts` (236 lines)
- `/home/sandwich/Develop/relay-state/src/utils/compact.ts` (149 lines) - Legacy
- `/home/sandwich/Develop/relay-state/src/rest/routes/relays.ts` (758 lines)
- `/home/sandwich/Develop/relay-state/src/tools/relays.ts` (801 lines)
- `/home/sandwich/Develop/relay-state/src/core/api.ts` (537 lines)

**Schemas:**
- `/home/sandwich/Develop/relay-state/src/schemas/relays-list-output.json`
- `/home/sandwich/Develop/relay-state/src/schemas/relays-get-state-output.json`
- `/home/sandwich/Develop/relay-state/src/schemas/relays-by-label-output.json`
- 19 total schema files

**Tests:**
- `/home/sandwich/Develop/relay-state/test/compact-mode.test.ts`
- `/home/sandwich/Develop/relay-state/test/performance-compact.test.ts`
- `/home/sandwich/Develop/relay-state/test/rest-integration.test.ts`
- `/home/sandwich/Develop/relay-state/test/rest_tool_parity.test.ts`

---

**Research Status:** ✅ Complete
**Deliverable:** Comprehensive findings stored in coordination memory
**Next Agent:** Architect (for three-level design specification)
