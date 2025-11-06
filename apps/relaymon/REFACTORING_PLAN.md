# RelayMon Refactoring Plan - Methodical, Test-Driven Approach

## Executive Summary

This plan outlines a **zero-regression** refactoring strategy for RelayMon, using a methodical, test-first approach. Every change includes companion unit/integration tests and build verification.

**Approach:** Test-Driven Refactoring (TDR)
**Risk:** Low (each change isolated and verified)
**Regression Prevention:** Comprehensive test coverage at each step

---

## Core Principles

1. **Test First, Always** - Write test before making ANY change
2. **One Change At A Time** - Never combine refactorings
3. **Green-Green-Refactor** - Tests must pass before AND after each change
4. **Build After Each Unit** - Verify `deno task build` succeeds after each step
5. **Document Everything** - Update docs for every API change
6. **No Breaking Changes** - Maintain backward compatibility throughout

---

## Phase 0: Preparation

### Objective: Establish testing infrastructure and baseline

### 0.1 Create Test Infrastructure

**Files to create:**
- `tests/helpers/fixtures.ts` - Shared test fixtures
- `tests/helpers/mocks.ts` - Mock implementations
- `tests/helpers/assertions.ts` - Custom assertions
- `tests/integration/baseline.test.ts` - Baseline integration test

**Test fixtures needed:**
```typescript
// tests/helpers/fixtures.ts
export const mockConfig = {
  monitor: { slug: "test-monitor", ... },
  relaymon: { networks: ["clearnet"], ... }
};

export const mockRelayResult = {
  url: "wss://relay.example.com",
  hostname: "relay.example.com",
  protocol: "wss:",
  open: { data: true, duration: 100 },
  info: { data: { name: "Test Relay" } }
};

export const mockRelayResultWithPath = {
  url: "wss://relay.example.com/path",
  hostname: "relay.example.com",
  protocol: "wss:",
  // ...
};
```

**Deliverables:**
- [ ] Test fixture library
- [ ] Mock implementations for all external dependencies
- [ ] Baseline integration test that exercises full daemon lifecycle
- [ ] Test coverage report baseline (run `deno coverage`)

**Success Criteria:**
- ✅ All existing tests pass
- ✅ `deno test` completes successfully
- ✅ `deno task build` succeeds
- ✅ Coverage report generated

---

## Phase 1: Type Safety Foundation

### Objective: Eliminate `any` types and establish type safety

### 1.1 Create Strong Type Definitions

**Step 1.1.1: Config Types**

**Test File:** `tests/unit/config-types.test.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";
import { Config, validateConfig } from "../../src/config/types.ts";

Deno.test("Config validation - valid config passes", () => {
  const validConfig: Config = {
    monitor: {
      slug: "test",
      info: { name: "Test", about: "Test monitor" },
      owner: "pubkey"
    },
    // ... complete valid config
  };

  const result = validateConfig(validConfig);
  assertExists(result);
  assertEquals(result.monitor.slug, "test");
});

Deno.test("Config validation - missing required field throws", () => {
  const invalidConfig = {
    monitor: { slug: "test" }
    // missing required fields
  };

  assertThrows(
    () => validateConfig(invalidConfig as any),
    Error,
    "Missing required field"
  );
});
```

**Implementation File:** `src/config/types.ts`

```typescript
// Define strict types for all config sections
export interface MonitorConfig {
  slug: string;
  info: {
    name: string;
    about: string;
    nip05?: string;
  };
  owner: string;
  geo?: GeoConfig;
}

export interface RelaymonConfig {
  networks: NetworkType[];
  retry: RetryConfig;
  seed: SeedConfig;
  checks: ChecksConfig;
  ignorelist?: IgnoreListConfig;
  deduplication?: DeduplicationConfig;
}

export interface Config {
  monitor: MonitorConfig;
  publisher: PublisherConfig;
  relaymon: RelaymonConfig;
  queue?: QueueConfig;
  logLevel?: LogLevel;
}

// Runtime validation function
export function validateConfig(config: unknown): Config {
  if (!config || typeof config !== "object") {
    throw new Error("Config must be an object");
  }

  const c = config as any;

  // Validate required fields
  if (!c.monitor?.slug) throw new Error("Missing monitor.slug");
  if (!c.monitor?.info?.name) throw new Error("Missing monitor.info.name");
  if (!c.monitor?.owner) throw new Error("Missing monitor.owner");
  // ... validate all required fields

  return c as Config;
}
```

**Refactoring Steps:**
1. Write tests for config validation (as shown above)
2. Create `src/config/types.ts` with all type definitions
3. Implement `validateConfig()` function
4. Run tests: `deno test tests/unit/config-types.test.ts`
5. Update `src/config/config.ts` to use `validateConfig()`
6. Replace `any` with `Config` type throughout codebase
7. Run full test suite: `deno test`
8. Build: `deno task build`
9. Commit: "feat(types): add strict Config type definitions and validation"

**Deliverables:**
- [ ] `src/config/types.ts` - Complete type definitions
- [ ] `tests/unit/config-types.test.ts` - Validation tests
- [ ] All `config: any` replaced with `config: Config`

**Success Criteria:**
- ✅ All tests pass
- ✅ Build succeeds
- ✅ No `config: any` in codebase
- ✅ Runtime config validation catches errors

---

**Step 1.1.2: Relay Result Types**

**Test File:** `tests/unit/relay-types.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { RelayCheckResult, validateRelayResult } from "../../src/types/relay.ts";

Deno.test("RelayCheckResult - valid result passes validation", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    open: { data: true, duration: 100 },
    checked_at: Date.now()
  };

  const validated = validateRelayResult(result);
  assertEquals(validated.url, result.url);
});

Deno.test("RelayCheckResult - optional fields handled correctly", () => {
  const result: RelayCheckResult = {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    open: { data: false, duration: 0 },
    checked_at: Date.now(),
    info: {
      data: { name: "Test Relay" },
      duration: 50
    }
  };

  const validated = validateRelayResult(result);
  assertEquals(validated.info?.data.name, "Test Relay");
});
```

**Implementation File:** `src/types/relay.ts`

```typescript
export type NetworkType = "clearnet" | "tor" | "i2p" | "lokinet";

export interface CheckResult<T = any> {
  data: T;
  duration: number;
  error?: Error;
}

export interface RelayCheckResult {
  url: string;
  hostname: string;
  protocol: string;
  checked_at: number;
  online?: boolean;
  ignore?: boolean;
  parent?: string;
  network?: NetworkType;

  // Check results
  open?: CheckResult<boolean>;
  read?: CheckResult<boolean>;
  write?: CheckResult<boolean>;
  info?: CheckResult<Record<string, any>>;
  dns?: CheckResult<Record<string, any>>;
  geo?: CheckResult<Record<string, any>>;
  ssl?: CheckResult<Record<string, any>>;
}

export function validateRelayResult(result: unknown): RelayCheckResult {
  if (!result || typeof result !== "object") {
    throw new Error("Result must be an object");
  }

  const r = result as any;
  if (!r.url || typeof r.url !== "string") {
    throw new Error("Result must have url string");
  }

  // Validate URL format
  try {
    new URL(r.url);
  } catch {
    throw new Error(`Invalid URL: ${r.url}`);
  }

  return r as RelayCheckResult;
}
```

**Refactoring Steps:**
1. Write tests for relay result types
2. Create `src/types/relay.ts` with type definitions
3. Implement validation functions
4. Run tests: `deno test tests/unit/relay-types.test.ts`
5. Replace `result: any` with `RelayCheckResult` in worker.ts
6. Replace `result: any` with `RelayCheckResult` in hostnames.ts
7. Run full test suite
8. Build and verify
9. Commit: "feat(types): add RelayCheckResult type definitions"

**Deliverables:**
- [ ] `src/types/relay.ts` - Relay type definitions
- [ ] `tests/unit/relay-types.test.ts` - Type validation tests
- [ ] All `result: any` replaced with `RelayCheckResult`

---

**Step 1.1.3: Error Types**

**Test File:** `tests/unit/error-types.test.ts`

**Implementation File:** `src/types/errors.ts`

```typescript
export class RelayMonError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RelayMonError";
  }
}

export class NetworkError extends RelayMonError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "NETWORK_ERROR", context);
    this.name = "NetworkError";
  }
}

export class ValidationError extends RelayMonError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ValidationError";
  }
}

export class ConfigError extends RelayMonError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFIG_ERROR", context);
    this.name = "ConfigError";
  }
}

export class DatabaseError extends RelayMonError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "DATABASE_ERROR", context);
    this.name = "DatabaseError";
  }
}

// Type guard
export function isRelayMonError(error: unknown): error is RelayMonError {
  return error instanceof RelayMonError;
}

// Error handler utility
export function handleError(error: unknown): RelayMonError {
  if (isRelayMonError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new RelayMonError(error.message, "UNKNOWN_ERROR", {
      originalError: error.name,
      stack: error.stack
    });
  }

  return new RelayMonError(
    String(error),
    "UNKNOWN_ERROR",
    { originalValue: error }
  );
}
```

**Refactoring Steps:**
1. Write error type tests
2. Create `src/types/errors.ts`
3. Implement error classes and handlers
4. Test error handling
5. Create `src/utils/errorHandler.ts` with standardized error handling
6. Replace `catch (error: any)` with `catch (error: unknown)` throughout
7. Use `handleError()` in all catch blocks
8. Verify all tests pass
9. Build and verify
10. Commit: "feat(types): add typed error handling"

---

### 1.2 Replace All `any` Types

**Objective:** Systematically replace remaining `any` types

**Approach:**
1. Run: `grep -r "any" src/ --include="*.ts" | wc -l` (baseline: ~54)
2. For each file with `any`:
   a. Write test for the function
   b. Determine proper type
   c. Replace `any` with proper type
   d. Run tests
   e. Commit
3. Reduce `any` count to 0

**Priority Order:**
1. Public API functions (exported functions)
2. Core business logic (worker, hostnames, seeder)
3. Utility functions
4. Internal helpers

---

## Phase 2: Core Logic Testing

### Objective: Add comprehensive tests for untested critical paths

### 2.1 Hostname Deduplication Tests

**Test File:** `tests/unit/hostnames/deduplication.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { relayHostnameDedup } from "../../../src/utils/hostnames.ts";
import { mockRelayResult } from "../../helpers/fixtures.ts";

Deno.test("Deduplication - root URL is not ignored", async () => {
  const result = await relayHostnameDedup({
    ...mockRelayResult,
    url: "wss://relay.example.com",
  });

  assertEquals(result.ignore, false);
  assertEquals(result.parent, "");
});

Deno.test("Deduplication - path URL with same NIP-11 as root is ignored", async () => {
  // First, add root to database
  // Then check path URL
  const result = await relayHostnameDedup({
    ...mockRelayResult,
    url: "wss://relay.example.com/path",
    // Same NIP-11 info as root
  });

  assertEquals(result.ignore, true);
  assertEquals(result.parent, "wss://relay.example.com");
});

Deno.test("Deduplication - path URL with different NIP-11 is not ignored", async () => {
  const result = await relayHostnameDedup({
    ...mockRelayResult,
    url: "wss://relay.example.com/different",
    info: {
      data: { name: "Different Relay" },
      duration: 50
    }
  });

  assertEquals(result.ignore, false);
});

// Test all 8 deduplication cases
Deno.test("Deduplication - case1: eldest is root with same NIP-11", async () => {
  // ...
});

Deno.test("Deduplication - case2: eldest is root, current has NIP-11 matching any relative", async () => {
  // ...
});

// ... test cases 3-8
```

**Test Strategy:**
1. Create test database with known relay states
2. Test each of the 8 deduplication cases independently
3. Test edge cases (no relatives, no NIP-11 info, etc.)
4. Test IgnoreListSync integration

**Deliverables:**
- [ ] `tests/unit/hostnames/deduplication.test.ts` - 20+ test cases
- [ ] `tests/unit/hostnames/reevaluation.test.ts` - Re-evaluation tests
- [ ] `tests/unit/hostnames/utils.test.ts` - Utility function tests
- [ ] 100% coverage of hostnames.ts

---

### 2.2 Worker Tests

**Test File:** `tests/unit/worker.test.ts`

```typescript
import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";
import { Worker } from "../../src/core/worker.ts";
import { mockConfig, mockQueueManager } from "../helpers/mocks.ts";

Deno.test("Worker - processRelay succeeds for online relay", async () => {
  const worker = new Worker("pubkey", mockQueueManager, mockConfig);

  // Mock Nocap to return success
  const originalNocap = globalThis.Nocap;
  globalThis.Nocap = class MockNocap {
    async check() {
      return {
        open: { data: true, duration: 100 },
        info: { data: { name: "Test" }, duration: 50 }
      };
    }
  };

  await worker.processRelay("wss://relay.example.com");

  // Verify relay was marked online in DB
  const status = db.query(
    "SELECT online FROM relay_status WHERE url = ?",
    ["wss://relay.example.com"]
  );
  assertEquals(status[0][0], 1);

  globalThis.Nocap = originalNocap;
});

Deno.test("Worker - processRelay handles offline relay correctly", async () => {
  // ...
});

Deno.test("Worker - processRelay increments retry count on failure", async () => {
  // ...
});

Deno.test("Worker - processRelay skips ignored relays", async () => {
  // ...
});

Deno.test("Worker - processRelay publishes result for online non-ignored relay", async () => {
  // ...
});
```

**Deliverables:**
- [ ] `tests/unit/worker.test.ts` - 15+ test cases
- [ ] Mock implementations for Nocap, Publisher
- [ ] Coverage of all worker error paths

---

### 2.3 Seeder Tests

**Test File:** `tests/unit/seeder.test.ts`

```typescript
Deno.test("Seeder - seedFromConfig returns configured relays", async () => {
  // ...
});

Deno.test("Seeder - seedFromStatic reads YAML file correctly", async () => {
  // ...
});

Deno.test("Seeder - seedFromCache retrieves from database", async () => {
  // ...
});

Deno.test("Seeder - seedFromAPI fetches from remote endpoint", async () => {
  // Mock fetch
  // ...
});

Deno.test("Seeder - seed() aggregates from all sources without duplicates", async () => {
  // ...
});
```

**Deliverables:**
- [ ] `tests/unit/seeder.test.ts` - 10+ test cases
- [ ] Test each seeding strategy independently
- [ ] Test aggregation logic

---

### 2.4 IgnoreListSync Tests

**Test File:** `tests/unit/ignorelistsync.test.ts`

```typescript
Deno.test("IgnoreListSync - fetchKind10002 retrieves relay list", async () => {
  // Mock SimplePool
  // ...
});

Deno.test("IgnoreListSync - fetchKind10006 retrieves blocked relays", async () => {
  // ...
});

Deno.test("IgnoreListSync - sync merges ignore lists from multiple monitors", async () => {
  // ...
});

Deno.test("IgnoreListSync - publish creates kind 10006 event", async () => {
  // ...
});

Deno.test("IgnoreListSync - publishDeletions creates NIP-09 events", async () => {
  // ...
});
```

**Deliverables:**
- [ ] `tests/unit/ignorelistsync.test.ts` - 10+ test cases
- [ ] Mock Nostr pool and event publishing
- [ ] Test sync logic thoroughly

---

## Phase 3: Error Handling Improvements

### Objective: Implement robust error handling throughout

### 3.1 Create Error Handling Utilities

**Test File:** `tests/unit/error-handler.test.ts`

**Implementation File:** `src/utils/errorHandler.ts`

```typescript
import { RelayMonError, handleError, NetworkError } from "../types/errors.ts";
import { getLogger } from "./logger.ts";

const logger = getLogger("ErrorHandler");

export interface ErrorHandlerOptions {
  shouldThrow?: boolean;
  shouldLog?: boolean;
  context?: Record<string, unknown>;
  operation?: string;
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  const {
    shouldThrow = false,
    shouldLog = true,
    context = {},
    operation = "operation"
  } = options;

  try {
    return await fn();
  } catch (error: unknown) {
    const handled = handleError(error);

    if (shouldLog) {
      logger.error(`Error in ${operation}`, {
        error: handled.message,
        code: handled.code,
        context: { ...context, ...handled.context }
      });
    }

    if (shouldThrow) {
      throw handled;
    }

    return null;
  }
}

export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        resolve(result);
        return;
      } catch (error: unknown) {
        lastError = handleError(error);

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
        }
      }
    }

    reject(lastError);
  });
}
```

**Refactoring Steps:**
1. Write error handler tests
2. Implement error handler utilities
3. Identify all try/catch blocks in codebase
4. Replace with `withErrorHandling` where appropriate
5. Test each replacement
6. Commit incrementally

**Deliverables:**
- [ ] `src/utils/errorHandler.ts` - Error handling utilities
- [ ] `tests/unit/error-handler.test.ts` - Comprehensive tests
- [ ] All critical paths use error handler

---

### 3.2 Replace Silent Failures

**Approach:**
1. Identify all silent failures (grep for empty catch blocks)
2. For each:
   a. Write test that verifies error is handled
   b. Add proper error handling
   c. Verify test passes
   d. Commit

**Example Refactoring:**

**Before:**
```typescript
try {
  const result = await someOperation();
} catch (error) {
  logger.error(`Error: ${error}`);
  // Silent failure - continues without handling
}
```

**After:**
```typescript
const result = await withErrorHandling(
  () => someOperation(),
  {
    operation: "someOperation",
    context: { relayUrl },
    shouldThrow: true // or false depending on criticality
  }
);

if (!result) {
  // Handle null case appropriately
  return;
}
```

---

## Phase 4: Code Consolidation

### Objective: Eliminate code duplication and improve maintainability

### 4.1 Consolidate Time Parsing

**Test File:** `tests/unit/utils/time.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { parseTimeString, formatDuration } from "../../../src/utils/time.ts";

Deno.test("parseTimeString - parses seconds", () => {
  assertEquals(parseTimeString("30s"), 30 * 1000);
});

Deno.test("parseTimeString - parses minutes", () => {
  assertEquals(parseTimeString("5m"), 5 * 60 * 1000);
});

Deno.test("parseTimeString - parses hours", () => {
  assertEquals(parseTimeString("2h"), 2 * 60 * 60 * 1000);
});

Deno.test("parseTimeString - parses days", () => {
  assertEquals(parseTimeString("7d"), 7 * 24 * 60 * 60 * 1000);
});

Deno.test("parseTimeString - throws on invalid format", () => {
  assertThrows(
    () => parseTimeString("invalid"),
    Error,
    "Invalid time format"
  );
});
```

**Implementation File:** `src/utils/time.ts`

```typescript
export function parseTimeString(input: string): number {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${input}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
```

**Refactoring Steps:**
1. Write tests for time utilities
2. Create `src/utils/time.ts`
3. Implement and test functions
4. Replace `parseInterval()` in daemon.ts with `parseTimeString()`
5. Replace `timeString()` in config.ts with `parseTimeString()`
6. Remove duplicate implementations
7. Verify all tests pass
8. Commit: "refactor(utils): consolidate time parsing utilities"

**Deliverables:**
- [ ] `src/utils/time.ts` - Consolidated time utilities
- [ ] `tests/unit/utils/time.test.ts` - Comprehensive tests
- [ ] Duplicate implementations removed

---

### 4.2 Create URL Utilities Module

**Test File:** `tests/unit/utils/url.test.ts`

**Implementation File:** `src/utils/url.ts`

```typescript
export function normalizeRelayURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Normalize to wss:// protocol
    // Remove trailing slashes
    // Ensure consistent format
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new ValidationError(`Invalid relay URL: ${url}`);
  }
}

export function parseRelayURL(url: string): {
  protocol: string;
  hostname: string;
  pathname: string;
  full: string;
} {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    full: normalizeRelayURL(url)
  };
}

export function isRootURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

export function getHostnameKey(url: string): string {
  const { protocol, hostname } = parseRelayURL(url);
  return `${protocol}//${hostname}`;
}
```

**Refactoring Steps:**
1. Write URL utility tests
2. Create `src/utils/url.ts`
3. Extract URL parsing logic from hostnames.ts
4. Replace inline URL parsing with utility functions
5. Test thoroughly
6. Commit

---

### 4.3 Extract Common Logging Patterns

**Implementation File:** `src/utils/logging.ts`

```typescript
import { getLogger, Logger } from "./logger.ts";

export function createModuleLogger(moduleName: string): Logger {
  return getLogger(moduleName);
}

export interface LogContext {
  relay?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

export function logOperation(
  logger: Logger,
  operation: string,
  context: LogContext = {}
): void {
  logger.debug(`${operation}`, context);
}

export function logError(
  logger: Logger,
  operation: string,
  error: Error,
  context: LogContext = {}
): void {
  logger.error(`Error in ${operation}: ${error.message}`, {
    ...context,
    stack: error.stack
  });
}
```

---

## Phase 5: Integration Tests

### Objective: Create comprehensive integration tests

### 5.1 Daemon Lifecycle Tests

**Test File:** `tests/integration/daemon-lifecycle.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { runDaemon } from "../../src/core/daemon.ts";
import { mockConfig } from "../helpers/fixtures.ts";

Deno.test("Daemon - starts and initializes all components", async () => {
  // Create test database
  // Start daemon in background
  // Verify all components initialized
  // Shutdown gracefully
});

Deno.test("Daemon - schedules tasks correctly", async () => {
  // Start daemon
  // Verify scheduled tasks are running
  // Shutdown
});

Deno.test("Daemon - handles graceful shutdown", async () => {
  // Start daemon
  // Send SIGTERM
  // Verify cleanup
});
```

**Time:** 3 days

---

### 5.2 End-to-End Relay Check Tests

**Test File:** `tests/integration/relay-check-e2e.test.ts`

```typescript
Deno.test("E2E - check relay lifecycle from discovery to publication", async () => {
  // 1. Seed relay into database
  // 2. Wait for relay to expire
  // 3. Verify relay is checked
  // 4. Verify result is published
  // 5. Verify deduplication runs
  // 6. Verify ignore list sync
});
```

---

### 5.3 Database Integration Tests

**Test File:** `tests/integration/database.test.ts`

```typescript
Deno.test("Database - concurrent reads/writes work correctly", async () => {
  // Test database under concurrent load
});

Deno.test("Database - migrations work correctly", async () => {
  // Test database migration logic
});

Deno.test("Database - handles corruption gracefully", async () => {
  // Test error handling for corrupted database
});
```

---

## Phase 6: Performance Optimization

### Objective: Optimize critical paths without breaking functionality

### 6.1 Database Query Optimization

**Steps:**
1. Add query performance logging
2. Identify slow queries
3. Add indexes where needed
4. Batch operations
5. Test performance improvements
6. Ensure no regressions

**Time:** 3 days

---

### 6.2 Deduplication Performance

**Steps:**
1. Profile deduplication logic
2. Identify bottlenecks
3. Optimize database lookups (add caching)
4. Test improvements
5. Ensure correctness maintained

---

## Phase 7: Documentation & Polish

### Objective: Complete documentation and final polish

### 7.1 API Documentation

**Deliverables:**
- [ ] JSDoc comments for all public APIs
- [ ] Architecture decision records (ADRs)
- [ ] Updated README with new architecture
- [ ] Migration guide for users

---

### 7.2 Developer Guide

**Deliverables:**
- [ ] Contributing guide
- [ ] Testing guide
- [ ] Debugging guide
- [ ] Architecture overview

---

## Phase 8: Final Verification

### Objective: Comprehensive verification before release

### 8.1 Full Test Suite

**Steps:**
1. Run all unit tests
2. Run all integration tests
3. Run performance benchmarks
4. Generate coverage report (target: >80%)
5. Review and fix any gaps

---

### 8.2 Production Testing

**Steps:**
1. Deploy to staging environment
2. Run for 7 days monitoring for issues
3. Compare metrics to baseline
4. Fix any issues discovered
5. Document any behavior changes

---

### 8.3 Release Preparation

**Deliverables:**
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Release notes prepared
- [ ] Migration guide finalized
- [ ] Backward compatibility verified

---

## Continuous Practices Throughout

### After Every Change:

1. **Run Tests:**
   ```bash
   deno test
   ```

2. **Check Types:**
   ```bash
   deno check src/**/*.ts
   ```

3. **Lint:**
   ```bash
   deno lint
   ```

4. **Format:**
   ```bash
   deno fmt
   ```

5. **Build:**
   ```bash
   deno task build
   deno task compile:all
   ```

6. **Generate Coverage:**
   ```bash
   deno test --coverage=coverage
   deno coverage coverage
   ```

### Commit Message Format:

```
<type>(<scope>): <subject>

<body>

Tests: <test description>
Verified: build succeeds, all tests pass
```

**Types:** feat, fix, refactor, test, docs, chore

---

## Risk Mitigation

### Rollback Strategy

For each phase:
1. Create feature branch: `refactor/phase-N-description`
2. Make changes incrementally
3. Keep commits small and atomic
4. If tests fail, immediately revert last commit
5. Only merge to main when phase complete and verified

### Regression Prevention

1. **Never skip tests** - Every change must have tests
2. **Never combine refactorings** - One change at a time
3. **Always verify build** - Build must succeed after each commit
4. **Maintain changelog** - Document every change
5. **Peer review** - All phase completions require review

---

## Success Metrics

### Code Quality Targets

- **Test Coverage:** >80% (from ~20%)
- **Type Safety:** 0 `any` types (from 54)
- **Error Handling:** 100% of catch blocks use proper error types
- **Code Duplication:** <5% (from ~15%)
- **Documentation:** 100% of public APIs documented

### Performance Targets

- **Build Time:** <5 seconds (unchanged)
- **Test Execution:** <30 seconds for full suite
- **Memory Usage:** No increase (baseline ~50MB)
- **Relay Check Throughput:** No decrease (baseline ~20/sec)

### Reliability Targets

- **Zero Regressions:** All existing functionality maintained
- **Error Rate:** <0.1% for relay checks
- **Uptime:** 99.9% in staging environment

---

## Conclusion

This plan provides a methodical, test-driven approach to refactoring RelayMon with **zero tolerance for regressions**. By following this plan strictly, we ensure:

1. ✅ Every change is tested before implementation
2. ✅ Build succeeds after each unit of work
3. ✅ No functionality is broken
4. ✅ Code quality improves incrementally
5. ✅ Documentation stays up-to-date
6. ✅ Team can review progress at each phase

The result will be a production-ready, well-tested, maintainable codebase that's ready for long-term growth and evolution.
