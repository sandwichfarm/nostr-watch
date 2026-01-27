# Architecture: Three-Level Response Shaping (full | detailed | simple)

**Version**: 1.0
**Status**: Design Phase
**Author**: System Architect (Hive Mind Swarm)
**Date**: 2025-11-02

## Executive Summary

This document defines the architecture for implementing three-level response shaping across CVM tools and REST endpoints. The design introduces `full`, `detailed`, and `simple` response formats while maintaining backward compatibility with existing `format` and legacy `compact` parameters.

**Key Design Principles:**
- **Consumer Simplicity**: Single `format` query parameter controls output shape
- **Schema Simplicity**: Clear oneOf variants for code generation (ctxcn)
- **Maintainability**: Centralized shaping utilities, consistent handling
- **Backward Compatibility**: Graceful migration with deprecation headers

---

## 1. Type System Architecture

### 1.1 Core Types

```typescript
/**
 * Response shape enumeration
 * Replaces binary ResponseFormat type
 */
export type ResponseShape = 'full' | 'detailed' | 'simple'

/**
 * Legacy format type (deprecated)
 * Maps: 'compact' → 'detailed' (current), 'simple' (future with deprecation)
 */
export type ResponseFormat = 'compact' | 'detailed'

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
 * Handles all three shapes uniformly
 *
 * @param state - Full relay state
 * @param shape - Desired output shape
 * @returns Shaped state (never simple for single objects)
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
      // Simple doesn't make sense for single objects
      // Fall back to detailed (design decision)
      return toDetailed(state)
  }
}

/**
 * Apply shape transformation to state array
 * Handles all three shapes including simple (string array)
 *
 * @param states - Array of full relay states
 * @param shape - Desired output shape
 * @returns Shaped array (full objects, detailed objects, or URL strings)
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

/**
 * @deprecated Use applyShapeSingle/applyShapeList instead
 * Maintained for backward compatibility
 */
export function formatRelayState(
  state: RelayState | null,
  format: ResponseFormat = 'compact'
): CompactRelayState | DetailedRelayState | null {
  if (!state) return null
  const shape: ResponseShape = format === 'compact' ? 'detailed' : 'full'
  return applyShapeSingle(state, shape) as any
}

/**
 * @deprecated Use applyShapeList instead
 * Maintained for backward compatibility
 */
export function formatRelayStates(
  states: RelayState[],
  format: ResponseFormat = 'compact'
): CompactRelayState[] | DetailedRelayState[] {
  const shape: ResponseShape = format === 'compact' ? 'detailed' : 'full'
  return applyShapeList(states, shape) as any
}
```

---

## 3. Parameter Parsing Architecture

### 3.1 Unified Parser

```typescript
/**
 * Parse and normalize response format parameters
 * Handles both new format and legacy compact parameters
 *
 * @param format - New format parameter ('full' | 'detailed' | 'simple')
 * @param compact - Legacy compact parameter (boolean or 'compact' string)
 * @returns Normalized shape and deprecation flag
 */
export interface ParsedFormat {
  shape: ResponseShape
  isLegacy: boolean
  legacyParam: 'format=compact' | 'compact=true' | 'compact=false' | null
}

export function parseResponseFormat(
  format?: string,
  compact?: boolean | string
): ParsedFormat {
  // Priority 1: New format parameter (if valid)
  if (format) {
    if (format === 'full' || format === 'detailed' || format === 'simple') {
      return { shape: format, isLegacy: false, legacyParam: null }
    }

    // Legacy string 'compact' maps to 'detailed' (current behavior)
    if (format === 'compact') {
      return {
        shape: 'detailed',
        isLegacy: true,
        legacyParam: 'format=compact'
      }
    }
  }

  // Priority 2: Legacy boolean compact parameter
  if (compact !== undefined) {
    if (compact === true || compact === 'true') {
      return {
        shape: 'detailed',
        isLegacy: true,
        legacyParam: 'compact=true'
      }
    }
    if (compact === false || compact === 'false') {
      return {
        shape: 'full',
        isLegacy: true,
        legacyParam: 'compact=false'
      }
    }
  }

  // Default: detailed (current default)
  return { shape: 'detailed', isLegacy: false, legacyParam: null }
}
```

### 3.2 Deprecation Header Strategy

```typescript
/**
 * Generate deprecation headers for legacy parameter usage
 * Implements RFC 8594 (Sunset) pattern
 */
export interface DeprecationHeaders {
  'Deprecation': string
  'Link'?: string
  'Sunset'?: string
}

export function generateDeprecationHeaders(
  legacyParam: string | null,
  migrationDocsUrl: string = '/docs/api/migration#response-format'
): DeprecationHeaders | null {
  if (!legacyParam) return null

  const headers: DeprecationHeaders = {
    'Deprecation': 'true',
    'Link': `<${migrationDocsUrl}>; rel="deprecation"`
  }

  // Add Sunset header when we decide on removal date
  // For now, omit to keep options open
  // headers['Sunset'] = 'Sat, 01 Jan 2026 00:00:00 GMT'

  return headers
}

/**
 * Apply deprecation headers to response
 * Works with both Fastify and standard HTTP responses
 */
export function applyDeprecationHeaders(
  reply: any,  // Fastify reply or standard response
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

## 4. REST Endpoint Architecture

### 4.1 Query Parameter Schema

```typescript
/**
 * Standard querystring schema for list endpoints
 */
const listQuerySchema = {
  type: 'object',
  properties: {
    // Pagination
    limit: { type: 'number', default: 50, maximum: 200 },
    offset: { type: 'number', default: 0, minimum: 0 },

    // Sorting
    sortBy: {
      type: 'string',
      enum: ['url', 'updated', 'observationCount', 'lastSeen'],
      default: 'url'
    },
    sortOrder: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'asc'
    },

    // Response shaping (NEW)
    format: {
      type: 'string',
      enum: ['full', 'detailed', 'simple'],
      default: 'detailed',
      description: 'Response format: full (with attribution), detailed (no attribution), simple (URLs only)'
    },

    // Legacy parameter (DEPRECATED)
    compact: {
      type: 'boolean',
      description: 'DEPRECATED: Use format=detailed|full instead. Maps to detailed (true) or full (false).'
    }
  }
}

/**
 * Standard querystring schema for single-object endpoints
 */
const singleQuerySchema = {
  type: 'object',
  properties: {
    relayUrl: {
      type: 'string',
      format: 'uri',
      description: 'Relay URL to query'
    },

    // Response shaping (NEW)
    format: {
      type: 'string',
      enum: ['full', 'detailed'],  // No 'simple' for single objects
      default: 'detailed',
      description: 'Response format: full (with attribution) or detailed (no attribution)'
    },

    // Legacy parameter (DEPRECATED)
    compact: {
      type: 'boolean',
      description: 'DEPRECATED: Use format=detailed|full instead.'
    }
  },
  required: ['relayUrl']
}
```

### 4.2 Response Schema Architecture (OpenAPI)

```typescript
/**
 * List endpoint response schema (oneOf pattern)
 */
const listResponseSchema = {
  oneOf: [
    {
      // format=full
      type: 'object',
      properties: {
        relays: {
          type: 'array',
          items: { $ref: '#/components/schemas/RelayState' }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' }
      },
      description: 'Full relay states with attribution (format=full)'
    },
    {
      // format=detailed
      type: 'object',
      properties: {
        relays: {
          type: 'array',
          items: { $ref: '#/components/schemas/DetailedRelayState' }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' }
      },
      description: 'Detailed relay states without attribution (format=detailed, default)'
    },
    {
      // format=simple
      type: 'object',
      properties: {
        relays: {
          type: 'array',
          items: { type: 'string', format: 'uri' }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' }
      },
      description: 'Simple relay URL list (format=simple)'
    }
  ]
}

/**
 * Single endpoint response schema (oneOf pattern)
 */
const singleResponseSchema = {
  oneOf: [
    {
      $ref: '#/components/schemas/RelayState',
      description: 'Full relay state with attribution (format=full)'
    },
    {
      $ref: '#/components/schemas/DetailedRelayState',
      description: 'Detailed relay state without attribution (format=detailed, default)'
    }
  ]
}
```

### 4.3 Handler Pattern

```typescript
/**
 * Standard list endpoint handler pattern
 */
async function listEndpointHandler(request, reply) {
  // 1. Parse format parameters
  const parsed = parseResponseFormat(
    request.query.format,
    request.query.compact
  )

  // 2. Apply deprecation headers if legacy params used
  applyDeprecationHeaders(reply, parsed)

  // 3. Query data (always get full states from core)
  const states = core.query.relays.getAll()

  // 4. Apply pagination, sorting, filtering (on full states)
  const paged = applyPaginationAndSorting(states, request.query)

  // 5. Apply shape transformation
  const shaped = applyShapeList(paged, parsed.shape)

  // 6. Return wrapped response
  return {
    relays: shaped,
    total: states.length,
    limit: request.query.limit,
    offset: request.query.offset
  }
}

/**
 * Standard single-object endpoint handler pattern
 */
async function singleEndpointHandler(request, reply) {
  // 1. Parse format parameters
  const parsed = parseResponseFormat(
    request.query.format,
    request.query.compact
  )

  // 2. Apply deprecation headers if legacy params used
  applyDeprecationHeaders(reply, parsed)

  // 3. Query data (get full state from core)
  const state = core.query.relays.getState(request.query.relayUrl)

  if (!state) {
    return reply.code(404).send({ error: 'Relay not found' })
  }

  // 4. Apply shape transformation
  const shaped = applyShapeSingle(state, parsed.shape)

  // 5. Return shaped state
  return shaped
}
```

---

## 5. CVM Tools Architecture

### 5.1 Schema Extensions

```typescript
/**
 * Update tool input schemas to include new format parameter
 */
const toolInputSchemaBase = {
  type: 'object',
  properties: {
    // Tool-specific parameters...

    // Response shaping (NEW)
    format: {
      type: 'string',
      enum: ['full', 'detailed', 'simple'],
      default: 'detailed',
      description: 'Response format: full (with attribution), detailed (no attribution), simple (URLs only for lists)'
    }
  }
}

/**
 * List-returning tools use this schema variant
 */
const listToolInputSchema = {
  ...toolInputSchemaBase,
  properties: {
    ...toolInputSchemaBase.properties,
    format: {
      type: 'string',
      enum: ['full', 'detailed', 'simple'],  // All three allowed
      default: 'detailed'
    }
  }
}

/**
 * Single-object tools use this schema variant
 */
const singleToolInputSchema = {
  ...toolInputSchemaBase,
  properties: {
    ...toolInputSchemaBase.properties,
    format: {
      type: 'string',
      enum: ['full', 'detailed'],  // No 'simple'
      default: 'detailed'
    }
  }
}
```

### 5.2 Tool Handler Pattern

```typescript
/**
 * Create list-returning tool with format support
 */
export function createListTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/list',
    description: 'Get relay list with format support',
    inputSchema: listToolInputSchema,
    outputSchema: listToolOutputSchema,  // oneOf variant

    handler: async (input: RelaysListInput): Promise<RelaysListOutput> => {
      // 1. Parse format (no deprecation headers in MCP context)
      const parsed = parseResponseFormat(input.format)

      // 2. Query data (full states)
      const states = ctx.core.query.relays.getAll()

      // 3. Apply filtering, pagination
      const filtered = applyFilters(states, input)

      // 4. Apply shape transformation
      const shaped = applyShapeList(filtered, parsed.shape)

      // 5. Return typed output
      return {
        relays: shaped as any,  // oneOf union type
        total: states.length
      }
    }
  }
}

/**
 * Create single-object tool with format support
 */
export function createSingleTool(ctx: RelayToolsContext): CVMTool {
  return {
    name: 'relays/state',
    description: 'Get single relay state with format support',
    inputSchema: singleToolInputSchema,
    outputSchema: singleToolOutputSchema,  // oneOf variant

    handler: async (input: RelaysGetStateInput): Promise<RelaysGetStateOutput> => {
      // 1. Parse format
      const parsed = parseResponseFormat(input.format)

      // 2. Query data
      const state = ctx.core.query.relays.getState(input.relayUrl)

      if (!state) {
        throw new Error('Relay not found')
      }

      // 3. Apply shape transformation
      const shaped = applyShapeSingle(state, parsed.shape)

      // 4. Return typed output
      return shaped as any  // oneOf union type
    }
  }
}
```

---

## 6. Migration Compatibility Matrix

| Input Parameters | Resulting Shape | Is Legacy? | Deprecation Header? | Notes |
|-----------------|-----------------|------------|---------------------|-------|
| `format=full` | `full` | No | No | Preferred new format |
| `format=detailed` | `detailed` | No | No | Preferred new format (default) |
| `format=simple` | `simple` | No | No | Preferred new format (lists only) |
| `format=compact` | `detailed` | Yes | Yes | Maps to detailed in this milestone |
| `compact=true` | `detailed` | Yes | Yes | Legacy boolean parameter |
| `compact=false` | `full` | Yes | Yes | Legacy boolean parameter |
| (no params) | `detailed` | No | No | Conservative default |

### 6.1 Future Migration Path

**Phase 1 (Current Milestone):**
- Accept all parameters
- `format=compact` → maps to `detailed`
- Emit deprecation headers for legacy usage
- No breaking changes

**Phase 2 (Future Minor Release):**
- Maintain Phase 1 behavior
- Add `Sunset` header with specific date
- Update documentation with migration timeline

**Phase 3 (Future Major Release):**
- Optionally remap `format=compact` → `simple` (breaking change)
- Continue accepting legacy boolean `compact`
- Update OpenAPI specs to reflect new mapping

---

## 7. Testing Architecture

### 7.1 Unit Tests (Shaping Utilities)

```typescript
describe('Shaping Utilities', () => {
  describe('toDetailed()', () => {
    it('should remove contributingAuthors from all fields', () => {
      const full = createFullRelayState()
      const detailed = toDetailed(full)

      expect(detailed).not.toHaveProperty('network.contributingAuthors')
      expect(detailed).not.toHaveProperty('software.family.contributingAuthors')
      expect(detailed).not.toHaveProperty('geo.authors')
    })

    it('should preserve all aggregated data', () => {
      const full = createFullRelayState()
      const detailed = toDetailed(full)

      expect(detailed.network?.value).toEqual(full.network?.value)
      expect(detailed.network?.support).toEqual(full.network?.support)
      expect(detailed.network?.sampleSize).toEqual(full.network?.sampleSize)
    })
  })

  describe('toSimpleList()', () => {
    it('should extract only relay URLs', () => {
      const states = [
        createFullRelayState('wss://relay1.com'),
        createFullRelayState('wss://relay2.com')
      ]

      const simple = toSimpleList(states)

      expect(simple).toEqual(['wss://relay1.com', 'wss://relay2.com'])
      expect(simple).toHaveLength(2)
    })

    it('should preserve ordering', () => {
      const states = createMultipleStates(100)
      const simple = toSimpleList(states)

      states.forEach((state, i) => {
        expect(simple[i]).toBe(state.relayUrl)
      })
    })
  })

  describe('parseResponseFormat()', () => {
    it('should parse new format parameters', () => {
      expect(parseResponseFormat('full')).toEqual({
        shape: 'full',
        isLegacy: false,
        legacyParam: null
      })
    })

    it('should handle legacy format=compact', () => {
      expect(parseResponseFormat('compact')).toEqual({
        shape: 'detailed',
        isLegacy: true,
        legacyParam: 'format=compact'
      })
    })

    it('should handle legacy boolean compact', () => {
      expect(parseResponseFormat(undefined, true)).toEqual({
        shape: 'detailed',
        isLegacy: true,
        legacyParam: 'compact=true'
      })

      expect(parseResponseFormat(undefined, false)).toEqual({
        shape: 'full',
        isLegacy: true,
        legacyParam: 'compact=false'
      })
    })
  })
})
```

### 7.2 Integration Tests (REST Endpoints)

```typescript
describe('REST /relays Endpoint', () => {
  describe('format=full', () => {
    it('should return full relay states with attribution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=full&limit=5'
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      expect(data.relays[0]).toHaveProperty('network.contributingAuthors')
      expect(data.relays[0]).toHaveProperty('geo.authors')
    })
  })

  describe('format=detailed', () => {
    it('should return detailed states without attribution', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=detailed&limit=5'
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      expect(data.relays[0]).not.toHaveProperty('network.contributingAuthors')
      expect(data.relays[0]).toHaveProperty('network.value')
    })
  })

  describe('format=simple', () => {
    it('should return only relay URLs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=simple&limit=5'
      })

      expect(response.statusCode).toBe(200)
      const data = response.json()

      expect(data.relays).toBeInstanceOf(Array)
      expect(typeof data.relays[0]).toBe('string')
      expect(data.relays[0]).toMatch(/^wss?:\/\//)
    })
  })

  describe('Legacy Parameters', () => {
    it('should handle format=compact with deprecation header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?format=compact&limit=5'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['deprecation']).toBe('true')
      expect(response.headers['link']).toContain('rel="deprecation"')

      // Should return detailed format
      const data = response.json()
      expect(data.relays[0]).not.toHaveProperty('network.contributingAuthors')
    })

    it('should handle compact=true boolean with deprecation header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/relays?compact=true&limit=5'
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['deprecation']).toBe('true')
    })
  })
})
```

### 7.3 Integration Tests (CVM Tools)

```typescript
describe('CVM relays/list Tool', () => {
  const tool = createRelaysListTool({ core })

  describe('format shapes', () => {
    it('should return full states when format=full', async () => {
      const result = await tool.handler({
        format: 'full',
        limit: 5
      })

      expect(result.relays[0]).toHaveProperty('network.contributingAuthors')
    })

    it('should return detailed states when format=detailed', async () => {
      const result = await tool.handler({
        format: 'detailed',
        limit: 5
      })

      expect(result.relays[0]).not.toHaveProperty('network.contributingAuthors')
      expect(result.relays[0]).toHaveProperty('network.value')
    })

    it('should return URL strings when format=simple', async () => {
      const result = await tool.handler({
        format: 'simple',
        limit: 5
      })

      expect(typeof result.relays[0]).toBe('string')
      expect(result.relays[0]).toMatch(/^wss?:\/\//)
    })
  })
})
```

### 7.4 Schema Conformance Tests

```typescript
describe('OpenAPI Schema Conformance', () => {
  const ajv = new Ajv()
  const listSchema = loadSchema('relays-list-output.json')
  const singleSchema = loadSchema('relays-get-state-output.json')

  describe('List responses', () => {
    it('should validate full format response', async () => {
      const response = await getListResponse({ format: 'full' })
      const validate = ajv.compile(listSchema)

      expect(validate(response)).toBe(true)
    })

    it('should validate detailed format response', async () => {
      const response = await getListResponse({ format: 'detailed' })
      const validate = ajv.compile(listSchema)

      expect(validate(response)).toBe(true)
    })

    it('should validate simple format response', async () => {
      const response = await getListResponse({ format: 'simple' })
      const validate = ajv.compile(listSchema)

      expect(validate(response)).toBe(true)
    })
  })
})
```

---

## 8. File Structure & Organization

### 8.1 New/Modified Files

```
src/
├── types/
│   ├── response-formats.ts         [MODIFIED] Add ResponseShape, new helpers
│   └── tool-schemas.ts              [MODIFIED] Update input/output types
├── utils/
│   ├── compact.ts                   [DEPRECATED] Will redirect to response-formats.ts
│   └── response-parsing.ts          [NEW] parseResponseFormat(), deprecation headers
├── rest/
│   ├── routes/relays.ts             [MODIFIED] Use new parsing, shapes, headers
│   └── schemas.ts                   [MODIFIED] Update response schemas with oneOf
├── tools/
│   └── relays.ts                    [MODIFIED] Use new parsing and shapes
└── schemas/                         [MODIFIED] Update JSON schemas with oneOf
    ├── relays-list-output.json
    ├── relays-get-state-output.json
    ├── relays-by-label-output.json
    └── ... (all list/single endpoint schemas)

test/
├── unit/
│   ├── shaping-utilities.test.ts   [NEW] Test toDetailed, toSimple, parsing
│   └── deprecation-headers.test.ts [NEW] Test header generation
├── integration/
│   ├── rest-format-shapes.test.ts  [NEW] Test REST with all formats
│   └── tool-format-shapes.test.ts  [NEW] Test CVM tools with all formats
└── schema/
    └── openapi-conformance.test.ts [NEW] Validate oneOf schemas
```

### 8.2 Implementation Order

1. **Phase 1: Type System** (src/types/response-formats.ts)
   - Add ResponseShape type
   - Implement toDetailed, toSimple, toFull helpers
   - Add applyShapeSingle, applyShapeList unified API

2. **Phase 2: Parsing & Headers** (src/utils/response-parsing.ts)
   - Implement parseResponseFormat()
   - Implement generateDeprecationHeaders()
   - Implement applyDeprecationHeaders()

3. **Phase 3: REST Integration** (src/rest/routes/relays.ts)
   - Update query schemas
   - Update handlers to use parsing and shaping
   - Apply deprecation headers

4. **Phase 4: CVM Tools** (src/tools/relays.ts)
   - Update tool input schemas
   - Update handlers to use parsing and shaping

5. **Phase 5: Schemas** (src/schemas/*.json, src/rest/schemas.ts)
   - Update JSON schemas with oneOf variants
   - Add clear descriptions for each variant

6. **Phase 6: Tests** (test/)
   - Unit tests for utilities
   - Integration tests for REST
   - Integration tests for tools
   - Schema conformance tests

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
- `full` format includes contributor identities
- Ensure consumers understand privacy implications
- Consider rate limiting on `full` format (future)

**Header Injection:**
- Deprecation headers are static strings
- No user input in header values
- Safe from injection attacks

### 9.4 Caching Strategy

**Cache Key Structure:**
```
cache:relays:list:{limit}:{offset}:{sortBy}:{format}
cache:relays:state:{relayUrl}:{format}
```

**Cache Invalidation:**
- Full and detailed formats share same data source
- Invalidate all format variants when relay state changes
- Simple format can have separate TTL (more cacheable)

---

## 10. Documentation Requirements

### 10.1 API Documentation Updates

**Required Sections:**
1. **Response Format Guide**
   - Explain full, detailed, simple
   - Show example responses for each
   - Explain use cases

2. **Migration Guide**
   - How to migrate from `compact` boolean
   - How to migrate from `format=compact`
   - Timeline for deprecation

3. **OpenAPI/Swagger Updates**
   - Update all endpoint schemas
   - Add `oneOf` discriminated unions
   - Add clear descriptions

### 10.2 Code Documentation

**Required Documentation:**
- TSDoc comments on all new functions
- Architecture decision record (this document)
- README section on response formats
- CHANGELOG entry for this milestone

---

## 11. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Client breakage from format changes | Low | High | Maintain backward compatibility, emit headers |
| OpenAPI schema complexity | Medium | Medium | Use clear descriptions, test with codegen tools |
| Performance degradation | Low | Medium | Profile shaping functions, add benchmarks |
| Confusion over three formats | Medium | Low | Clear documentation, sensible defaults |
| Future compact→simple remap | Medium | High | Deprecation window, Sunset headers, major version |

---

## 12. Success Criteria

### 12.1 Functional Requirements
- [ ] Single `format` parameter supports all three shapes
- [ ] Legacy `compact` boolean still works
- [ ] Legacy `format=compact` string still works
- [ ] Deprecation headers emitted for legacy usage
- [ ] List endpoints return string[] when format=simple
- [ ] Single endpoints handle simple as detailed
- [ ] All tests pass with 90%+ coverage

### 12.2 Non-Functional Requirements
- [ ] Performance within 5% of current baseline
- [ ] OpenAPI schemas validate with standard tools
- [ ] ctxcn codegen produces usable TypeScript clients
- [ ] Documentation complete and clear
- [ ] No breaking changes to existing consumers

### 12.3 Quality Gates
- [ ] Code review approval from 2+ engineers
- [ ] All automated tests passing
- [ ] Manual testing with representative payloads
- [ ] OpenAPI validation with Swagger Editor
- [ ] Load testing shows acceptable performance

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

### A.1 List Endpoint - format=full
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
  "limit": 50,
  "offset": 0
}
```

### A.2 List Endpoint - format=detailed
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
  "limit": 50,
  "offset": 0
}
```

### A.3 List Endpoint - format=simple
```json
{
  "relays": [
    "wss://relay.example.com",
    "wss://relay2.example.com",
    "wss://relay3.example.com"
  ],
  "total": 1250,
  "limit": 50,
  "offset": 0
}
```

### A.4 Single Endpoint - format=full
```json
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
  }
}
```

### A.5 Single Endpoint - format=detailed (or simple)
```json
{
  "relayUrl": "wss://relay.example.com",
  "updated_at": 1698765432000,
  "observationCount": 150,
  "network": {
    "value": "clearnet",
    "support": 0.98,
    "sampleSize": 147,
    "lastUpdated": 1698765000000
  }
}
```

---

## Appendix B: OpenAPI Schema Snippets

### B.1 List Response Schema
```yaml
RelayListResponse:
  oneOf:
    - type: object
      description: Full format with attribution (format=full)
      properties:
        relays:
          type: array
          items:
            $ref: '#/components/schemas/RelayState'
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer

    - type: object
      description: Detailed format without attribution (format=detailed, default)
      properties:
        relays:
          type: array
          items:
            $ref: '#/components/schemas/DetailedRelayState'
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer

    - type: object
      description: Simple format with URL strings only (format=simple)
      properties:
        relays:
          type: array
          items:
            type: string
            format: uri
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
```

### B.2 Query Parameter Schema
```yaml
format:
  in: query
  name: format
  schema:
    type: string
    enum: [full, detailed, simple]
    default: detailed
  description: |
    Response format:
    - `full`: Includes contributor attribution data
    - `detailed`: Excludes attribution (default, balanced size/detail)
    - `simple`: URL strings only (for list endpoints)
```

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

---

**End of Architecture Document**
