# Compact Mode Testing Documentation

## Overview

The compact mode feature adds an optional `compact` parameter to relay state endpoints that removes `contributingAuthors` and `authors` fields from responses. This reduces response size while preserving all essential relay state information.

## Implementation Details

### Affected Endpoints

All endpoints returning relay state data support the `compact` parameter:

- `GET /relays` - List all relays with pagination
- `POST /relays/search` - Search relays with filters
- `GET /relays/nearby` - Find relays near a geographic point
- `GET /relays/bbox` - Find relays in a bounding box
- `GET /relays/by/label` - Find relays by label
- `GET /relays/by/nip` - Group relays by NIP support
- `GET /relays/by/country` - Group relays by country
- `GET /relays/by/software` - Group relays by software
- `GET /relays/by/network` - Group relays by network type

### Parameter Format

- **Query Parameter**: `?compact=true` or `?compact=false`
- **POST Body Parameter**: `{ "compact": true }` or `{ "compact": false }`
- **Default**: `false` (returns full data including contributor information)

### Data Removed in Compact Mode

The compact mode recursively removes the following fields from responses:

- `contributingAuthors` - Arrays of monitor pubkeys that contributed to each field
- `authors` - Alternative field name for contributor information

### Defense-in-Depth

The implementation uses a recursive sanitization approach to ensure contributor fields are removed from:
- Top-level relay state objects
- Nested objects (network, software, rtt, etc.)
- Deeply nested structures
- Array elements

## Test Suite

### Test Files

1. **`test/compact-mode.test.ts`** - Core compact mode functionality
   - Parameter handling (query string and POST body)
   - Contributor field removal validation
   - Essential data preservation
   - Defense-in-depth recursive removal
   - Edge cases (empty results, invalid parameters)

2. **`test/performance-compact.test.ts`** - Performance benchmarks
   - Response size comparison
   - Processing time comparison
   - Bandwidth savings analysis
   - Scalability testing with large datasets

### Test Coverage

#### Functional Tests

✅ **Parameter Handling**
- Accepts `compact=true` query parameter
- Accepts `compact=false` query parameter
- Accepts compact in POST body
- Handles missing parameter (defaults to false)
- Handles invalid parameter values gracefully

✅ **Data Removal**
- Removes contributingAuthors from all fields
- Removes authors from all fields
- Recursively sanitizes nested objects
- Sanitizes array elements
- Defense-in-depth validation

✅ **Data Preservation**
- Preserves relayUrl
- Preserves observationCount
- Preserves updated_at timestamp
- Preserves network information
- Preserves software information
- Preserves RTT measurements
- Preserves NIP support data
- Preserves labels
- Preserves geo location data
- Preserves requirements
- Preserves IP addresses
- Preserves country information

✅ **Endpoint Coverage**
- GET /relays with compact parameter
- POST /relays/search with compact parameter
- GET /relays/nearby with compact parameter
- GET /relays/bbox with compact parameter
- GET /relays/by/label with compact parameter

#### Performance Tests

✅ **Response Size**
- Measures byte size difference between full and compact
- Validates compact responses are smaller or equal
- Calculates percentage reduction
- Tests across different result set sizes

✅ **Processing Time**
- Benchmarks full vs compact mode response times
- Validates both modes complete in reasonable time (<1s)
- Tests with various query complexities
- Includes warmup iterations for accurate measurement

✅ **Scalability**
- Tests with 10, 50, 100, 200 result sets
- Tests with complex multi-filter queries
- Validates performance under load

### Running Tests

```bash
# Run all tests
npm test

# Run compact mode tests only
npm test compact-mode

# Run performance tests only
npm test performance-compact

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Expected Results

#### Response Size Reduction

Typical bandwidth savings depend on the number of contributing monitors:

- **1-2 monitors**: 5-15% reduction
- **3-5 monitors**: 15-30% reduction
- **5+ monitors**: 30-50% reduction

#### Performance Impact

Compact mode adds minimal processing overhead:

- **Additional processing**: < 5ms for typical queries
- **Total response time**: < 100ms for most queries
- **Large result sets (200+)**: < 500ms

### Integration with Existing Tests

Existing test suites remain unchanged because:

1. **Default Behavior**: Without the `compact` parameter, responses include full data
2. **Backward Compatibility**: All existing tests pass without modification
3. **Core Functionality**: StateCore query methods are unchanged
4. **Tool Parity**: MCP tools return full data (no compact mode)

### Test Data

Test suites use seeded data with:
- Multiple monitors (2-5) for realistic contributor data
- Multiple relays (10-20) for pagination testing
- Various networks (clearnet, tor) for filter testing
- Multiple NIPs and software types for search testing

## Validation Checklist

When reviewing compact mode implementation:

- [ ] All endpoints support compact parameter
- [ ] Parameter is optional with sensible default
- [ ] Contributor fields are completely removed
- [ ] Essential relay data is preserved
- [ ] Recursive sanitization works for nested objects
- [ ] Response size is reduced as expected
- [ ] Performance impact is minimal
- [ ] Edge cases are handled gracefully
- [ ] Backward compatibility is maintained
- [ ] Documentation is complete

## Future Enhancements

Potential improvements to consider:

1. **Server-Side Configuration**: Allow operators to set default compact mode
2. **Conditional Formatting**: Support partial field removal
3. **Compression**: Combine with gzip compression for additional savings
4. **Caching**: Cache both full and compact responses separately
5. **Metrics**: Track compact mode usage and bandwidth savings

## Related Documentation

- [REST API Documentation](../src/rest/README.md)
- [Aggregation Policy](../src/types/aggregation.ts)
- [Compact Utilities](../src/utils/compact.ts)
- [Test Strategy](./test-strategy.md)
