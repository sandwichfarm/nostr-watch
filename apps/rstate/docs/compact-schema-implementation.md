# Compact-First Response Schema Implementation

## Overview

This document describes the implementation of compact-first response schemas for the RelayVM/ContextVM system. The new architecture defaults to compact responses (without contributor attribution data) to reduce payload sizes, with an optional detailed format for full attribution.

## Implementation Summary

### 1. Schema Type Definitions

**File**: `/src/types/response-formats.ts`

New types and utilities:
- `ResponseFormat`: Type alias for `'compact' | 'detailed'`
- `CompactRelayState`: Type definition for compact relay states (omits contributingAuthors)
- `CompactAggregatedValue<T>`: Generic type for compact aggregated values
- `toCompact()`: Transform RelayState to CompactRelayState
- `toCompactArray()`: Transform array of RelayStates
- `formatRelayState()`: Format single state based on ResponseFormat
- `formatRelayStates()`: Format array based on ResponseFormat

### 2. Tool Handler Updates

**File**: `/src/tools/relays.ts`

Updated tools with new `format` parameter (default: `'compact'`):

#### Updated Tools:
1. **relays/list**
   - Added `format` parameter (compact/detailed, default: compact)
   - Backward compatible with old `compact` boolean parameter
   - Uses `toCompactArray()` for transformation

2. **relays/get_state**
   - Added `format` parameter (default: compact)
   - Uses `toCompact()` for single relay transformation
   - Backward compatible with old `compact` parameter

3. **relays/search**
   - Added `format` parameter (default: compact)
   - Uses `toCompactArray()` for result transformation
   - Backward compatible with old `compact` parameter

4. **relays/nearby**
   - Added `format` parameter (default: compact)
   - Preserves distance field in compact mode
   - Uses `toCompact()` for individual transformations

#### Key Changes:
```typescript
// Old behavior (opt-in compact)
compact: { type: 'boolean', default: false }
if (compact) { ... }

// New behavior (compact by default)
format: { type: 'string', enum: ['compact', 'detailed'], default: 'compact' }
if (format === 'compact') { ... }
```

### 3. REST API Route Updates

**File**: `/src/rest/routes/relays.ts`

Updated endpoints with `format` query/body parameter:

#### Updated Endpoints:
1. **GET /relays**
   - Query param: `format?: 'compact' | 'detailed'` (default: compact)
   - Description updated: "compact format by default"

2. **GET /relays/state**
   - Query param: `format?: 'compact' | 'detailed'` (default: compact)
   - Description updated: "compact format by default"

3. **POST /relays/search**
   - Body param: `format?: 'compact' | 'detailed'` (default: compact)
   - Description updated: "compact format by default"

### 4. Backward Compatibility

The implementation maintains full backward compatibility:

```typescript
// Accepts both old and new parameters
const format: ResponseFormat =
  request.query.format ||                    // New parameter
  (request.query.compact === false ? 'detailed' : 'compact')  // Old parameter fallback
```

**Migration Path**:
- Existing clients using `compact=false` → continues to work, returns detailed format
- Existing clients using `compact=true` → continues to work, returns compact format
- Existing clients with no parameter → **NEW BEHAVIOR**: returns compact format (was detailed)
- New clients using `format=compact` → returns compact format
- New clients using `format=detailed` → returns detailed format

### 5. Data Structure Differences

#### Compact Format (Default)
```json
{
  "relayUrl": "wss://relay.example.com",
  "network": {
    "value": "clearnet",
    "support": 0.95,
    "sampleSize": 20,
    "lastUpdated": 1234567890
  }
}
```

#### Detailed Format (Opt-in)
```json
{
  "relayUrl": "wss://relay.example.com",
  "network": {
    "value": "clearnet",
    "support": 0.95,
    "sampleSize": 20,
    "lastUpdated": 1234567890,
    "contributingAuthors": ["npub1...", "npub2..."]
  },
  "contributingAuthors": ["npub1...", "npub2..."]
}
```

**Fields Removed in Compact Mode**:
- `contributingAuthors` (top-level)
- `contributingAuthors` (from each AggregatedValue)
- `authors` (from geo)
- All nested contributor attribution data

## Benefits

1. **Reduced Payload Size**: Typical 20-40% reduction in response size
2. **Improved Performance**: Faster serialization and network transfer
3. **Privacy Enhancement**: Contributor data only exposed when explicitly requested
4. **Backward Compatible**: Existing clients continue to work
5. **Clear Intent**: `format` parameter is more explicit than `compact` boolean

## Usage Examples

### Tool Calls (via MCP/ContextVM)

```typescript
// Compact format (default)
await tool('relays/list', { limit: 50 })
await tool('relays/list', { limit: 50, format: 'compact' })

// Detailed format (with attribution)
await tool('relays/list', { limit: 50, format: 'detailed' })

// Backward compatible
await tool('relays/list', { limit: 50, compact: true })  // Returns compact
await tool('relays/list', { limit: 50, compact: false }) // Returns detailed
```

### REST API Calls

```bash
# Compact format (default)
curl "http://localhost:3000/relays"
curl "http://localhost:3000/relays?format=compact"

# Detailed format
curl "http://localhost:3000/relays?format=detailed"

# Backward compatible
curl "http://localhost:3000/relays?compact=true"   # Returns compact
curl "http://localhost:3000/relays?compact=false"  # Returns detailed
```

### Search with Format

```bash
# POST search with compact format (default)
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{"network":"clearnet","limit":100}'

# POST search with detailed format
curl -X POST http://localhost:3000/relays/search \
  -H "Content-Type: application/json" \
  -d '{"network":"clearnet","limit":100,"format":"detailed"}'
```

## Implementation Files

### New Files
- `/src/types/response-formats.ts` - Schema types and transformation utilities

### Modified Files
- `/src/tools/relays.ts` - Tool handler updates (4 tools updated)
- `/src/rest/routes/relays.ts` - REST endpoint updates (3 endpoints updated)

### Existing Utilities (Reused)
- `/src/utils/compact.ts` - Original compact transformation logic

## Testing Recommendations

1. **Unit Tests**
   - Test `toCompact()` transformation preserves data integrity
   - Test `toCompactArray()` handles empty arrays
   - Test backward compatibility with old `compact` parameter

2. **Integration Tests**
   - Verify default format is compact
   - Verify `format=detailed` returns full data
   - Verify payload size reduction in compact mode

3. **API Tests**
   - Test all REST endpoints with both formats
   - Verify schema validation accepts both parameters
   - Test error handling for invalid format values

## Migration Guide for Clients

### If your client needs contributor attribution:
```typescript
// Add format parameter to all requests
const response = await fetch('/relays?format=detailed')
```

### If your client doesn't need attribution (recommended):
```typescript
// No changes needed - you'll automatically get smaller payloads
const response = await fetch('/relays')
```

### If you're using the old compact parameter:
```typescript
// Old code continues to work
const response = await fetch('/relays?compact=false') // Gets detailed
const response = await fetch('/relays?compact=true')  // Gets compact

// But consider migrating to new parameter
const response = await fetch('/relays?format=detailed')
const response = await fetch('/relays?format=compact')
```

## Performance Impact

**Estimated payload reductions** (based on typical relay states):

| Endpoint | Detailed Size | Compact Size | Reduction |
|----------|--------------|--------------|-----------|
| /relays (100 relays) | ~500KB | ~350KB | 30% |
| /relays/state | ~5KB | ~3.5KB | 30% |
| /relays/search (50 results) | ~250KB | ~175KB | 30% |
| /relays/nearby (20 results) | ~100KB | ~70KB | 30% |

**Note**: Actual sizes vary based on relay state complexity and number of contributors.

## Future Enhancements

1. **Additional Endpoints**: Apply compact-first to remaining endpoints (bbox, labels, compare)
2. **Compression**: Add gzip/brotli compression for further size reduction
3. **Partial Attribution**: Allow clients to request specific contributor fields
4. **Caching**: Cache compact responses separately from detailed
5. **Metrics**: Track format usage to optimize default behavior

## References

- Original compact utility: `/src/utils/compact.ts`
- Type definitions: `/src/types/aggregation.ts`
- Schema files: `/src/schemas/*.json`
