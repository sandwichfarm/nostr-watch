/**
 * Custom Assertions for RelayMon Testing
 *
 * Domain-specific assertion helpers for clearer test intent.
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";

/**
 * Assert that a relay result has the expected structure
 */
export function assertRelayResult(result: any): void {
  assertExists(result, "Result should exist");
  assertExists(result.url, "Result should have url");
  assertExists(result.hostname, "Result should have hostname");
  assertExists(result.protocol, "Result should have protocol");
  assertExists(result.checked_at, "Result should have checked_at");
}

/**
 * Assert that a relay is marked as online
 */
export function assertRelayOnline(result: any): void {
  assertRelayResult(result);
  assertEquals(result.open?.data, true, "Relay should be online (open.data === true)");
}

/**
 * Assert that a relay is marked as offline
 */
export function assertRelayOffline(result: any): void {
  assertRelayResult(result);
  assertEquals(result.open?.data, false, "Relay should be offline (open.data === false)");
}

/**
 * Assert that a relay is ignored
 */
export function assertRelayIgnored(result: any, parent?: string): void {
  assertRelayResult(result);
  assertEquals(result.ignore, true, "Relay should be ignored");
  if (parent) {
    assertEquals(result.parent, parent, `Relay parent should be ${parent}`);
  }
}

/**
 * Assert that a relay is not ignored
 */
export function assertRelayNotIgnored(result: any): void {
  assertRelayResult(result);
  assertEquals(result.ignore, false, "Relay should not be ignored");
  assertEquals(result.parent, "", "Relay should have no parent");
}

/**
 * Assert that a relay has NIP-11 info
 */
export function assertRelayHasNIP11(result: any): void {
  assertRelayResult(result);
  assertExists(result.info, "Result should have info");
  assertExists(result.info.data, "Info should have data");
  assert(Object.keys(result.info.data).length > 0, "Info data should not be empty");
}

/**
 * Assert that a relay has specific check results
 */
export function assertRelayHasChecks(result: any, checks: string[]): void {
  assertRelayResult(result);
  for (const check of checks) {
    assertExists(result[check], `Result should have ${check} check`);
    assertExists(result[check].data, `${check} check should have data`);
  }
}

/**
 * Assert that an event has the expected structure
 */
export function assertNostrEvent(event: any): void {
  assertExists(event, "Event should exist");
  assertExists(event.kind, "Event should have kind");
  assertExists(event.created_at, "Event should have created_at");
  assertExists(event.tags, "Event should have tags");
  assertExists(event.content, "Event should have content");
  assertExists(event.pubkey, "Event should have pubkey");
}

/**
 * Assert that an event is a specific kind
 */
export function assertEventKind(event: any, kind: number): void {
  assertNostrEvent(event);
  assertEquals(event.kind, kind, `Event should be kind ${kind}`);
}

/**
 * Assert that an event has a specific tag
 */
export function assertEventHasTag(event: any, tagName: string, expectedValue?: string): void {
  assertNostrEvent(event);
  const tag = event.tags.find((t: string[]) => t[0] === tagName);
  assertExists(tag, `Event should have tag ${tagName}`);
  if (expectedValue !== undefined) {
    assertEquals(tag[1], expectedValue, `Tag ${tagName} should have value ${expectedValue}`);
  }
}

/**
 * Assert that a config is valid
 */
export function assertValidConfig(config: any): void {
  assertExists(config, "Config should exist");
  assertExists(config.monitor, "Config should have monitor");
  assertExists(config.monitor.slug, "Monitor should have slug");
  assertExists(config.relaymon, "Config should have relaymon");
  assertExists(config.relaymon.networks, "Relaymon should have networks");
}

/**
 * Assert that a database row exists
 */
export function assertDatabaseRow(rows: any[], url: string): void {
  const row = rows.find((r: any) => r[0] === url || r.url === url);
  assertExists(row, `Database should contain row for ${url}`);
}

/**
 * Assert that a database row does not exist
 */
export function assertNoDatabaseRow(rows: any[], url: string): void {
  const row = rows.find((r: any) => r[0] === url || r.url === url);
  assertEquals(row, undefined, `Database should not contain row for ${url}`);
}

/**
 * Assert that an error is of a specific type
 */
export function assertErrorType(error: unknown, expectedType: new (...args: any[]) => Error): void {
  assert(error instanceof expectedType, `Error should be instance of ${expectedType.name}`);
}

/**
 * Assert that an error message contains specific text
 */
export function assertErrorMessage(error: unknown, expectedMessage: string): void {
  assert(error instanceof Error, "Error should be an Error instance");
  assert(
    error.message.includes(expectedMessage),
    `Error message should contain "${expectedMessage}", got: ${error.message}`
  );
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(value: number, min: number, max: number, message?: string): void {
  assert(
    value >= min && value <= max,
    message || `Value ${value} should be between ${min} and ${max}`
  );
}

/**
 * Assert that a duration is reasonable (not too short or too long)
 */
export function assertReasonableDuration(duration: number, expectedMs: number, toleranceMs: number = 100): void {
  assertInRange(
    duration,
    expectedMs - toleranceMs,
    expectedMs + toleranceMs,
    `Duration ${duration}ms should be close to ${expectedMs}ms (±${toleranceMs}ms)`
  );
}

/**
 * Assert that an array contains specific items
 */
export function assertArrayContains<T>(array: T[], ...items: T[]): void {
  for (const item of items) {
    assert(
      array.includes(item),
      `Array should contain ${JSON.stringify(item)}`
    );
  }
}

/**
 * Assert that an array does not contain specific items
 */
export function assertArrayNotContains<T>(array: T[], ...items: T[]): void {
  for (const item of items) {
    assert(
      !array.includes(item),
      `Array should not contain ${JSON.stringify(item)}`
    );
  }
}

/**
 * Assert that two objects are deeply equal
 */
export function assertDeepEquals(actual: any, expected: any, message?: string): void {
  assertEquals(actual, expected, message);
}
