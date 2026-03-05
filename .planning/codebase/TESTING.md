# Testing Patterns

**Analysis Date:** 2026-03-04

## Test Framework

**Runner:**
- Vitest (configured in `vitest.config.js`)
- Config: `/home/sandwich/Develop/nostr-watch/vitest.config.js`

**Assertion Library:**
- Vitest's built-in `expect()` API

**Run Commands:**
```bash
npm run test              # Run all tests
npm run test -- --watch  # Watch mode
npm run test -- --coverage # Coverage report
```

## Test File Organization

**Location:**
- Co-located with source files in same directory
- Pattern: `src/module.ts` paired with `src/module.test.ts`

**Naming:**
- `.test.ts` suffix for test files
- Examples: `string.test.ts`, `array.test.ts`, `ClientHandler.test.ts`, `ServerHandler.test.ts`

**Structure:**
```
libraries/
├── auditor/src/
│   ├── utils/
│   │   ├── string.ts
│   │   └── string.test.ts
│   ├── base/
│   │   ├── Auditor.ts
│   │   └── [tests elsewhere]
├── negentropy/src/
│   ├── ClientHandler.ts
│   ├── ClientHandler.test.ts
│   ├── ServerHandler.ts
│   └── ServerHandler.test.ts
├── nocap-route66/src/
│   ├── Transform.ts
│   └── Transform.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { functionName } from './module'

describe('module name', () => {
  describe('specific function', () => {
    it('should do something specific', () => {
      expect(result).toBe(expectedValue)
    })
  })
})
```

**Patterns:**

- Top-level `describe()` names module or feature: `describe('string utils', () => { ... })`
- Nested `describe()` for function grouping: `describe('capitalize', () => { ... })`
- Individual `it()` statements for specific behaviors
- Assertion-focused test names: "should", "must", "will"

## Mocking

**Framework:** Vitest's `vi` object

**Patterns:**

Basic mock setup:
```typescript
vi.mock('./Trawler', () => {
  return {
    default: class {
      constructor(relays: string[], options: any) {
        this.relays = relays
        this.options = options
      }
      openCache = vi.fn().mockResolvedValue(undefined)
      chunk_relays = vi.fn().mockReturnValue([['wss://relay1.com']])
      trawl = vi.fn().mockResolvedValue(undefined)
    }
  }
})
```

Function mocking with return values:
```typescript
const mockMath = Object.create(global.Math)
mockMath.random = vi.fn()
  .mockReturnValueOnce(0.5)
  .mockReturnValueOnce(0.1)
  .mockReturnValueOnce(0.9)
global.Math = mockMath
```

Method spying:
```typescript
const pauseSpy = vi.spyOn(mockQueue, 'pause')
expect(pauseSpy).toHaveBeenCalledWith('test')
```

**What to Mock:**
- External service dependencies (database, API clients)
- Complex class dependencies in integration tests
- WebSocket implementations
- EventEmitter behaviors
- Timer functions for async testing

**What NOT to Mock:**
- Pure utility functions with side effects
- Core data transformation logic
- Validation functions
- The module under test itself

## Fixtures and Factories

**Test Data:**
- Inline test data defined in test file
- Example array fixture:
  ```typescript
  const array = [1, 2, 3, 4, 5]
  const shuffled = shuffleArray([...array])
  expect(shuffled).toHaveLength(array.length)
  ```
- Options/config fixtures:
  ```typescript
  const options: TrawlerOptions = {
    queueName: 'testQueue',
    repeatWhenComplete: true,
    restDuration: 1000
  }
  ```

**Location:**
- No dedicated fixture files observed
- Fixtures defined in test files near point of use
- Setup in `beforeEach()` or within individual tests

## Coverage

**Requirements:** Not enforced (no config detected)

**View Coverage:**
```bash
npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and methods
- Approach: Test inputs/outputs with various data scenarios
- Example: `capitalize('hello')` tests uppercase behavior, edge cases (empty strings, single chars)
- Mocking: Mock external dependencies but test function logic directly

**Integration Tests:**
- Scope: Component/class interaction with mocked dependencies
- Approach: Test method sequences, state changes, event emissions
- Example: `NTQueue` tests initialization, callback registration, event handling
- Mocking: Mock sub-components but test orchestration logic

**E2E Tests:**
- Framework: Not observed in codebase
- Status: Not used currently

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})

// With beforeEach/afterEach for setup/teardown
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})
```

**Error Testing:**
```typescript
it('should return false for invalid input', () => {
  expect(is64CharHex('g'.repeat(64))).toBe(false)
  expect(is64CharHex('a'.repeat(63))).toBe(false)
})

// Promise rejection testing
it('should reject when connection fails', async () => {
  const result = await asyncOperation()
  // Assert error state or rejection
})
```

**Conditional Logic Testing:**
```typescript
it('should not truncate strings shorter than maxLength', () => {
  expect(truncate('short string', 64)).toBe('short string')
})

it('should truncate strings longer than maxLength', () => {
  const longString = 'a'.repeat(100)
  expect(truncate(longString, 10)).toBe('a'.repeat(7) + '...')
})

// Test default parameters
it('should use default maxLength of 64', () => {
  const longString = 'a'.repeat(100)
  expect(truncate(longString)).toBe('a'.repeat(61) + '...')
})
```

**State Management Testing:**
```typescript
it('should initialize with the correct options', () => {
  expect(queue).toBeDefined()
  expect(queue['relays']).toEqual(relays)
  expect(queue['options']).toEqual(expect.objectContaining(options))
})

it('should update state after method call', async () => {
  queue['repeatTimeout'] = null
  await queue['handle_queue_drained']({ id: 1 }, { result: 'success' })
  expect(queue['repeatTimeout']).not.toBeNull()
})
```

**Callback Testing:**
```typescript
it('should register callbacks with legacyOn method', () => {
  const callback = vi.fn()
  queue.legacyOn('test_event', callback)
  expect(queue['cb']['test_event']).toBe(callback)
})

it('should call registered callbacks', async () => {
  const callback = vi.fn()
  queue.legacyOn('test_event', callback)
  await queue['_on']('test_event', 'arg1', 'arg2')
  expect(callback).toHaveBeenCalledWith('arg1', 'arg2')
})
```

## Special Test Features

**Vitest-Specific:**
- Mock hoisting: `vi.mock()` declarations at top of file
- Real timers control: `vi.useFakeTimers()`, `vi.useRealTimers()`
- Mock clearing: `vi.clearAllMocks()`
- Function spying: `vi.spyOn(object, 'method')`
- Return value sequences: `mockReturnValueOnce()` for sequential calls

**Test Exclusions:**
- Vitest config excludes `node_modules` and `packages/logger` (line 9-10 in config)
- Pattern: `testMatch: ['<rootDir>/src/**/*.test.js']`

---

*Testing analysis: 2026-03-04*
