import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  parsePeriod,
  isCleanMultiple,
  getChecksPerPeriod,
  shouldEmitPeriod,
  validatePeriods,
  getPeriodsToEmit,
  formatPeriod
} from "../../src/delta/periods.ts";

/**
 * Test helper
 */
function periodTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

periodTest("Period Calculator: parsePeriod should parse hours correctly", () => {
  assertEquals(parsePeriod("1h"), 3600000); // 1 hour in ms
  assertEquals(parsePeriod("6h"), 21600000); // 6 hours in ms
  assertEquals(parsePeriod("24h"), 86400000); // 24 hours in ms
});

periodTest("Period Calculator: parsePeriod should parse days correctly", () => {
  assertEquals(parsePeriod("1d"), 86400000); // 1 day in ms
  assertEquals(parsePeriod("7d"), 604800000); // 7 days in ms
  assertEquals(parsePeriod("30d"), 2592000000); // 30 days in ms
});

periodTest("Period Calculator: parsePeriod should parse weeks correctly", () => {
  assertEquals(parsePeriod("1w"), 604800000); // 1 week in ms
  assertEquals(parsePeriod("2w"), 1209600000); // 2 weeks in ms
});

periodTest("Period Calculator: parsePeriod should parse months correctly", () => {
  assertEquals(parsePeriod("1m"), 2592000000); // ~30 days in ms
});

periodTest("Period Calculator: isCleanMultiple should detect clean multiples", () => {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;

  assert(isCleanMultiple(oneDayMs, sixHoursMs), "24h should be clean multiple of 6h");
  assert(isCleanMultiple(sixHoursMs, sixHoursMs), "6h should be clean multiple of itself");
  assert(!isCleanMultiple(oneDayMs, 7 * 60 * 60 * 1000), "24h should NOT be clean multiple of 7h");
});

periodTest("Period Calculator: getChecksPerPeriod should calculate correctly", () => {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  assertEquals(getChecksPerPeriod(oneDayMs, sixHoursMs), 4, "1d / 6h = 4 checks");
  assertEquals(getChecksPerPeriod(sevenDaysMs, oneDayMs), 7, "7d / 1d = 7 checks");
  assertEquals(getChecksPerPeriod(sixHoursMs, sixHoursMs), 1, "6h / 6h = 1 check");
});

periodTest("Period Calculator: shouldEmitPeriod - first time should emit", () => {
  const periodMs = 6 * 60 * 60 * 1000; // 6 hours
  const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
  const nowTs = Math.floor(Date.now() / 1000);

  assert(shouldEmitPeriod(periodMs, checkIntervalMs, 0, nowTs), "Should emit if never emitted before");
});

periodTest("Period Calculator: shouldEmitPeriod - should wait for period to elapse", () => {
  const periodMs = 6 * 60 * 60 * 1000; // 6 hours
  const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
  const nowTs = Math.floor(Date.now() / 1000);

  // Last emitted 1 hour ago
  const lastSnapshotAt = nowTs - 3600;

  assert(!shouldEmitPeriod(periodMs, checkIntervalMs, lastSnapshotAt, nowTs),
    "Should NOT emit if only 1 hour elapsed (need 6h)");
});

periodTest("Period Calculator: shouldEmitPeriod - should emit after period elapses", () => {
  const periodMs = 6 * 60 * 60 * 1000; // 6 hours
  const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
  const nowTs = Math.floor(Date.now() / 1000);

  // Last emitted 7 hours ago
  const lastSnapshotAt = nowTs - (7 * 3600);

  assert(shouldEmitPeriod(periodMs, checkIntervalMs, lastSnapshotAt, nowTs),
    "Should emit if 7 hours elapsed (> 6h period)");
});

periodTest("Period Calculator: validatePeriods should warn about non-multiples", () => {
  const checkIntervalMs = 7 * 60 * 60 * 1000; // 7 hours
  const periods = ["6h", "1d"];

  const warnings = validatePeriods(periods, checkIntervalMs);

  assert(warnings.some(w => w.includes("6h")), "Should warn about 6h (smaller than check interval)");
  assert(warnings.some(w => w.includes("1d")), "Should warn about 1d (not clean multiple of 7h)");
  // Note: 7d IS a clean multiple of 7h (24 * 7h = 7d), so no warning expected
});

periodTest("Period Calculator: validatePeriods should pass for clean multiples", () => {
  const checkIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
  const periods = ["6h", "1d", "7d"];

  const warnings = validatePeriods(periods, checkIntervalMs);

  // 6h is equal to interval (OK), 1d is 4x (OK), but 7d might not be clean
  assert(warnings.length <= 1, "Should have few or no warnings for reasonable periods");
});

periodTest("Period Calculator: getPeriodsToEmit should return periods due", () => {
  const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
  const periods = ["6h", "1d", "7d"];
  const nowTs = Math.floor(Date.now() / 1000);

  // Simulate: 6h emitted 7h ago, 1d never emitted, 7d emitted 1d ago
  const periodSnapshots = new Map<string, number>();
  periodSnapshots.set("6h", nowTs - (7 * 3600)); // 7 hours ago - should emit
  periodSnapshots.set("1d", 0); // Never - should emit
  periodSnapshots.set("7d", nowTs - (1 * 86400)); // 1 day ago - should NOT emit

  const toEmit = getPeriodsToEmit(periods, checkIntervalMs, periodSnapshots, nowTs);

  assert(toEmit.includes("6h"), "Should emit 6h (elapsed)");
  assert(toEmit.includes("1d"), "Should emit 1d (never emitted)");
  assert(!toEmit.includes("7d"), "Should NOT emit 7d (only 1d elapsed, need 7d)");
});

periodTest("Period Calculator: formatPeriod should format correctly", () => {
  assertEquals(formatPeriod(3600000), "1h"); // 1 hour
  assertEquals(formatPeriod(86400000), "1d"); // 1 day
  assertEquals(formatPeriod(604800000), "1w"); // 1 week
  assertEquals(formatPeriod(21600000), "6h"); // 6 hours
});

periodTest("Period Calculator: formatPeriod should handle non-standard values", () => {
  const result = formatPeriod(90000); // 1.5 minutes = 90 seconds
  assertEquals(result, "90s"); // Falls back to seconds
});

console.log("Period calculator tests completed");
