# Implementation Guide: Three-Level Response Shaping

**For**: Coder Agent
**Architecture Doc**: See `architecture-three-level-response-shaping.md` for full details
**Status**: Ready for implementation

## Quick Reference

### Core Changes

1. **New Type**: `ResponseShape = 'full' | 'detailed' | 'simple'`
2. **New Helpers**: `toSimple()`, `toSimpleList()`, `applyShapeSingle()`, `applyShapeList()`
3. **New Parser**: `parseResponseFormat(format?, compact?)` → returns `ParsedFormat`
4. **Deprecation**: Emit headers when legacy params used

### Implementation Checklist

- [ ] **Phase 1**: Update `src/types/response-formats.ts` with new types and helpers
- [ ] **Phase 2**: Create `src/utils/response-parsing.ts` for parameter parsing
- [ ] **Phase 3**: Update `src/rest/routes/relays.ts` to use new parsing/shaping
- [ ] **Phase 4**: Update `src/tools/relays.ts` to use new parsing/shaping
- [ ] **Phase 5**: Update JSON schemas in `src/schemas/` with oneOf variants
- [ ] **Phase 6**: Create comprehensive tests in `test/`

---

## Phase 1: Type System (`src/types/response-formats.ts`)

### Add New Types

```typescript
export type ResponseShape = 'full' | 'detailed' | 'simple'
export type FullRelayState = RelayState
export type SimpleRelayReference = string

// Keep existing DetailedRelayState interface (rename from CompactRelayState)
// Keep CompactRelayState as alias for backward compatibility
```

### Add New Helpers

```typescript
// Simple transformation (extract URL)
export function toSimple(state: RelayState): SimpleRelayReference {
  return state.relayUrl
}

export function toSimpleList(states: RelayState[]): SimpleRelayReference[] {
  return states.map(state => state.relayUrl)
}

// Full transformation (identity)
export function toFull(state: RelayState): FullRelayState {
  return state
}

export function toFullArray(states: RelayState[]): FullRelayState[] {
  return states
}

// Unified shaping API
export function applyShapeSingle(
  state: RelayState,
  shape: ResponseShape = 'detailed'
): FullRelayState | DetailedRelayState {
  switch (shape) {
    case 'full': return toFull(state)
    case 'detailed': return toDetailed(state)
    case 'simple': return toDetailed(state)  // Fall back for single objects
  }
}

export function applyShapeList(
  states: RelayState[],
  shape: ResponseShape = 'detailed'
): FullRelayState[] | DetailedRelayState[] | SimpleRelayReference[] {
  switch (shape) {
    case 'full': return toFullArray(states)
    case 'detailed': return toDetailedArray(states)
    case 'simple': return toSimpleList(states)
  }
}

// Rename existing toCompact to toDetailed
export function toDetailed(state: RelayState): DetailedRelayState {
  // Existing toCompact implementation
}

export function toDetailedArray(states: RelayState[]): DetailedRelayState[] {
  return states.map(toDetailed)
}

// Keep toCompact as deprecated alias
export function toCompact(state: RelayState): CompactRelayState {
  return toDetailed(state)
}

export function toCompactArray(states: RelayState[]): CompactRelayState[] {
  return toDetailedArray(states)
}
```

---

## Phase 2: Parameter Parsing (`src/utils/response-parsing.ts`)

### Create New File

```typescript
import type { ResponseShape } from '../types/response-formats.js'

export interface ParsedFormat {
  shape: ResponseShape
  isLegacy: boolean
  legacyParam: 'format=compact' | 'compact=true' | 'compact=false' | null
}

export function parseResponseFormat(
  format?: string,
  compact?: boolean | string
): ParsedFormat {
  // Priority 1: New format parameter
  if (format === 'full' || format === 'detailed' || format === 'simple') {
    return { shape: format, isLegacy: false, legacyParam: null }
  }

  // Legacy format=compact
  if (format === 'compact') {
    return { shape: 'detailed', isLegacy: true, legacyParam: 'format=compact' }
  }

  // Priority 2: Legacy boolean compact
  if (compact === true || compact === 'true') {
    return { shape: 'detailed', isLegacy: true, legacyParam: 'compact=true' }
  }
  if (compact === false || compact === 'false') {
    return { shape: 'full', isLegacy: true, legacyParam: 'compact=false' }
  }

  // Default
  return { shape: 'detailed', isLegacy: false, legacyParam: null }
}

export interface DeprecationHeaders {
  'Deprecation': string
  'Link'?: string
}

export function generateDeprecationHeaders(
  legacyParam: string | null,
  docsUrl = '/docs/api/migration#response-format'
): DeprecationHeaders | null {
  if (!legacyParam) return null

  return {
    'Deprecation': 'true',
    'Link': `<${docsUrl}>; rel="deprecation"`
  }
}

export function applyDeprecationHeaders(
  reply: any,
  parsed: ParsedFormat
): void {
  if (!parsed.isLegacy) return

  const headers = generateDeprecationHeaders(parsed.legacyParam)
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      reply.header(key, value)
    })
  }
}
```

---

## Phase 3: REST Endpoints (`src/rest/routes/relays.ts`)

### Update Query Schemas

```typescript
// List endpoint querystring
querystring: {
  type: 'object',
  properties: {
    limit: { type: 'number', default: 50, maximum: 200 },
    offset: { type: 'number', default: 0 },
    sortBy: { type: 'string', enum: ['url', 'updated', 'observationCount', 'lastSeen'], default: 'url' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
    format: {
      type: 'string',
      enum: ['full', 'detailed', 'simple'],
      default: 'detailed',
      description: 'Response format: full (with attribution), detailed (no attribution), simple (URLs only)'
    },
    compact: {
      type: 'boolean',
      description: 'DEPRECATED: Use format parameter instead'
    }
  }
}
```

### Update Handlers

```typescript
import { parseResponseFormat, applyDeprecationHeaders } from '../../utils/response-parsing.js'
import { applyShapeList, applyShapeSingle } from '../../types/response-formats.js'

// List endpoint handler
async (request, reply) => {
  // 1. Parse format
  const parsed = parseResponseFormat(
    request.query.format,
    request.query.compact
  )

  // 2. Apply deprecation headers
  applyDeprecationHeaders(reply, parsed)

  // 3. Query data (full states)
  const states = core.query.relays.getAll()

  // 4. Apply sorting, pagination
  const paged = /* ... sorting and pagination ... */

  // 5. Apply shape
  const shaped = applyShapeList(paged, parsed.shape)

  return {
    relays: shaped,
    total: states.length,
    limit: request.query.limit,
    offset: request.query.offset
  }
}

// Single endpoint handler
async (request, reply) => {
  const parsed = parseResponseFormat(
    request.query.format,
    request.query.compact
  )

  applyDeprecationHeaders(reply, parsed)

  const state = core.query.relays.getState(request.query.relayUrl)
  if (!state) {
    return reply.code(404).send({ error: 'Relay not found' })
  }

  const shaped = applyShapeSingle(state, parsed.shape)
  return shaped
}
```

---

## Phase 4: CVM Tools (`src/tools/relays.ts`)

### Update Input Schemas

```typescript
// List-returning tools
inputSchema: {
  type: 'object',
  properties: {
    // ... existing properties ...
    format: {
      type: 'string',
      enum: ['full', 'detailed', 'simple'],
      default: 'detailed',
      description: 'Response format'
    }
  }
}

// Single-object tools
inputSchema: {
  type: 'object',
  properties: {
    // ... existing properties ...
    format: {
      type: 'string',
      enum: ['full', 'detailed'],  // No 'simple'
      default: 'detailed'
    }
  }
}
```

### Update Handlers

```typescript
import { parseResponseFormat } from '../utils/response-parsing.js'
import { applyShapeList, applyShapeSingle } from '../types/response-formats.js'

// List tool handler
handler: async (input) => {
  const parsed = parseResponseFormat(input.format)
  const states = /* ... query logic ... */
  const shaped = applyShapeList(states, parsed.shape)

  return {
    relays: shaped,
    total: states.length
  }
}

// Single tool handler
handler: async (input) => {
  const parsed = parseResponseFormat(input.format)
  const state = /* ... query logic ... */
  const shaped = applyShapeSingle(state, parsed.shape)

  return shaped
}
```

---

## Phase 5: JSON Schemas (`src/schemas/`)

### Update Output Schemas with oneOf

```json
{
  "oneOf": [
    {
      "type": "object",
      "description": "Full format with attribution (format=full)",
      "properties": {
        "relays": {
          "type": "array",
          "items": { "$ref": "#/definitions/RelayState" }
        },
        "total": { "type": "number" },
        "limit": { "type": "number" },
        "offset": { "type": "number" }
      }
    },
    {
      "type": "object",
      "description": "Detailed format without attribution (format=detailed, default)",
      "properties": {
        "relays": {
          "type": "array",
          "items": { "$ref": "#/definitions/DetailedRelayState" }
        },
        "total": { "type": "number" },
        "limit": { "type": "number" },
        "offset": { "type": "number" }
      }
    },
    {
      "type": "object",
      "description": "Simple format with URLs only (format=simple)",
      "properties": {
        "relays": {
          "type": "array",
          "items": { "type": "string", "format": "uri" }
        },
        "total": { "type": "number" },
        "limit": { "type": "number" },
        "offset": { "type": "number" }
      }
    }
  ]
}
```

### Files to Update

- `relays-list-output.json`
- `relays-search-output.json`
- `relays-nearby-output.json`
- `relays-bbox-output.json`
- `relays-by-label-output.json`
- `relays-by-software-output.json`
- `relays-by-network-output.json`
- `relays-by-nip-output.json`
- `relays-by-country-output.json`
- `relays-availability-output.json`

For single-object schemas:
- `relays-get-state-output.json`
- `relays-get-labels-output.json`

---

## Phase 6: Testing (`test/`)

### Unit Tests (`test/unit/response-shaping.test.ts`)

```typescript
describe('Response Shaping Utilities', () => {
  describe('toSimpleList', () => {
    it('extracts relay URLs', () => {
      const states = [createRelayState('wss://r1.com'), createRelayState('wss://r2.com')]
      expect(toSimpleList(states)).toEqual(['wss://r1.com', 'wss://r2.com'])
    })
  })

  describe('parseResponseFormat', () => {
    it('parses new format values', () => {
      expect(parseResponseFormat('full').shape).toBe('full')
      expect(parseResponseFormat('detailed').shape).toBe('detailed')
      expect(parseResponseFormat('simple').shape).toBe('simple')
    })

    it('handles legacy format=compact', () => {
      const parsed = parseResponseFormat('compact')
      expect(parsed.shape).toBe('detailed')
      expect(parsed.isLegacy).toBe(true)
      expect(parsed.legacyParam).toBe('format=compact')
    })

    it('handles legacy compact boolean', () => {
      expect(parseResponseFormat(undefined, true).shape).toBe('detailed')
      expect(parseResponseFormat(undefined, false).shape).toBe('full')
    })
  })

  describe('applyShapeList', () => {
    it('returns full states for full shape', () => {
      const states = [createFullRelayState()]
      const shaped = applyShapeList(states, 'full')
      expect(shaped[0]).toHaveProperty('network.contributingAuthors')
    })

    it('returns detailed states for detailed shape', () => {
      const states = [createFullRelayState()]
      const shaped = applyShapeList(states, 'detailed')
      expect(shaped[0]).not.toHaveProperty('network.contributingAuthors')
      expect(shaped[0]).toHaveProperty('network.value')
    })

    it('returns URLs for simple shape', () => {
      const states = [createFullRelayState('wss://r1.com')]
      const shaped = applyShapeList(states, 'simple')
      expect(shaped).toEqual(['wss://r1.com'])
    })
  })
})
```

### Integration Tests (`test/integration/rest-response-shapes.test.ts`)

```typescript
describe('REST /relays Endpoint Response Shapes', () => {
  it('returns full format with format=full', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/relays?format=full&limit=5'
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.relays[0]).toHaveProperty('network.contributingAuthors')
  })

  it('returns detailed format with format=detailed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/relays?format=detailed&limit=5'
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.relays[0]).not.toHaveProperty('network.contributingAuthors')
    expect(data.relays[0]).toHaveProperty('network.value')
  })

  it('returns simple format with format=simple', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/relays?format=simple&limit=5'
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(typeof data.relays[0]).toBe('string')
    expect(data.relays[0]).toMatch(/^wss?:\/\//)
  })

  it('emits deprecation headers for format=compact', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/relays?format=compact&limit=5'
    })

    expect(res.headers['deprecation']).toBe('true')
    expect(res.headers['link']).toContain('rel="deprecation"')
  })

  it('emits deprecation headers for compact=true', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/relays?compact=true&limit=5'
    })

    expect(res.headers['deprecation']).toBe('true')
  })
})
```

### Integration Tests (`test/integration/tool-response-shapes.test.ts`)

```typescript
describe('CVM relays/list Tool Response Shapes', () => {
  const tool = createRelaysListTool({ core })

  it('returns full format', async () => {
    const result = await tool.handler({ format: 'full', limit: 5 })
    expect(result.relays[0]).toHaveProperty('network.contributingAuthors')
  })

  it('returns detailed format', async () => {
    const result = await tool.handler({ format: 'detailed', limit: 5 })
    expect(result.relays[0]).not.toHaveProperty('network.contributingAuthors')
  })

  it('returns simple format', async () => {
    const result = await tool.handler({ format: 'simple', limit: 5 })
    expect(typeof result.relays[0]).toBe('string')
  })
})
```

---

## Testing Strategy

### Coverage Targets
- **Unit tests**: 95%+ coverage on shaping utilities
- **Integration tests**: All endpoints with all three formats
- **Schema tests**: Validate oneOf schemas with Ajv

### Test Data
- Create helper functions for test relay states
- Ensure variety: full attribution, partial data, edge cases
- Test with different shapes simultaneously

---

## Migration Path

### Backward Compatibility Matrix

| Input | Output Shape | Deprecation? |
|-------|--------------|--------------|
| `format=full` | full | No |
| `format=detailed` | detailed | No |
| `format=simple` | simple | No |
| `format=compact` | detailed | **Yes** |
| `compact=true` | detailed | **Yes** |
| `compact=false` | full | **Yes** |
| (no params) | detailed | No |

### Timeline
1. **This milestone**: All params accepted, deprecation headers emitted
2. **Future minor**: Continue support, add Sunset header
3. **Future major**: Optionally remap `format=compact` → `simple`

---

## Key Files Summary

### Create New
- `src/utils/response-parsing.ts` - Parameter parsing and deprecation headers

### Modify
- `src/types/response-formats.ts` - Add ResponseShape, new helpers, unified API
- `src/rest/routes/relays.ts` - Use new parsing and shaping
- `src/tools/relays.ts` - Use new parsing and shaping
- All `src/schemas/*.json` - Update with oneOf variants

### Tests
- `test/unit/response-shaping.test.ts`
- `test/integration/rest-response-shapes.test.ts`
- `test/integration/tool-response-shapes.test.ts`

---

## Common Pitfalls

1. **Don't forget single-object endpoints**: They don't support `simple` format
2. **Always check for legacy params**: Use `parseResponseFormat()` consistently
3. **Emit deprecation headers in REST only**: Not in CVM tools (no HTTP headers)
4. **Update ALL schemas**: Easy to miss less-used endpoints
5. **Test with real data**: Ensure shaping preserves ordering and completeness

---

## Success Checklist

- [ ] All types compile without errors
- [ ] All tests pass
- [ ] REST endpoints emit deprecation headers correctly
- [ ] CVM tools accept new format parameter
- [ ] JSON schemas validate with oneOf variants
- [ ] Documentation updated
- [ ] No breaking changes for existing consumers

---

**Ready to implement! See full architecture document for detailed rationale and design decisions.**
